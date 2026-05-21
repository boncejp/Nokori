/**
 * ダッシュボード・設定プレビュー共通の「今日の残り / 翌日以降」メトリクス算出。
 * 初回サイクルでは光熱費差額を当日残りに載せない（要件 §2.3）。
 */

import {
  applyUtilityDeltaToRemainingBudget,
  calculateDailyBudgetFuture,
  calculateDailyBudgetToday,
  calculateRemainingToday,
  type UtilityEstimateMap,
  type UtilityType,
} from "@/lib/logic/budget-logic";

export type DashboardPreviewTransaction = {
  readonly amount: number;
  readonly type: "NORMAL" | "SPECIAL";
  readonly utility_type: UtilityType | null;
};

export type DashboardCycleMetricsInput = {
  readonly remainingCycleBudget: number;
  readonly daysUntilNextPaydayIncludingToday: number;
  readonly daysUntilNextPaydayExcludingToday: number;
  readonly utilityEstimates: UtilityEstimateMap;
  readonly transactions: readonly DashboardPreviewTransaction[];
  readonly isFirstCycle: boolean;
};

export type DashboardCycleMetrics = {
  readonly dailyBudgetToday: number;
  readonly remainingToday: number;
  readonly futureDailyBudget: number;
  readonly todaySpentTotal: number;
  readonly todayNormalSpent: number;
  readonly utilityDeltaTotal: number;
  readonly isOverBudget: boolean;
};

/**
 * ダッシュボードと設定プレビューで共通の日次指標（D_today / D_future 相当）を算出する。
 */
export function calculateDashboardCycleMetrics(params: DashboardCycleMetricsInput): DashboardCycleMetrics {
  const {
    remainingCycleBudget,
    daysUntilNextPaydayIncludingToday,
    daysUntilNextPaydayExcludingToday,
    utilityEstimates,
    transactions,
    isFirstCycle,
  } = params;

  const todaySpentTotal = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const todayNormalSpent = transactions.reduce((sum, transaction) => {
    if (transaction.type === "NORMAL" && transaction.utility_type === null) {
      return sum + transaction.amount;
    }
    return sum;
  }, 0);
  const utilityDeltaTotal = transactions.reduce((sum, transaction) => {
    if (transaction.utility_type === null) {
      return sum;
    }
    const estimate = utilityEstimates[transaction.utility_type];
    return sum + (estimate - transaction.amount);
  }, 0);

  const dailyBudgetToday = calculateDailyBudgetToday({
    remainingCycleBudget,
    daysUntilNextPaydayIncludingToday,
  });
  const remainingToday = calculateRemainingToday({
    dailyBudgetToday,
    todaySpent: todayNormalSpent,
  });
  const remainingBudgetForFuture = isFirstCycle
    ? remainingCycleBudget
    : applyUtilityDeltaToRemainingBudget({
        remainingBudget: remainingCycleBudget,
        utilityDelta: utilityDeltaTotal,
      });
  const futureDailyBudget = calculateDailyBudgetFuture({
    remainingCycleBudget: remainingBudgetForFuture,
    todaySpent: todayNormalSpent,
    daysUntilNextPaydayExcludingToday,
  });

  return {
    dailyBudgetToday,
    remainingToday,
    futureDailyBudget,
    todaySpentTotal,
    todayNormalSpent,
    utilityDeltaTotal,
    isOverBudget: remainingToday < 0,
  };
}
