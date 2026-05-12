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
      readonly previewKind: "first";
      readonly dailyBudgetToday: number;
      readonly futureDailyBudget: number;
    }
  | {
      readonly status: "ok";
      readonly previewKind: "normal";
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

  if (previewKind === "first") {
    if (firstCycleCalendar === null) {
      return { status: "unavailable" };
    }
    const { daysUntilNextPaydayIncludingToday, daysUntilNextPaydayExcludingToday } = firstCycleCalendar;
    if (daysUntilNextPaydayIncludingToday <= 0) {
      return { status: "unavailable" };
    }

    const remainingCycleBudget = draft.initialBudget - snapshot.confirmedNormalSpentBeforeToday;
    const utilityEstimatesForPreview: UtilityEstimateMap = snapshot.utilityEstimatesDb;

    try {
      const metrics = calculateDashboardCycleMetrics({
        remainingCycleBudget,
        daysUntilNextPaydayIncludingToday,
        daysUntilNextPaydayExcludingToday,
        utilityEstimates: utilityEstimatesForPreview,
        transactions: snapshot.todayTransactions,
        isFirstCycle: true,
      });

      return {
        status: "ok",
        previewKind: "first",
        dailyBudgetToday: metrics.dailyBudgetToday,
        futureDailyBudget: metrics.futureDailyBudget,
      };
    } catch {
      return { status: "unavailable" };
    }
  }

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

  let nextPayday: Date;
  let daysUntilNextPaydayIncludingToday: number;
  let daysUntilNextPaydayExcludingToday: number;
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

  const remainingCycleBudget = baseCycleBudget - snapshot.confirmedNormalSpentBeforeToday;

  const utilityEstimatesForPreview: UtilityEstimateMap = {
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
      isFirstCycle: false,
    });

    return {
      status: "ok",
      previewKind: "normal",
      dailyBudgetToday: metrics.dailyBudgetToday,
      futureDailyBudget: metrics.futureDailyBudget,
      monthlySavingsQuota,
    };
  } catch {
    return { status: "unavailable" };
  }
}
