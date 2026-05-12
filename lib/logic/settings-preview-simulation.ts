import {
  calculateBaseCycleBudget,
  calculateDaysUntilNextPayday,
  calculateMonthlySavingsQuota,
  calculateNextPayday,
  calculateTargetDateFromDuration,
  type PaydayRule,
  type UtilityEstimateMap,
} from "@/lib/logic/budget-logic";
import {
  calculateDashboardCycleMetrics,
  type DashboardPreviewTransaction,
} from "@/lib/logic/dashboard-cycle-metrics";

export type SettingsPreviewSnapshotSlice = {
  readonly confirmedNormalSpentBeforeToday: number;
  readonly todayTransactions: readonly DashboardPreviewTransaction[];
  readonly utilityEstimatesDb: UtilityEstimateMap;
};

export type SettingsBudgetPreviewDraft = {
  readonly targetAmount: number;
  readonly targetDurationMonths: number;
  readonly monthlyIncome: number;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
  readonly fixedCosts: number;
  readonly estimatedElectricity: number;
  readonly estimatedGas: number;
  readonly estimatedWater: number;
  readonly initialBudget: number;
};

export type SettingsBudgetPreviewResult =
  | {
      readonly status: "ok";
      readonly dailyBudgetToday: number;
      readonly futureDailyBudget: number;
      readonly monthlySavingsQuota: number;
    }
  | { readonly status: "unavailable" };

/**
 * 設定保存前プレビュー: 初回は initial_budget のみが日次に効き、通常は surplus_mode / initial_budget を除く草案が反映される。
 */
export function calculateSettingsBudgetPreview(params: {
  readonly previewKind: "first" | "normal";
  readonly logicalToday: Date;
  readonly anchorLogicalDate: Date;
  readonly currentTotalSavingsDb: number;
  readonly snapshot: SettingsPreviewSnapshotSlice;
  readonly firstCycleCalendar: {
    readonly daysUntilNextPaydayIncludingToday: number;
    readonly daysUntilNextPaydayExcludingToday: number;
  } | null;
  readonly draft: SettingsBudgetPreviewDraft;
}): SettingsBudgetPreviewResult {
  const { previewKind, logicalToday, anchorLogicalDate, currentTotalSavingsDb, snapshot, firstCycleCalendar, draft } =
    params;

  let targetDate: Date;
  try {
    targetDate = calculateTargetDateFromDuration({
      anchorLogicalDate,
      durationMonths: draft.targetDurationMonths,
      payday: draft.payday,
      paydayRule: draft.paydayRule,
    });
  } catch {
    return { status: "unavailable" };
  }

  const monthlySavingsQuota = calculateMonthlySavingsQuota({
    targetAmount: draft.targetAmount,
    currentTotalSavings: currentTotalSavingsDb,
    targetDate,
    referenceDate: logicalToday,
  });

  let daysUntilNextPaydayIncludingToday: number;
  let daysUntilNextPaydayExcludingToday: number;

  if (previewKind === "first") {
    if (firstCycleCalendar === null) {
      return { status: "unavailable" };
    }
    daysUntilNextPaydayIncludingToday = firstCycleCalendar.daysUntilNextPaydayIncludingToday;
    daysUntilNextPaydayExcludingToday = firstCycleCalendar.daysUntilNextPaydayExcludingToday;
  } else {
    let nextPayday: Date;
    try {
      nextPayday = calculateNextPayday({
        fromDate: logicalToday,
        payday: draft.payday,
        paydayRule: draft.paydayRule,
      });
      daysUntilNextPaydayIncludingToday = calculateDaysUntilNextPayday({
        fromDate: logicalToday,
        nextPayday,
        includeToday: true,
      });
      daysUntilNextPaydayExcludingToday = calculateDaysUntilNextPayday({
        fromDate: logicalToday,
        nextPayday,
        includeToday: false,
      });
    } catch {
      return { status: "unavailable" };
    }
  }

  if (daysUntilNextPaydayIncludingToday <= 0) {
    return { status: "unavailable" };
  }

  const baseCycleBudget = calculateBaseCycleBudget({
    monthlyIncome: draft.monthlyIncome,
    fixedCosts: draft.fixedCosts,
    estimatedElectricity: draft.estimatedElectricity,
    estimatedGas: draft.estimatedGas,
    estimatedWater: draft.estimatedWater,
    monthlySavingsQuota,
  });

  const remainingCycleBudget =
    previewKind === "first"
      ? draft.initialBudget - snapshot.confirmedNormalSpentBeforeToday
      : baseCycleBudget - snapshot.confirmedNormalSpentBeforeToday;

  const utilityEstimatesForPreview: UtilityEstimateMap =
    previewKind === "first"
      ? snapshot.utilityEstimatesDb
      : {
          ELECTRICITY: draft.estimatedElectricity,
          GAS: draft.estimatedGas,
          WATER: draft.estimatedWater,
        };

  try {
    const metrics = calculateDashboardCycleMetrics({
      remainingCycleBudget,
      daysUntilNextPaydayIncludingToday,
      daysUntilNextPaydayExcludingToday,
      utilityEstimates: utilityEstimatesForPreview,
      transactions: snapshot.todayTransactions,
      isFirstCycle: previewKind === "first",
    });

    return {
      status: "ok",
      dailyBudgetToday: metrics.dailyBudgetToday,
      futureDailyBudget: metrics.futureDailyBudget,
      monthlySavingsQuota,
    };
  } catch {
    return { status: "unavailable" };
  }
}
