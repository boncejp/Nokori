/**
 * ダッシュボード「翌日以降の目安（1日あたり）」の表示可否。
 * サイクル最終日（当日を除く残り日数 0）は、翌日から新サイクル／手取り確定前のため非表示とする。
 */

export function shouldMaskFutureDailyBudgetDisplay(params: {
  readonly daysUntilNextPaydayExcludingToday: number;
}): boolean {
  return params.daysUntilNextPaydayExcludingToday === 0;
}

export const FUTURE_DAILY_BUDGET_MASKED_LABEL = "—";
