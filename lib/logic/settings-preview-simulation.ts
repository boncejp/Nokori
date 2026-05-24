import {
  calculateBaseCycleBudget,
  calculateCycleWindow,
  calculateMonthlySavingsQuota,
  calculateNormalCycleDailyProrationDayCounts,
  calculateNextRemainingCycleBudget,
  calculateTargetDateFromDuration,
  shouldMaskFutureDailyBudgetDisplay,
  type PaydayRule,
  type SurplusMode,
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
  /** 初回サイクル: initial_budget（オンボーディング入力値）。プレビューでも初回は initialBudget を使う。 */
  readonly initialBudgetDb: number;
  /** 通常サイクル YUTORI: 前サイクルから繰り越した額。プレビューは baseCycleBudget + yutoriCarryoverDb を母数にする。 */
  readonly yutoriCarryoverDb: number;
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
  readonly surplusMode: SurplusMode;
  readonly initialBudget: number;
};

export type SettingsBudgetPreviewResult =
  | {
      readonly status: "ok";
      readonly previewKind: "first";
      readonly dailyBudgetToday: number;
      readonly futureDailyBudget: number;
      readonly maskFutureDailyBudget: boolean;
    }
  | {
      readonly status: "ok";
      readonly previewKind: "normal";
      readonly dailyBudgetToday: number;
      readonly futureDailyBudget: number;
      readonly monthlySavingsQuota: number;
      readonly maskFutureDailyBudget: boolean;
    }
  | { readonly status: "unavailable" };

/**
 * 設定保存前プレビュー: 初回は `initial_budget` のみが日次に効く。
 * 通常は草案の収支・光熱費が反映され、日次の母数は STRICT では基準サイクル予算、
 * YUTORI では保存済み `initial_budget`（繰り越し込み）に合わせる。
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
        maskFutureDailyBudget: shouldMaskFutureDailyBudgetDisplay({
          daysUntilNextPaydayExcludingToday,
        }),
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

  let daysUntilNextPaydayIncludingToday: number;
  let daysUntilNextPaydayExcludingToday: number;
  try {
    // 日割りの分母は履歴・ダッシュと同じく「次の給料日前日」まで（給料日当日は含めない）。
    const cycleWindow = calculateCycleWindow({
      referenceDate: logicalToday,
      payday: draft.payday,
      paydayRule: draft.paydayRule,
    });
    const proration = calculateNormalCycleDailyProrationDayCounts({
      logicalToday,
      nextPaydayDate: cycleWindow.nextPaydayDate,
    });
    daysUntilNextPaydayIncludingToday = proration.daysIncludingToday;
    daysUntilNextPaydayExcludingToday = proration.daysExcludingToday;
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

  const remainingCycleBudget = calculateNextRemainingCycleBudget({
    isFirstCycle: false,
    surplusMode: draft.surplusMode,
    initialBudget: snapshot.initialBudgetDb,
    yutoriCarryover: snapshot.yutoriCarryoverDb,
    baseCycleBudget,
    confirmedNormalSpentBeforeToday: snapshot.confirmedNormalSpentBeforeToday,
  });

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
      maskFutureDailyBudget: shouldMaskFutureDailyBudgetDisplay({
        daysUntilNextPaydayExcludingToday,
      }),
    };
  } catch {
    return { status: "unavailable" };
  }
}
