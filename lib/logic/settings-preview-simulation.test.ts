import { describe, expect, it, vi } from "vitest";

import * as budgetLogic from "./budget-logic";

import { calculateSettingsBudgetPreview } from "./settings-preview-simulation";

const EMPTY_SNAPSHOT = {
  confirmedNormalSpentBeforeToday: 10_000,
  todayTransactions: [],
  utilityEstimatesDb: {
    ELECTRICITY: 5_000,
    GAS: 5_000,
    WATER: 5_000,
  },
  initialBudgetDb: 100_000,
  yutoriCarryoverDb: 0,
} as const;

describe("calculateSettingsBudgetPreview", () => {
  it("初回サイクルでは initial_budget を変えると当日・翌日以降プレビューが変わる", () => {
    const logicalToday = budgetLogic.parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = budgetLogic.parseJstDateKeyToDate("2026-05-01");

    const low = calculateSettingsBudgetPreview({
      previewKind: "first",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 400_000,
      snapshot: EMPTY_SNAPSHOT,
      firstCycleCalendar: {
        daysUntilNextPaydayIncludingToday: 10,
        daysUntilNextPaydayExcludingToday: 9,
      },
      draft: {
        targetAmount: 2_000_000,
        targetDurationMonths: 12,
        monthlyIncome: 350_000,
        payday: 25,
        paydayRule: "FIXED",
        fixedCosts: 120_000,
        estimatedElectricity: 5_000,
        estimatedGas: 5_000,
        estimatedWater: 5_000,
        surplusMode: "STRICT",
        initialBudget: 50_000,
      },
    });

    const high = calculateSettingsBudgetPreview({
      previewKind: "first",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 400_000,
      snapshot: EMPTY_SNAPSHOT,
      firstCycleCalendar: {
        daysUntilNextPaydayIncludingToday: 10,
        daysUntilNextPaydayExcludingToday: 9,
      },
      draft: {
        targetAmount: 2_000_000,
        targetDurationMonths: 12,
        monthlyIncome: 350_000,
        payday: 25,
        paydayRule: "FIXED",
        fixedCosts: 120_000,
        estimatedElectricity: 5_000,
        estimatedGas: 5_000,
        estimatedWater: 5_000,
        surplusMode: "STRICT",
        initialBudget: 80_000,
      },
    });

    expect(low.status).toBe("ok");
    expect(high.status).toBe("ok");
    if (low.status !== "ok" || high.status !== "ok") {
      return;
    }

    expect(low.previewKind).toBe("first");
    expect(high.previewKind).toBe("first");
    expect(low.dailyBudgetToday).toBe(4_000);
    expect(high.dailyBudgetToday).toBe(7_000);
  });

  it("初回サイクルでは fixed_costs を変えても日次プレビューは変わらない（ノルマも目標・期間が同じなら同じ）", () => {
    const logicalToday = budgetLogic.parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = budgetLogic.parseJstDateKeyToDate("2026-05-01");

    const a = calculateSettingsBudgetPreview({
      previewKind: "first",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 400_000,
      snapshot: EMPTY_SNAPSHOT,
      firstCycleCalendar: {
        daysUntilNextPaydayIncludingToday: 10,
        daysUntilNextPaydayExcludingToday: 9,
      },
      draft: {
        targetAmount: 2_000_000,
        targetDurationMonths: 12,
        monthlyIncome: 350_000,
        payday: 25,
        paydayRule: "FIXED",
        fixedCosts: 50_000,
        estimatedElectricity: 5_000,
        estimatedGas: 5_000,
        estimatedWater: 5_000,
        surplusMode: "STRICT",
        initialBudget: 50_000,
      },
    });

    const b = calculateSettingsBudgetPreview({
      previewKind: "first",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 400_000,
      snapshot: EMPTY_SNAPSHOT,
      firstCycleCalendar: {
        daysUntilNextPaydayIncludingToday: 10,
        daysUntilNextPaydayExcludingToday: 9,
      },
      draft: {
        targetAmount: 2_000_000,
        targetDurationMonths: 12,
        monthlyIncome: 350_000,
        payday: 25,
        paydayRule: "FIXED",
        fixedCosts: 200_000,
        estimatedElectricity: 5_000,
        estimatedGas: 5_000,
        estimatedWater: 5_000,
        surplusMode: "STRICT",
        initialBudget: 50_000,
      },
    });

    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    if (a.status !== "ok" || b.status !== "ok") {
      return;
    }

    expect(a.dailyBudgetToday).toBe(b.dailyBudgetToday);
    expect(a.futureDailyBudget).toBe(b.futureDailyBudget);
    expect(a.previewKind).toBe("first");
    expect(b.previewKind).toBe("first");
  });

  it("通常サイクルでは収支草案の変更が日次・ノルマに反映される（草案の initial_budget は母数に使わない）", () => {
    const logicalToday = budgetLogic.parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = budgetLogic.parseJstDateKeyToDate("2026-05-01");

    const baseDraft = {
      targetAmount: 2_000_000,
      targetDurationMonths: 24,
      monthlyIncome: 400_000,
      payday: 25,
      paydayRule: "FIXED" as const,
      fixedCosts: 100_000,
      estimatedElectricity: 10_000,
      estimatedGas: 10_000,
      estimatedWater: 10_000,
      surplusMode: "STRICT" as const,
      initialBudget: 999_999,
    };

    const tighterFixed = calculateSettingsBudgetPreview({
      previewKind: "normal",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 300_000,
      snapshot: {
        confirmedNormalSpentBeforeToday: 20_000,
        todayTransactions: [],
        utilityEstimatesDb: EMPTY_SNAPSHOT.utilityEstimatesDb,
        initialBudgetDb: 120_000,
        yutoriCarryoverDb: 0,
      },
      firstCycleCalendar: null,
      draft: {
        ...baseDraft,
        fixedCosts: 150_000,
      },
    });

    const looserFixed = calculateSettingsBudgetPreview({
      previewKind: "normal",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 300_000,
      snapshot: {
        confirmedNormalSpentBeforeToday: 20_000,
        todayTransactions: [],
        utilityEstimatesDb: EMPTY_SNAPSHOT.utilityEstimatesDb,
        initialBudgetDb: 120_000,
        yutoriCarryoverDb: 0,
      },
      firstCycleCalendar: null,
      draft: {
        ...baseDraft,
        fixedCosts: 80_000,
      },
    });

    expect(tighterFixed.status).toBe("ok");
    expect(looserFixed.status).toBe("ok");
    if (tighterFixed.status !== "ok" || looserFixed.status !== "ok") {
      return;
    }

    expect(tighterFixed.previewKind).toBe("normal");
    expect(looserFixed.previewKind).toBe("normal");
    if (tighterFixed.previewKind !== "normal" || looserFixed.previewKind !== "normal") {
      return;
    }
    expect(tighterFixed.dailyBudgetToday).not.toBe(looserFixed.dailyBudgetToday);
    expect(tighterFixed.futureDailyBudget).not.toBe(looserFixed.futureDailyBudget);
    expect(tighterFixed.monthlySavingsQuota).toBe(looserFixed.monthlySavingsQuota);

    const differentInitialBudget = calculateSettingsBudgetPreview({
      previewKind: "normal",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 300_000,
      snapshot: {
        confirmedNormalSpentBeforeToday: 20_000,
        todayTransactions: [],
        utilityEstimatesDb: EMPTY_SNAPSHOT.utilityEstimatesDb,
        initialBudgetDb: 120_000,
        yutoriCarryoverDb: 0,
      },
      firstCycleCalendar: null,
      draft: {
        ...baseDraft,
        fixedCosts: 80_000,
        initialBudget: 10_000,
      },
    });

    expect(differentInitialBudget.status).toBe("ok");
    if (differentInitialBudget.status !== "ok") {
      return;
    }

    expect(differentInitialBudget.previewKind).toBe("normal");
    expect(differentInitialBudget.dailyBudgetToday).toBe(looserFixed.dailyBudgetToday);
    expect(differentInitialBudget.futureDailyBudget).toBe(looserFixed.futureDailyBudget);
  });

  it("通常サイクル・YUTORI は yutori_carryover が正値のとき STRICT より日次が有利になる", () => {
    const logicalToday = budgetLogic.parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = budgetLogic.parseJstDateKeyToDate("2026-05-01");

    const sharedSnapshot = {
      confirmedNormalSpentBeforeToday: 0,
      todayTransactions: [],
      utilityEstimatesDb: EMPTY_SNAPSHOT.utilityEstimatesDb,
      initialBudgetDb: 50_000,
      yutoriCarryoverDb: 30_000,
    };

    const draftBase = {
      targetAmount: 2_000_000,
      targetDurationMonths: 24,
      monthlyIncome: 400_000,
      payday: 25,
      paydayRule: "FIXED" as const,
      fixedCosts: 100_000,
      estimatedElectricity: 10_000,
      estimatedGas: 10_000,
      estimatedWater: 10_000,
      initialBudget: 50_000,
    };

    const strictPreview = calculateSettingsBudgetPreview({
      previewKind: "normal",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 300_000,
      snapshot: sharedSnapshot,
      firstCycleCalendar: null,
      draft: { ...draftBase, surplusMode: "STRICT" as const },
    });

    const yutoriPreview = calculateSettingsBudgetPreview({
      previewKind: "normal",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 300_000,
      snapshot: sharedSnapshot,
      firstCycleCalendar: null,
      draft: { ...draftBase, surplusMode: "YUTORI" as const },
    });

    expect(strictPreview.status).toBe("ok");
    expect(yutoriPreview.status).toBe("ok");
    if (strictPreview.status !== "ok" || yutoriPreview.status !== "ok") {
      return;
    }
    if (strictPreview.previewKind !== "normal" || yutoriPreview.previewKind !== "normal") {
      return;
    }

    expect(yutoriPreview.dailyBudgetToday).toBeGreaterThan(strictPreview.dailyBudgetToday);
    expect(yutoriPreview.futureDailyBudget).toBeGreaterThan(strictPreview.futureDailyBudget);
  });

  it("初回プレビューでは calculateBaseCycleBudget と calculateMonthlySavingsQuota を呼ばない", () => {
    const baseSpy = vi.spyOn(budgetLogic, "calculateBaseCycleBudget");
    const quotaSpy = vi.spyOn(budgetLogic, "calculateMonthlySavingsQuota");

    const logicalToday = budgetLogic.parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = budgetLogic.parseJstDateKeyToDate("2026-05-01");

    calculateSettingsBudgetPreview({
      previewKind: "first",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 400_000,
      snapshot: EMPTY_SNAPSHOT,
      firstCycleCalendar: {
        daysUntilNextPaydayIncludingToday: 10,
        daysUntilNextPaydayExcludingToday: 9,
      },
      draft: {
        targetAmount: 2_000_000,
        targetDurationMonths: 12,
        monthlyIncome: 350_000,
        payday: 25,
        paydayRule: "FIXED",
        fixedCosts: 120_000,
        estimatedElectricity: 5_000,
        estimatedGas: 5_000,
        estimatedWater: 5_000,
        surplusMode: "STRICT",
        initialBudget: 50_000,
      },
    });

    expect(baseSpy).not.toHaveBeenCalled();
    expect(quotaSpy).not.toHaveBeenCalled();

    calculateSettingsBudgetPreview({
      previewKind: "normal",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 400_000,
      snapshot: EMPTY_SNAPSHOT,
      firstCycleCalendar: null,
      draft: {
        targetAmount: 2_000_000,
        targetDurationMonths: 12,
        monthlyIncome: 350_000,
        payday: 25,
        paydayRule: "FIXED",
        fixedCosts: 120_000,
        estimatedElectricity: 5_000,
        estimatedGas: 5_000,
        estimatedWater: 5_000,
        surplusMode: "STRICT",
        initialBudget: 50_000,
      },
    });

    expect(baseSpy).toHaveBeenCalledTimes(1);
    expect(quotaSpy).toHaveBeenCalledTimes(1);

    baseSpy.mockRestore();
    quotaSpy.mockRestore();
  });

  it("サイクル最終日（daysExcludingToday = 0）では maskFutureDailyBudget が true", () => {
    const logicalToday = budgetLogic.parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = budgetLogic.parseJstDateKeyToDate("2026-05-01");

    const firstCycleLastDay = calculateSettingsBudgetPreview({
      previewKind: "first",
      logicalToday,
      anchorLogicalDate,
      currentTotalSavingsDb: 400_000,
      snapshot: { ...EMPTY_SNAPSHOT, confirmedNormalSpentBeforeToday: 0 },
      firstCycleCalendar: {
        daysUntilNextPaydayIncludingToday: 1,
        daysUntilNextPaydayExcludingToday: 0,
      },
      draft: {
        targetAmount: 2_000_000,
        targetDurationMonths: 12,
        monthlyIncome: 350_000,
        payday: 25,
        paydayRule: "FIXED",
        fixedCosts: 120_000,
        estimatedElectricity: 5_000,
        estimatedGas: 5_000,
        estimatedWater: 5_000,
        surplusMode: "STRICT",
        initialBudget: 50_000,
      },
    });

    expect(firstCycleLastDay.status).toBe("ok");
    if (firstCycleLastDay.status !== "ok") {
      return;
    }
    expect(firstCycleLastDay.maskFutureDailyBudget).toBe(true);
  });
});
