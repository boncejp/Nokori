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
| `target_date` | date | 達成目標日 |
| `payday` | int | 給料日（1〜31） |
| `payday_rule` | enum ('BEFORE', 'AFTER', 'FIXED') | 土日祝の挙動 |
| `monthly_income` | int | 月収手取り概算 |
| `fixed_costs` | int | 固定費合計 |
| `estimated_electricity` | int | 電気代概算 |
| `estimated_gas` | int | ガス代概算 |
| `estimated_water` | int | 水道代概算 |
| `current_total_savings` | int | 現在の貯金総額 |
| `surplus_mode` | enum ('STRICT', 'YUTORI') | 月次サイクル余剰金の処理モード |
| `initial_budget` | int | オンボーディング時に手動入力した初回残り予算（第1サイクルのみ使用） |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

> 光熱費概算合計 = `estimated_electricity + estimated_gas + estimated_water`

### 2.2 transactions（支出履歴）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users.id) | |
| `amount` | int | 支出金額 |
| `memo` | text (nullable) | メモ |
| `type` | enum ('NORMAL', 'SPECIAL') | 通常支出 / 特別支出（貯金から差引） |
| `utility_type` | enum ('ELECTRICITY', 'GAS', 'WATER') nullable | null = 光熱費以外。非null = 光熱費の種別 |
| `logical_date` | date | 27:00ルール適用後の論理日付（JST）。INSERT時にアプリ層で算出して保存 |
| `created_at` | timestamptz | 実際の入力時刻（UTC、Supabaseデフォルト） |

> **型の組み合わせ制約:** `type = 'SPECIAL'` かつ `utility_type IS NOT NULL` の組み合わせはアプリ層で禁止する（光熱費は貯金から直接差し引く性質を持たない）。

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

```typescript
// 当日予算（サイクル開始時に確定）
const D_today = remainingCycleBudget / daysUntilNextPayday({ includeToday: true });

// 今日の残り（リアルタイム。支出登録のたびに更新）
const remainingToday = D_today - sumOfTodayTransactions;

// 翌日以降の予測日次予算（リアルタイム。支出登録のたびに更新）
const D_future = (remainingCycleBudget - sumOfTodayTransactions)
  / daysUntilNextPayday({ includeToday: false });
```

- `remainingCycleBudget`: 初回は `profiles.initial_budget`、2回目以降は `月収 - 固定費 - 光熱費概算合計 - 月次貯金ノルマ - 前日までの確定支出合計`
- 支出登録のたびに `remainingToday` と `D_future` の両方をZustandストアで即時更新し、UIに反映する。

### 4.3 光熱費の予算反映

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

差額は当月残り予算に即時反映し、`D_future` を再計算する。

### 4.4 月次サイクル余剰金処理（STRICT / YUTORI）

給料日リセット時に実行する。

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

### 4.5 給料日算出と祝日判定

- `profiles.payday_rule` に基づき、次回の給料日を動的に算出する。
- 土日および `@holiday-jp/holiday_jp` で判定される日本の祝日と被った場合、BEFORE（前倒し）/ AFTER（後ろ倒し）/ FIXED（そのまま）のルールに従って補正する。
- 給料日の数値（例：31）が当月に存在しない場合（2月等）は、当月の最終日を採用する。

---

## 5. UI/UX & PWA 設計

- **Design:** Apple風ミニマリズム。Navy (#001F3F) 主体。
- **Alert UI:** `remainingToday < 0` をトリガーに画面全体を赤系統に変更。
- **楽観的UI更新:** 支出登録時、DBレスポンスを待たずにZustandストアを先行更新し、ゼロレイテンシ体験を実現する。失敗時はロールバック。
- **PWA:** `next-pwa` を導入。MVPではアセットキャッシュとホーム画面追加のみ。Service WorkerによるオフラインDBキューイングはV2。

---

## 6. テスト戦略

### 6.1 Unit Test（Vitest）

- `getLogicalDate()` の境界値テスト（JST 02:59 → 前日 / 03:00 → 当日）。
- `D_today` / `D_future` の算出ロジック（残日数の境界、月またぎ）。
- 光熱費差額の予算反映計算（正負両方のケース）。
- 給料日算出の全パターン（土曜・日曜・祝日 × BEFORE / AFTER / FIXED）。
- 月末が存在しない給料日（31日が2月に設定された場合等）の補正。
- STRICT / YUTORI モードの余剰金処理ロジック。

### 6.2 E2E Test（Playwright）

| シナリオ | 確認内容 |
|---|---|
| 1 | 支出入力後、残り予算・翌日以降予算のリアルタイム更新 |
| 2 | 27:00跨ぎのリセット・余剰金再分配（タイムトラベルテスト） |
| 3 | 特別支出による貯金総額の変動と月次ノルマへの影響 |
| 4 | 光熱費（実額 < 概算 / 実額 > 概算）入力後の当月予算への即時反映 |
| 5 | STRICT / YUTORI モードによる給料日リセット後の挙動の差異 |

---

## 7. 開発ロードマップ（Cursor指示用）

| ステップ | 内容 |
|---|---|
| 1. Infrastructure | Supabase CLIのセットアップ、SQLマイグレーション初期化、Docker環境構築 |
| 2. Setup | Next.js + `@supabase/ssr` の初期設定、`date-fns-tz` 等の基盤整備、Vitest / Playwright のセットアップ |
| 3. Logic | 論理日付取得、給料日算出、予算再計算関数の実装（Vitestによるテスト先行） |
| 4. UI – Onboarding | 初回予算入力ステップを含む全オンボーディング画面 |
| 5. UI – Dashboard | テンキー入力・トグルスイッチ・リアルタイム表示・翌日予算プレビュー |
| 6. UI – History | スワイプ削除・リアクティブな予算復元 |
| 7. Integration | CI/CD（GitHub Actions）の構築とCloud Runへの疎通 |
