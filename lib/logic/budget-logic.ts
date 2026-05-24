/**
 * 予算・サイクル・論理日のドメインロジック（純粋関数）。
 *
 * 実装は `lib/logic/budget/` 配下に関心ごと別ファイルで分割している。
 * 既存の import 互換のため、このファイルからすべて再エクスポートする。
 *
 * 参照: docs/requirements.md §2 / docs/design.md §4
 */

export { RESET_HOUR, TIMEZONE } from "@/lib/constants/time";
export type {
  PaydayRule,
  SurplusMode,
  TransactionAmountRow,
  UtilityEstimateMap,
  UtilityType,
} from "@/lib/types/domain";

export {
  getLogicalDate,
  parseJstDateKeyToDate,
  toJstDateString,
  toJstStartOfDay,
} from "@/lib/logic/budget/jst-dates";

export {
  calculateCycleWindow,
  calculateNextPayday,
  calculateTargetDateFromDuration,
} from "@/lib/logic/budget/payday";

export {
  calculateDailyBudgetFuture,
  calculateDailyBudgetToday,
  calculateDaysUntilNextPayday,
  calculateRemainingToday,
} from "@/lib/logic/budget/daily-budget";

export {
  FUTURE_DAILY_BUDGET_MASKED_HINT_DASHBOARD,
  FUTURE_DAILY_BUDGET_MASKED_HINT_SETTINGS,
  FUTURE_DAILY_BUDGET_MASKED_LABEL,
  shouldMaskFutureDailyBudgetDisplay,
} from "@/lib/logic/budget/future-daily-budget-display";

export {
  applyUtilityDeltaToRemainingBudget,
  calculateUtilityBudgetDelta,
} from "@/lib/logic/budget/utility-budget";

export {
  calculateBaseCycleBudget,
  calculateMonthlySavingsQuota,
  calculateNextRemainingCycleBudget,
  calculateRemainingMonthsToTarget,
} from "@/lib/logic/budget/savings-and-cycle-budget";

export {
  processFirstCycleClose,
  processMonthlyReset,
  shouldExecuteMonthlyReset,
} from "@/lib/logic/budget/monthly-reset";

export {
  calculateYutoriCarryoverDisplay,
  isFirstCycleInitialBudgetExceedingTotalAssets,
  resolveCurrentTotalSavingsForProfileSettingsUpdate,
  resolveInitialBudgetForSettingsUpdate,
} from "@/lib/logic/budget/profile-settings";

export {
  calculateConfirmedNormalSpentWithUtilityAdjustment,
  sumPlainNormalExpenseAmounts,
} from "@/lib/logic/budget/transaction-aggregates";

export {
  calculateFirstCycleDailyProrationDayCounts,
  getFirstCycleEndLogicalDate,
  isWithinFirstCycle,
} from "@/lib/logic/budget/first-cycle";

export {
  calculateNormalCycleDailyProrationDayCounts,
  getNormalCycleListingEndLogicalDate,
} from "@/lib/logic/budget/normal-cycle-proration";

export { getHistoryListingLogicalDateRange } from "@/lib/logic/budget/history-range";
