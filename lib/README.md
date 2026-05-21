# `lib/` — アプリケーションコア

ポートフォリオ閲覧者向けの地図です。仕様の正本は `docs/requirements.md` / `docs/design.md` です。

## レイヤ構成

| ディレクトリ | 役割 |
|---|---|
| `constants/` | タイムゾーン・27:00 境界など不変の定数 |
| `types/` | ドメイン列挙・`Result` / `ValidationResult`・Supabase 生成型 |
| `logic/` | **純粋関数**のビジネスロジック（Vitest の主戦場） |
| `logic/budget/` | 予算・サイクル・論理日（`budget-logic.ts` から再エクスポート） |
| `supabase/` | DB アクセスのみ（RLS 経由、`select('*')` 禁止） |
| `stores/` | Zustand（ダッシュボードの楽観的 UI 更新） |
| `routing/` | 認証後の遷移先決定 |

## データの流れ（ダッシュボード）

1. Server Component（`app/(app)/dashboard/page.tsx`）が `resolveDashboardCycle` を呼ぶ
2. 給料日リセット・初回締め・確定支出集計のあと `remainingCycleBudget` を算出
3. クライアントの `useDashboardStore` に hydrate
4. 支出 POST は API → DB → ストアが楽観的更新 → `calculateDashboardCycleMetrics` で再計算

## 初回サイクル vs 通常サイクル

- 判定: `isWithinFirstCycle`（`logic/budget/first-cycle.ts`）
- 初回: `initial_budget` のみが日次の母数。光熱費・特別支出は API で拒否
- 通常: `calculateBaseCycleBudget` + YUTORI 繰越。光熱費差額は当月残りへ

## 変更時の注意

- `current_total_savings` はオンボ初回保存と資産変動ロジック以外で上書きしない
- 時刻は常に `Asia/Tokyo`。`date-fns` の `addMonths` / `endOfMonth` はサーバー TZ に依存するため給料日計算では使わない
