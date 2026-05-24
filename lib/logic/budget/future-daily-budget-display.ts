/**
 * ダッシュボード「翌日以降の目安予算（1日あたり）」の表示可否。
 * サイクル最終日（当日を除く残り日数 0）は、翌日から新サイクル／手取り確定前のため非表示とする。
 */

export function shouldMaskFutureDailyBudgetDisplay(params: {
  readonly daysUntilNextPaydayExcludingToday: number;
}): boolean {
  return params.daysUntilNextPaydayExcludingToday === 0;
}

export const FUTURE_DAILY_BUDGET_MASKED_LABEL = "—";

/** 設定画面・保存前プレビュー用 */
export const FUTURE_DAILY_BUDGET_MASKED_HINT_SETTINGS =
  "サイクル最終日のため、翌日以降の目安予算は給料日当日に手取り額を登録すると表示されます。";

/** ダッシュボード用 */
export const FUTURE_DAILY_BUDGET_MASKED_HINT_DASHBOARD =
  "サイクル最終日のため、翌日以降の目安予算は給料日当日に手取り額を入力すると表示されます。";
