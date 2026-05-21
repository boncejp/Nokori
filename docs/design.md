# 基本設計書：Nokori v2.0

## 1. システムアーキテクチャ & 技術スタック

| 領域 | 採用技術 |
|---|---|
| Frontend / Backend | Next.js 16+ (App Router), TypeScript |
| State Management | Zustand |
| Database | Supabase (PostgreSQL) |
| DB Client | `@supabase/ssr`（Next.js App Router対応） |
| Schema / Migration | Supabase CLI（`supabase/migrations` の SQL を管理。ランタイムの DB がローカルとは限らない） |
| 型生成 | `supabase gen types typescript` |
| Infrastructure | Vercel（Next.js の本番ホスティング）、Docker（ローカル開発および将来のコンテナビルド検証用）。GCP（Cloud Run 等）は工数を抑えた先行リリース後の**移行候補**（§3.4）。 |
| CI/CD | **現状の本番:** Vercel の Git 連携によるビルド・デプロイ（必要に応じ PR 用プレビュー環境）。**補助:** GitHub Actions で PR 時の Lint / 型チェック / テスト等を回す構成を想定しているが、リポジトリへのワークフロー配置は未着手（§3.5）。 |
| Unit Test | Vitest |
| E2E / Integration Test | Playwright（**未導入・今後実装**。§6.2 は実装後の想定） |
| Date & Time | `date-fns` + `date-fns-tz`（常に `Asia/Tokyo` 基準） |
| Holiday Calculation | `@holiday-jp/holiday_jp` |

> **Prismaは使用しない。** Supabase CLI で `supabase/migrations` を管理し、`supabase gen types typescript`（リンク済みプロジェクト向けは `--linked`）で型生成する。開発・検証の**接続先 DB はクラウド上の Supabase が主**であり、CLI はローカル DB（`supabase start`）を必須にはしない。これにより RLS がランタイムの DB 操作を確実に通過する。

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
| `monthly_income` | int | 月収手取り概算。オンボ初回保存では **0** とし、通常サイクル以降は給料日モーダルや設定で更新する |
| `fixed_costs` | int | 固定費合計 |
| `estimated_electricity` | int | 電気代概算 |
| `estimated_gas` | int | ガス代概算 |
| `estimated_water` | int | 水道代概算 |
| `initial_total_assets` | int | オンボーディング時点の**現在の全財産**（要件定義書の用語に一致） |
| `current_total_savings` | int | **貯金総額（資産側）**。**オンボーディング初回保存時のみ** `initial_total_assets - initial_budget` で初期化する（§4.8）。設定更新のたびにこの式で上書きしない |
| `surplus_mode` | enum ('STRICT', 'YUTORI') | **通常サイクル（2回目以降）**の月次余剰金処理モード。初回サイクル締めでは使わない |
| `initial_budget` | int | **初回サイクル専用。** ユーザー入力の「次の給料日まで使う予算」。初回サイクル締めでのみ参照する。通常サイクルの予算計算には使わない。 |
| `yutori_carryover` | int | **通常サイクル YUTORI 用の繰り越し額。** 前サイクルの余剰金。STRICT リセット・初回サイクル締め時は 0 にリセット。通常サイクルの日次予算母数 = `baseCycleBudget + yutori_carryover`（STRICT では `yutori_carryover` を 0 として計算）。設定 PATCH では上書きしない。 |
| `last_monthly_reset_logical_date` | date nullable | 直近の月次リセット実行日（冪等性用） |
| `last_salary_cycle_logical_date` | date nullable | 手取り給料を最後に確定したサイクル開始日（給料日＝論理日の当日モーダル制御用） |
| `start_concept_completed_at` | timestamptz nullable | 初回コンセプト画面（`/start`）完了時刻。NULL の間はメイン `(app)` へ入場前に同画面へ誘導する |
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
- **ランタイムの接続先:** 開発・検証では **クラウド上の Supabase プロジェクト**を主とする（Google OAuth の都合など）。**Supabase CLI** は `supabase link` / `supabase db push`、型生成、**任意**のローカル DB（`supabase start`）など**ツールチェーン**として使い、docker-compose の Next コンテナとは役割が異なる。

MVP の本番は **Vercel を第一選択**とし、必ずしもこの Docker イメージを **Cloud Run で稼働させる前提ではない**（先行リリースと運用工数の削減を優先）。コンテナはローカルや将来の GCP 移行検討時の再現性確保に使う。

### 3.2 認証・OAuth 運用メモ

- **プロバイダ（MVP）:** Supabase Auth で **Google** のみを有効化する（ダッシュボード **Authentication → Providers**）。**Email**（マジックリンク / OTP）はアプリから提供しないため **無効化** する。クラウドの既定メール送信には厳しいレート制限があり、本番 UX を損ねるため。
- **メール認証の再導入（将来）:** 独自ドメイン取得後、Resend / SendGrid 等の **Custom SMTP** を Supabase に設定し、Email プロバイダを再有効化する。アプリは `/auth/callback` の PKCE（`code`）フローをそのまま利用できる想定（`signInWithOtp` の UI をログイン画面に戻す）。
- **Supabase 側 URL:** **Authentication → URL Configuration** で **Site URL**（本番アプリのオリジン）と **Redirect URLs**（ログイン後に許可するオリジン一覧）を登録する。ここに無いオリジンからの OAuth は失敗する。
- **登録例（Redirect URLs に含める想定のパターン）**
  - ローカル: `http://localhost:3000/**` や、アプリ実装に合わせたコールバックパス（例: `http://localhost:3000/auth/callback` など。実際のルートに合わせる）。
  - Vercel 本番: `https://<production-domain>/**` および必要ならコールバックパス単位の URL。
  - Vercel **Preview**: プレビュー URL はブランチごとに変わる。Supabase が **ワイルドカードを許容しない**場合は、プレビューごとに Redirect URL を追加するか、検証用に固定のプレビュー環境を用意するなど、**Supabase の制約に従った運用**とする（詳細は Supabase 公式ドキュメントの Authentication / Redirect URLs を参照）。
- **Google Cloud Console（OAuth クライアント）:** **承認済みのリダイレクト URI** に、Supabase が案内する **OAuth コールバック URL**（`https://<project-ref>.supabase.co/auth/v1/callback` 形式）を含める。ここをアプリの `localhost` のみにしてしまうと、Google → Supabase のコールバックで失敗する。**アプリのオリジン**は主に Supabase の Site URL / Redirect URLs 側で許可し、Google 側は **Supabase のコールバック**を受け皿にする、という対応関係を誤らないこと。

上記はいずれも **RLS 前提の anon キー利用**や「**service_role は通常 CRUD に使わない**」という既存方針と矛盾しない（OAuth は Auth のフロー設定の話である）。

#### 初回ウェルカムと `user_welcome`

- **目的:** プロフィール作成前のユーザーに、**コンセプトのみ**を伝える `/welcome` を一度だけ挟み、「新しいアプリを始める」体験を整える。運用説明やヘルプ本文は本画面では扱わず、従来どおりアプリ内ヘルプ等に任せる。
- **遷移:** ログイン済みで `profiles` が未作成のとき、`public.user_welcome` に行が**ない**場合は `/welcome` へ。CTA で `POST /api/welcome/complete` が `user_welcome` へ UPSERT（`completed_at`）したあと `/onboarding` へ進む。**行がある**（ウェルカム済み）なら従来どおり `/onboarding` のみ。`profiles` が存在し**かつ**初回コンセプト（後述の `/start`）も完了済みのユーザーは `/welcome` を経由しない。直接 URL を開いた場合のすり抜けは、サーバー側で `/welcome` と `/onboarding` の双方から相互にリダイレクトして防ぐ（無限ループにならないよう、条件は「プロフィール有無」と「`user_welcome` の有無」で排他的に決める）。
- **テーブル `public.user_welcome`:** `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`、`completed_at timestamptz NOT NULL DEFAULT now()`。**未完了は行なし**、完了で INSERT/UPSERT とする。RLS は `user_id = auth.uid()` のみ SELECT/INSERT/UPDATE 可（`profiles` と同様の方針）。

#### 初回コンセプト（`/start`）と `profiles.start_concept_completed_at`

- **位置づけ:** オンボーディング保存直後〜メインの `(app)` ダッシュボードに入る前の**一度きり**の全画面。`/welcome` と同系のトーン（CSS アニメ・`prefers-reduced-motion` 対応）で、サイクル・初回日割り・日々の入力の勧めなど**コンセプト詳細**を短く伝える。完了は `profiles.start_concept_completed_at`（nullable timestamptz）に PATCH 記録し、`(app)/layout.tsx` と `resolvePostAuthLandingPath` で **NULL のあいだは `/dashboard` 等へ入れず `/start` へ寄せる**（直リンク対策）。CTA は `POST /api/start-concept/complete`（冪等な更新）。専用テーブルは設けない（この段階では `profiles` 行が必ず存在するため）。

### 3.3 Vercel 本番デプロイ（MVP）

- **ホスティング:** Vercel 上で Next.js アプリをビルド・配信する。ホスト型 Supabase（PostgreSQL / Auth）へは、クライアント・サーバー双方から既存どおり HTTPS 経由で接続する。
- **環境変数:** 本番・プレビューごとに Vercel の **Project Settings → Environment Variables** で設定する。変数名・意味・値の取得元の一覧は **§3.3.1** を参照（`.env.example` と対応）。
- **ブランチ戦略（例）:** `main` を Production に紐づけ、PR はプレビューデプロイで検証する（運用に合わせて調整可）。
- **ビルド:** リポジトリの `package.json` に従い、`npm run build`（`next build`）をビルドコマンドとする想定。
- **OAuth:** 本番・プレビューごとに §3.2 の Redirect URLs を Supabase 側で維持する。Vercel の Environment に設定するのは主に Supabase の URL / キーであり、Google の Client Secret は Supabase プロバイダ設定に任せる構成を想定する（実装に合わせて調整）。

#### 3.3.1 環境変数一覧（ローカル・Vercel 共通の名前と取得元）

**GitHub の Issue・PR・コミット本文に、実キーや本番 URL の具体値を貼らないでください。** 共有が必要な場合はプレースホルダ（例: `your-anon-key`）か、パスワードマネージャ等の社外秘匿チャネルを使います。

| 変数名 | 意味 | 値の取得元 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトの API オリジン（`https://<project-ref>.supabase.co` 形式） | Supabase ダッシュボード → **Project Settings** → **API** → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開 anon キー。ブラウザからのリクエストでも RLS が適用されるクライアント用 | 同上 → **Project API keys** の **anon** / **public**（Reveal で表示） |
| `SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー。**RLS をバイパスする**ため、サーバー専用の限定的な管理用途のみ。ユーザーの通常 CRUD には使わない方針 | 同上 → **service_role**（Reveal。取り扱い厳重に） |

ローカルで `supabase start` を使う場合は、`supabase status` に表示される API URL と各キーを `.env` に転記する（クラウド値の代わりに差し替え）。README のセットアップ手順の入口はリポジトリ直下の `README.md` です。

### 3.4 GCP への移行（検討・Backlog）

工数とリリース速度を優先し、**いつ実施するかは未決定**とする。以下は将来、トラフィック・コスト・コンプライアンス等の理由で Vercel から移す場合の**候補構成メモ**であり、MVP の前提ではない。

- **Platform:** Google Cloud Run
- **Container Registry:** Artifact Registry
- **Secret Management:** Secret Manager（Supabase の API キー、接続情報の管理）
- **Networking:** Cloud Run からホスト型 Supabase インスタンスへ接続。

### 3.5 CI/CD パイプライン

**本番デプロイ**は Vercel の Git 連携に任せ、main（または既定の本番ブランチ）へのマージで Production ビルドが走る想定とする。

**GitHub Actions**（現リポジトリにはワークフローファイルはまだない）は、PR 品質のための補助線として次を**導入予定**とする。Deploy ジョブで Cloud Run に載せ替える前提は置かない。

| ジョブ | トリガー | 内容 |
|---|---|---|
| Lint & Type Check | PR作成時 | ESLint + `tsc`（プロジェクト方針に合わせて整備） |
| Unit Test（Vitest） | PR作成時 | コアロジックの単体テスト |
| E2E Test（Playwright） | PR作成時 | JSTタイムゾーン指定環境で実行（Playwright 導入後。未導入時は省略可） |
| Deploy（本番） | main マージ時 | **Vercel が自動実行**（Git 連携。Docker イメージ → Cloud Run ではない） |

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

- `remainingCycleBudget`（通常サイクル）: **STRICT** では基準サイクル予算（月収 − 固定費 − 光熱費概算 − 月次貯金ノルマ）から、前日までの確定済み**普通支出**（内部 `type = 'NORMAL'`）に加え光熱費実額との差額調整（§4.3）を織り込んだ残りを母数とする。**YUTORI** では `baseCycleBudget + yutori_carryover`（繰り越し込み）から同様に差し引く（`yutori_carryover` は §4.5 の月次リセットで設定される）。いずれも**特別支出**（内部 `type = 'SPECIAL'`）の金額は母数に含めない。`utilityDeltaTotal` は上式のとおり分子側で併記し、二重計上にならないよう実装で単一ソースに集約する。
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
    yutori_carryover: 0, // 初回サイクル締めには繰り越しは発生しない
    // initial_budget は通常サイクルの計算に使わないため更新しない
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
  if (surplus <= 0) {
    // 余剰なし（赤字または収支トントン）: 繰り越しをゼロにリセット
    return { yutori_carryover: 0 };
  }

  if (profile.surplus_mode === 'STRICT') {
    // 余剰金を全額貯金に追加。繰り越しは発生しない。
    return { current_total_savings: profile.current_total_savings + surplus, yutori_carryover: 0 };
  }

  // YUTORI: 余剰金を繰り越し額として保持。貯金総額は変更しない。
  // 次サイクルの母数: baseCycleBudget + yutori_carryover
  return { yutori_carryover: surplus };
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
- **Welcome（初回のみ）:** ログイン後・オンボーディング前の `/welcome`。プロダクトコンセプトの短いコピーとリッチな（CSS ベースの）入場アニメーション。完了状態は `user_welcome` に永続化し、再ログインでは表示しない。
- **Start concept（初回のみ）:** オンボーディング完了直後の `/start`。運用イメージ（サイクル・初回日割り・入力の勧め）を少し踏み込んで伝え、完了は `profiles.start_concept_completed_at` に記録する。画面下部に PWA / ホーム画面追加の短い案内を置く（過度なモーダルは避ける）。
- **Alert UI:** `remainingToday < 0`（今日の残り予算が 0 未満）をトリガーに、**「今日の残り予算」の表示**と短い警告文を赤系で強調する。レイアウト全体を赤系のテーマや背景で覆い替える要件ではない（当該表示に限定。要件定義書 §3.2 と整合）。
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

**Playwright は現リポジトリに未導入。** 以下は実装後の E2E 方針とする。

| シナリオ | 確認内容 |
|---|---|
| 1 | 支出入力後、残り予算・翌日以降予算のリアルタイム更新 |
| 2 | 27:00跨ぎのリセット・余剰金再分配（タイムトラベルテスト） |
| 3 | 特別支出による貯金総額の変動と月次ノルマへの影響（**通常サイクル**） |
| 4 | 光熱費（実額 < 概算 / 実額 > 概算）入力後の **このサイクル（給料周期）の残り予算** への即時反映（**通常サイクル**） |
| 5 | STRICT / YUTORI モードによる**通常サイクル**の給料日リセット後の挙動の差異 |
| 6 | 初回サイクル中は光熱費・特別支出が登録できない（UIまたはAPI） |
| 7 | 初回サイクル終了リセット後、通常サイクルのトグル・ノルマ表示が有効になる |

---

## 7. 開発ロードマップ（Cursor指示用）

- **Cursor / エージェント:** ユーザーから明示的な依頼がない限り `git commit` は行わない（コミットは人間が行う）。

| ステップ | 内容 |
|---|---|
| 1. Infrastructure | Supabase CLIのセットアップ、SQLマイグレーション初期化、Docker環境構築 |
| 2. Setup | Next.js + `@supabase/ssr` の初期設定、`date-fns-tz` 等の基盤整備、Vitest / Playwright のセットアップ |
| 3. Logic | 論理日付取得、給料日算出、**初回/通常のフェーズ判定**、予算再計算関数の実装（Vitestによるテスト先行） |
| 4. UI – Onboarding | 現在の全財産・次の給料日まで使う予算を含む全オンボーディング画面（手取りは含めない）、`initial_total_assets` の保存。`monthly_income` は初回 0 |
| 5. UI – Dashboard | 金額入力は **現状（MVP）** テキスト系（`inputMode="numeric"` 等）の数値入力。**専用テンキー UI** は将来オプションとして検討。トグル（フェーズにより切替）・リアルタイム表示・翌日予算プレビュー・初回説明 |
| 6. UI – History / Settings | スワイプ削除・リアクティブな予算復元。設定は通常サイクル時のみ月次貯金ノルマ表示（読み取り専用）を含む |
| 7. Integration | Vercel への本番接続（環境変数・Supabase 疎通・本番ブランチでのビルド確認）。GitHub Actions は PR の Lint / テスト等を必要に応じ追加。GCP（Cloud Run）への移行は別フェーズで検討 |
