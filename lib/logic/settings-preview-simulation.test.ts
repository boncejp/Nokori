import { describe, expect, it } from "vitest";

import { parseJstDateKeyToDate } from "@/lib/logic/budget-logic";

import { calculateSettingsBudgetPreview } from "./settings-preview-simulation";

const EMPTY_SNAPSHOT = {
  confirmedNormalSpentBeforeToday: 10_000,
  todayTransactions: [],
  utilityEstimatesDb: {
    ELECTRICITY: 5_000,
    GAS: 5_000,
    WATER: 5_000,
  },
} as const;

describe("calculateSettingsBudgetPreview", () => {
  it("初回サイクルでは initial_budget を変えると当日・翌日以降プレビューが変わる", () => {
    const logicalToday = parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = parseJstDateKeyToDate("2026-05-01");

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
        initialBudget: 80_000,
      },
    });

    expect(low.status).toBe("ok");
    expect(high.status).toBe("ok");
    if (low.status !== "ok" || high.status !== "ok") {
      return;
    }

    expect(low.dailyBudgetToday).toBe(4_000);
    expect(high.dailyBudgetToday).toBe(7_000);
    expect(low.monthlySavingsQuota).toBe(high.monthlySavingsQuota);
  });

  it("初回サイクルでは fixed_costs を変えても日次プレビューは変わらない（ノルマも目標・期間が同じなら同じ）", () => {
    const logicalToday = parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = parseJstDateKeyToDate("2026-05-01");

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
    expect(a.monthlySavingsQuota).toBe(b.monthlySavingsQuota);
  });

  it("通常サイクルでは surplus_mode / initial_budget 以外の変更が日次・ノルマに反映される", () => {
    const logicalToday = parseJstDateKeyToDate("2026-05-12");
    const anchorLogicalDate = parseJstDateKeyToDate("2026-05-01");

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

    expect(differentInitialBudget.dailyBudgetToday).toBe(looserFixed.dailyBudgetToday);
    expect(differentInitialBudget.futureDailyBudget).toBe(looserFixed.futureDailyBudget);
  });
});
