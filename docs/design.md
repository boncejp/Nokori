# 基本設計書：Nokori v2.0

## 1. システムアーキテクチャ & 技術スタック

| 領域 | 採用技術 |
|---|---|
| Frontend / Backend | Next.js 14+ (App Router), TypeScript |
| State Management | Zustand |
| Database | Supabase (PostgreSQL) |
| DB Client | `@supabase/ssr`（Next.js App Router対応） |
| Schema / Migration | Supabase CLI（SQLマイグレーションファイルで管理） |
| 型生成 | `supabase gen types typescript` |
| Infrastructure | Docker, GCP (Cloud Run) |
| CI/CD | GitHub Actions |
| Unit Test | Vitest |
| E2E / Integration Test | Playwright |
| Date & Time | `date-fns` + `date-fns-tz`（常に `Asia/Tokyo` 基準） |
| Holiday Calculation | `@holiday-jp/holiday_jp` |

> **Prismaは使用しない。** Supabase CLIのSQLマイグレーションと `supabase gen types typescript` による型生成で代替する。これによりRLSがランタイムのDB操作を確実に通過する。

---

## 2. データベース設計

### 2.1 profiles（ユーザー設定）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid (PK) | `auth.users.id` と一致 |
| `target_amount` | int | 最終目標貯金額 |
| `target_date` | date | 達成目標日（期間指定と給料日設定からサーバーで自動算出） |
| `target_duration_months` | int | 達成期限の期間（月）。`1〜251`（0年0か月は不可） |
| `target_anchor_logical_date` | date | 期間計算の起点となる論理日付（オンボーディング完了日） |
| `payday` | int | 給料日（1〜31） |
| `payday_rule` | enum ('BEFORE', 'AFTER', 'FIXED') | 土日祝の挙動 |
| `monthly_income` | int | 月収手取り概算 |
| `fixed_costs` | int | 固定費合計 |
| `estimated_electricity` | int | 電気代概算 |
| `estimated_gas` | int | ガス代概算 |
| `estimated_water` | int | 水道代概算 |
| `initial_total_assets` | int | オンボーディング時点の**現在の全財産**（要件定義書の用語に一致） |
| `current_total_savings` | int | **貯金総額（資産側）**。**オンボーディング初回保存時のみ** `initial_total_assets - initial_budget` で初期化する（§4.8）。設定更新のたびにこの式で上書きしない |
| `surplus_mode` | enum ('STRICT', 'YUTORI') | **通常サイクル（2回目以降）**の月次余剰金処理モード。初回サイクル締めでは使わない |
| `initial_budget` | int | **第1サイクル:** ユーザー入力の「次の給料日まで使う予算」。**通常サイクル:** 月次リセット・給料日モーダル等で更新する内部のサイクル枠（YUTORI 時は繰り越し込みの可処分を表す。設定 PATCH では上書きしない）。 |
| `last_monthly_reset_logical_date` | date nullable | 直近の月次リセット実行日（冪等性用） |
| `last_salary_cycle_logical_date` | date nullable | 手取り給料を最後に確定したサイクル開始日（給料日＝論理日の当日モーダル制御用） |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**オンボーディング初回保存時の初期化（このとき一度だけ適用）:**

```
current_total_savings = initial_total_assets - initial_budget
```

運用開始後の `current_total_savings` は、初回サイクル締め・特別支出・通常サイクル締め（STRICT 等）などの**資産変動ロジック**でのみ更新し、プロフィールの部分更新時に上式で再計算してはならない（§4.8）。

**既存データ移行時（`initial_total_assets` が未保存の行を埋める場合）:**

```
initial_total_assets = current_total_savings + initial_budget
```

（過去スキーマで `current_total_savings` と `initial_budget` だけが揃っている場合に、当時の「全財産」を復元するための式。）

> 光熱費概算合計 = `estimated_electricity + estimated_gas + estimated_water`

### 2.2 transactions（支出履歴）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users.id) | |
| `amount` | int | 支出金額 |
| `memo` | text (nullable) | メモ |
| `type` | enum ('NORMAL', 'SPECIAL') | 内部値。**ユーザー向け**は要件定義書どおり「普通支出 / 特別支出」 |
| `utility_type` | enum ('ELECTRICITY', 'GAS', 'WATER') nullable | null = 光熱費以外。非null = 光熱費の種別（ユーザー向けは「光熱費」） |
| `logical_date` | date | 27:00ルール適用後の論理日付（JST）。INSERT時にアプリ層で算出して保存 |
| `created_at` | timestamptz | 実際の入力時刻（UTC、Supabaseデフォルト） |

> **型の組み合わせ制約:** `type = 'SPECIAL'` かつ `utility_type IS NOT NULL` の組み合わせはアプリ層で禁止する（光熱費は貯金から直接差し引く性質を持たない）。

> **初回サイクル中:** `utility_type IS NOT NULL` のINSERT、および `type = 'SPECIAL'` のINSERTをアプリ層・APIで拒否する（要件: 光熱費・特別支出は通常サイクルから）。

### 2.3 RLS（Row Level Security）ポリシー

全テーブルにRLSを有効化し、以下のポリシーを設定する。

```sql
-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_only"
  ON profiles FOR ALL
  USING (id = auth.uid());

-- transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_transactions_only"
  ON transactions FOR ALL
  USING (user_id = auth.uid());
```

アプリのDBクライアントは `@supabase/ssr` の `createServerClient` / `createBrowserClient` を使用し、常にユーザーセッション経由でクエリを実行する。サービスロールキーはサーバーサイドの管理用操作のみに限定し、通常のCRUDには使用しない。

---

## 3. インフラ & DevOps 設計

### 3.1 Docker 構成

- **Dockerfile:** Multi-stage buildを採用し、本番用イメージを軽量化。
- **docker-compose.yml:** `app`（Next.js開発サーバー）のみを管理。
- Supabaseローカル開発環境は **Supabase CLI**（`supabase start`）で管理し、docker-composeとは分離する。

### 3.2 GCP デプロイ構成

- **Platform:** Google Cloud Run
- **Container Registry:** Artifact Registry
- **Secret Management:** Secret Manager（SupabaseのAPIキー、DB接続URLの管理）
- **Networking:** Cloud Runからホスト型Supabaseインスタンスへ接続。

### 3.3 CI/CD パイプライン（GitHub Actions）

| ジョブ | トリガー | 内容 |
|---|---|---|
| Lint & Type Check | PR作成時 | ESLint + tsc |
| Unit Test（Vitest） | PR作成時 | コアロジックの単体テスト |
| E2E Test（Playwright） | PR作成時 | JSTタイムゾーン指定環境で実行 |
| Deploy | mainブランチマージ時 | Dockerイメージビルド → Cloud Run自動デプロイ |

---

## 4. コアロジック仕様

### 4.0 フェーズ判定（初回サイクル vs 通常サイクル）

実装では、**現在の論理日が「初回サイクル」に含まれるか**を先に判定し、分岐する。

- **初回サイクル:** `target_anchor_logical_date`（オンボーディング完了の論理日）から、**次の給料日の前日**（論理日ベース）まで。
- **通常サイクル:** 上記期間外、かつ初回サイクル締め処理（次の給料日リセット）完了後。

予算の母数・光熱費差額・特別支出・月次余剰処理（STRICT/YUTORI）の適用有無は、本フェーズ判定に従う。

### 4.1 論理日付の算出（27:00ルール）

```typescript
import { toZonedTime } from 'date-fns-tz';
import { startOfDay, subDays } from 'date-fns';

const TIMEZONE = 'Asia/Tokyo';
const RESET_HOUR = 3; // 27:00 = AM 3:00

export function getLogicalDate(now: Date): Date {
  const jst = toZonedTime(now, TIMEZONE);
  // 00:00-02:59 は前日扱い
  if (jst.getHours() < RESET_HOUR) {
    return subDays(startOfDay(jst), 1);
  }
  return startOfDay(jst);
}
```

`transactions.logical_date` はINSERT時にこの関数で算出して保存する。これにより、集計クエリで毎回タイムゾーン変換を行う必要がなくなり、バグリスクを低減する。

### 4.2 動的日次予算の計算

#### 4.2.1 初回サイクル中（通常サイクルとは別式）

光熱費差額は**適用しない**。`remainingCycleBudget` の光熱費項は使わない。集計対象は**普通支出**（DB 上は `type = 'NORMAL'`）のトランザクションのみ。

```typescript
// 初回残り予算 = initial_budget - (初回開始日〜昨日までの普通支出（内部 type = 'NORMAL'）合計)
const firstCycleRemaining = initial_budget - sumNormalExpensesBeforeTodayInFirstCycle;

// 当日予算
const D_today = firstCycleRemaining / daysUntilNextPayday({ includeToday: true });

// 今日の残り — 当日の普通支出（内部 type = 'NORMAL'）のみ差し引き
const remainingToday = D_today - sumOfTodayNormalTransactions; // 当日分の普通支出（内部 type = 'NORMAL'）合計

// 翌日以降プレビュー（明日以降の日数で割る）
const D_future = (firstCycleRemaining - sumOfTodayNormalTransactions)
  / daysFromTomorrowUntilNextPayday();
```

#### 4.2.2 通常サイクル（2回目以降）

**支出種別ごとの予算・資産への載せ方（誤実装防止）:**

- **普通支出:** 当日の「今日の残り予算」から**直接**差し引く。`D_today` の分子側の当日以前の消費として扱う（DB 上は `type = 'NORMAL'`）。
- **光熱費:** 各入力ごとに実額と概算の差額（§4.3）を**当月の残り予算**に反映する。入力の瞬間に **`remainingToday` から差額を直接減算（または加算）してはならない**（当日の残りは**普通支出**のみで減らす）。差額は当月残りに織り込まれたうえで、**`D_future`（翌日以降予算プレビュー）** の分子に `utilityDeltaTotal` として現れるほか、**翌日以降の論理日が始まるたびに再計算される `D_today`** にも同じ当月残りを通じて反映される。つまり「今日の残り」は普通支出ベースで保ちつつ、翌日以降の日次配分には光熱費差額を含める。
- **特別支出:** **貯金総額**（`current_total_savings`）から直接減算する。**当日・翌日以降の日次予算の母数**（`remainingCycleBudget` や `remainingToday` の減算対象）には載せない（DB 上は `type = 'SPECIAL'`）。入力後に**月次貯金ノルマ**を再計算し、結果として次回以降の `remainingCycleBudget` / `D_today` の基準が変わり得る。

```typescript
// 当日予算（サイクル残高から。特別支出の金額はここに混ぜない）
const D_today = remainingCycleBudget / daysUntilNextPayday({ includeToday: true });

// 今日の残り — 普通支出（内部 type = 'NORMAL'）のみ差し引く（光熱費・特別支出はここに足さない）
const remainingToday = D_today - sumOfTodayNormalTransactions;

// 光熱費: 当月中に確定した「概算 − 実額」差額の累計（当月の残り予算への調整の合算）
const utilityDeltaTotal = /* §4.3 の budgetDelta を当月分で合算した値 */;

// 翌日以降の予測日次予算（リアルタイム）。光熱費差額は分子で表現し、当日の普通支出（内部 type = 'NORMAL'）のみ当日分を減算
const D_future =
  (remainingCycleBudget + utilityDeltaTotal - sumOfTodayNormalTransactions)
  / daysUntilNextPayday({ includeToday: false });
```

- `remainingCycleBudget`（通常サイクル）: **STRICT** では基準サイクル予算（月収 − 固定費 − 光熱費概算 − 月次貯金ノルマ）から、前日までの確定済み**普通支出**（内部 `type = 'NORMAL'`）に加え光熱費実額との差額調整（§4.3）を織り込んだ残りを母数とする。**YUTORI** では給料日リセットで確定した `initial_budget`（繰り越し込み可処分）から同様に差し引く。いずれも**特別支出**（内部 `type = 'SPECIAL'`）の金額は母数に含めない。`utilityDeltaTotal` は上式のとおり分子側で併記し、二重計上にならないよう実装で単一ソースに集約する。
- 支出登録のたびに `remainingToday` と `D_future` をZustandストアで即時更新し、UIに反映する。

### 4.3 光熱費の予算反映（通常サイクルのみ）

初回サイクル中は **本節の差額計算を行わない**（APIでも拒否）。

```typescript
function applyUtilityExpenseToBudget(
  profile: Profile,
  utilityType: UtilityType,
  actualAmount: number
): number {
  const estimateKey = {
    ELECTRICITY: 'estimated_electricity',
    GAS: 'estimated_gas',
    WATER: 'estimated_water',
  } as const satisfies Record<UtilityType, keyof Profile>;

  const estimate = profile[estimateKey[utilityType]];
  const budgetDelta = estimate - actualAmount;
  // 正 = 概算より安かった（予算増）
  // 負 = 概算より高かった（予算減）
  return budgetDelta;
}
```

差額は**当月の残り予算**にマージする（入力時点では **`remainingToday` に直接加減しない**）。その結果、疑似コードの `utilityDeltaTotal` として **`D_future`（翌日以降予算プレビュー）** を再計算するほか、**翌日以降の論理日が始まるたびに再計算される `D_today`** にも、同じ当月残りを母数として光熱費差額が織り込まれる。つまり「今日の残り予算」は**普通支出**だけで保ちつつ、翌日以降の日次配分（プレビューと、実際に回ってくる各日の当日予算）には光熱費差額を含める。

### 4.4 初回サイクル締め（次の給料日リセット時）

**STRICT / YUTORI は適用しない。**

```typescript
/** sumNormalInFirstCycle = 初回サイクル内の普通支出（内部 type = 'NORMAL'）合計 */
function closeFirstSalaryCycle(profile: Profile, sumNormalInFirstCycle: number): Partial<Profile> {
  const initialBudget = profile.initial_budget;
  const delta = initialBudget - sumNormalInFirstCycle; // 初回差額
  return {
    current_total_savings: profile.current_total_savings + delta,
    // 以降は通常サイクル。initial_budget の扱いは次サイクル基準予算の確定ロジックに合わせて更新
  };
}
```

要件定義書の数値例（超過・余剰）と整合すること。

### 4.5 月次サイクル余剰金処理（STRICT / YUTORI）— 通常サイクルのみ

**初回サイクル締めでは呼ばない。** 2回目以降の給料日リセットでのみ実行する。

```typescript
function processMonthlyReset(
  profile: Profile,
  surplus: number
): Partial<Profile> {
  if (surplus <= 0) return {};

  if (profile.surplus_mode === 'STRICT') {
    // 余剰金を全額貯金に追加。翌月予算は基準値に戻る。
    return { current_total_savings: profile.current_total_savings + surplus };
  }

  // YUTORI: 翌月の可処分所得に上乗せ。貯金総額は変更しない。
  const baseBudget = calculateBaseBudget(profile);
  return { initial_budget: baseBudget + surplus };
}
```

### 4.6 給料日算出と祝日判定

- `profiles.payday_rule` に基づき、次回の給料日を動的に算出する。
- 土日および `@holiday-jp/holiday_jp` で判定される日本の祝日と被った場合、BEFORE（前倒し）/ AFTER（後ろ倒し）/ FIXED（そのまま）のルールに従って補正する。
- 給料日の数値（例：31）が当月に存在しない場合（2月等）は、当月の最終日を採用する。

### 4.7 達成期限（期間）から目標日を決定

- オンボーディング/設定では `年(0〜20)` と `月(0〜11)` で達成期限を入力する。
- `0年0か月` はバリデーションエラーとし、最低 `1か月` を必須にする。
- 目標日は `target_anchor_logical_date` から `Nか月後` の月における給料日を採用する。
- 給料日算出には既存の `payday` / `payday_rule`（BEFORE / AFTER / FIXED）と月末補正をそのまま適用する。
- `payday` または `payday_rule` を変更した場合、同一 `target_duration_months` を使って `target_date` を再計算して保存する（クライアント計算結果は信用しない）。

### 4.8 オンボーディング・プロフィール更新のバリデーション

**`current_total_savings` と `initial_total_assets - initial_budget` の関係（重要）:**

- 等式 `current_total_savings = initial_total_assets - initial_budget` は、**オンボーディング初回保存成功時の初期化**にのみ用いる。`initial_budget > initial_total_assets` のときは **validation error** とし、保存しない。
- **設定更新**（目標・固定費・光熱費概算・給料日等の変更）では、原則として**運用中の `current_total_savings` をこの式で再計算してはならない**。初回締め・特別支出・通常サイクル締め（余剰の STRICT 等）で変動した貯金総額を、設定保存で初期値へ**巻き戻さない**こと。
- **例外（初回サイクル中のみ）:** ユーザーが設定で「次の給料日まで使う予算」（`initial_budget`）を変更したとき、かつ保存前の `current_total_savings` が当時の `initial_total_assets - initial_budget` と一致している（＝まだオンボーディング時点の内訳のまま）場合に限り、`current_total_savings` を `initial_total_assets -`（新しい `initial_budget`）へ合わせてよい。それ以外の初回サイクル中の保存や通常サイクルでは上式で上書きしない。
- `current_total_savings` の更新経路は、**初回サイクル締め**、**特別支出**、**通常サイクル締め**（およびそれに準ずる資産変動ロジック）に限定する。`initial_total_assets` や `initial_budget` を編集する画面が将来追加される場合も、上記と同様に**貯金総額を初期化式で上書きしない**方針とする（別途「手動で貯金額を修正」する専用フローがない限り）。

---

## 5. UI/UX & PWA 設計

- **Design:** Apple風ミニマリズム。Navy (#001F3F) 主体。
- **Alert UI:** `remainingToday < 0` をトリガーに画面全体を赤系統に変更。
- **Dashboard（初回サイクル）:** 普通支出のみ入力可能。光熱費・特別支出トグルは非表示または無効化。要件定義書に記載の「初回サイクル用説明」テキストを表示。
- **Dashboard（通常サイクル）:** 普通支出 / 特別支出 / 光熱費のトグルを有効化。
- **Settings:** **月次貯金ノルマ**を表示フィールドとして追加。**編集不可**。**初回サイクル中は非表示**、**2回目以降の通常サイクルでのみ表示**。
- **楽観的UI更新:** 支出登録時、DBレスポンスを待たずにZustandストアを先行更新し、ゼロレイテンシ体験を実現する。失敗時はロールバック。
- **PWA:** `next-pwa` を導入。MVPではアセットキャッシュとホーム画面追加のみ。Service WorkerによるオフラインDBキューイングはV2。

---

## 6. テスト戦略

### 6.1 Unit Test（Vitest）

- `getLogicalDate()` の境界値テスト（JST 02:59 → 前日 / 03:00 → 当日）。
- **初回 vs 通常の分岐:** 同一カレンダー条件で `remainingCycleBudget` / `D_today` / `D_future` が期待どおり切り替わること。
- **初回サイクル:**  
  - 初回残り予算が `initial_budget -（初回開始日〜前日までの普通支出（内部 type = 'NORMAL'）合計）` になること。  
  - 初回サイクル中に光熱費・特別支出を登録しようとした場合に拒否されること（DB制約に頼らずアプリ層もテスト）。
- **初回サイクル締め:** 初回差額と `current_total_savings` の更新が要件どおりであり、**STRICT / YUTORI が適用されない**こと。
- **通常サイクル:** `D_today` / `D_future` の算出ロジック（残日数の境界、月またぎ）。**今日の残り**は当日の**普通支出**合計のみで減算し、光熱費差額・特別支出を `remainingToday` から直接減じないこと。
- 光熱費差額の予算反映計算（正負両方のケース）— **通常サイクルのみ**。
- 給料日算出の全パターン（土曜・日曜・祝日 × BEFORE / AFTER / FIXED）。
- 月末が存在しない給料日（31日が2月に設定された場合等）の補正。
- **通常サイクル**における STRICT / YUTORI の余剰金処理ロジック。
- **オンボーディング初回保存時のみ:** `current_total_savings === initial_total_assets - initial_budget` で初期化されること。
- **設定更新後:** 原則として `current_total_savings` が `initial_total_assets - initial_budget` に**無条件で再同期されない**こと（特別支出や締め処理の後で設定を変えても巻き戻らない）。初回サイクル中の「予算のみ変更」かつ内訳式が成立している場合の例外は API 実装に従う。
- **`initial_budget > initial_total_assets`:** validation error になること。
- **2回目以降の通常サイクル:** 給料日リセット時の余剰で STRICT / YUTORI が従来どおり適用されること（初回締めとの差分の回帰テスト）。

### 6.2 E2E Test（Playwright）

| シナリオ | 確認内容 |
|---|---|
| 1 | 支出入力後、残り予算・翌日以降予算のリアルタイム更新 |
| 2 | 27:00跨ぎのリセット・余剰金再分配（タイムトラベルテスト） |
| 3 | 特別支出による貯金総額の変動と月次ノルマへの影響（**通常サイクル**） |
| 4 | 光熱費（実額 < 概算 / 実額 > 概算）入力後の当月予算への即時反映（**通常サイクル**） |
| 5 | STRICT / YUTORI モードによる**通常サイクル**の給料日リセット後の挙動の差異 |
| 6 | 初回サイクル中は光熱費・特別支出が登録できない（UIまたはAPI） |
| 7 | 初回サイクル終了リセット後、通常サイクルのトグル・ノルマ表示が有効になる |

---

## 7. 開発ロードマップ（Cursor指示用）

| ステップ | 内容 |
|---|---|
| 1. Infrastructure | Supabase CLIのセットアップ、SQLマイグレーション初期化、Docker環境構築 |
| 2. Setup | Next.js + `@supabase/ssr` の初期設定、`date-fns-tz` 等の基盤整備、Vitest / Playwright のセットアップ |
| 3. Logic | 論理日付取得、給料日算出、**初回/通常のフェーズ判定**、予算再計算関数の実装（Vitestによるテスト先行） |
| 4. UI – Onboarding | 現在の全財産・次の給料日まで使う予算を含む全オンボーディング画面、`initial_total_assets` の保存 |
| 5. UI – Dashboard | テンキー入力・トグル（フェーズにより切替）・リアルタイム表示・翌日予算プレビュー・初回説明 |
| 6. UI – History / Settings | スワイプ削除・リアクティブな予算復元。設定は通常サイクル時のみ月次貯金ノルマ表示（読み取り専用）を含む |
| 7. Integration | CI/CD（GitHub Actions）の構築とCloud Runへの疎通 |
