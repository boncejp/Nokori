import { describe, expect, it } from "vitest";
import { calculateDashboardCycleMetrics } from "./dashboard-cycle-metrics";
import type { DashboardCycleMetricsInput } from "./dashboard-cycle-metrics";

// ─────────────────────────────────────────────────────────────────────────────
// テストヘルパー
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_UTILITY_ESTIMATES = {
  ELECTRICITY: 10_000,
  GAS: 5_000,
  WATER: 3_000,
} as const;

function normalTx(amount: number) {
  return { amount, type: "NORMAL" as const, utility_type: null };
}

function specialTx(amount: number) {
  return { amount, type: "SPECIAL" as const, utility_type: null };
}

function utilityTx(amount: number, type: "ELECTRICITY" | "GAS" | "WATER") {
  return { amount, type: "NORMAL" as const, utility_type: type };
}

function buildInput(overrides: Partial<DashboardCycleMetricsInput> = {}): DashboardCycleMetricsInput {
  return {
    remainingCycleBudget: 50_000,
    daysUntilNextPaydayIncludingToday: 10,
    daysUntilNextPaydayExcludingToday: 9,
    utilityEstimates: DEFAULT_UTILITY_ESTIMATES,
    transactions: [],
    isFirstCycle: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 通常サイクル: 支出なし
// ─────────────────────────────────────────────────────────────────────────────

describe("通常サイクル: 支出なし", () => {
  it("D_today = remainingCycleBudget / daysIncludingToday", () => {
    const { dailyBudgetToday } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 90_000,
      daysUntilNextPaydayIncludingToday: 9,
    }));
    expect(dailyBudgetToday).toBe(10_000);
  });

  it("支出ゼロのとき remainingToday = D_today", () => {
    const { dailyBudgetToday, remainingToday } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
    }));
    expect(remainingToday).toBe(dailyBudgetToday);
  });

  it("支出ゼロのとき isOverBudget = false", () => {
    const { isOverBudget } = calculateDashboardCycleMetrics(buildInput());
    expect(isOverBudget).toBe(false);
  });

  it("支出ゼロのとき todaySpentTotal = 0", () => {
    const { todaySpentTotal } = calculateDashboardCycleMetrics(buildInput());
    expect(todaySpentTotal).toBe(0);
  });

  it("支出ゼロのとき utilityDeltaTotal = 0", () => {
    const { utilityDeltaTotal } = calculateDashboardCycleMetrics(buildInput());
    expect(utilityDeltaTotal).toBe(0);
  });

  it("D_future = remainingCycleBudget / daysExcludingToday（支出なし）", () => {
    const { futureDailyBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 90_000,
      daysUntilNextPaydayIncludingToday: 10,
      daysUntilNextPaydayExcludingToday: 9,
    }));
    expect(futureDailyBudget).toBeCloseTo(90_000 / 9, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 通常サイクル: 普通支出
// ─────────────────────────────────────────────────────────────────────────────

describe("通常サイクル: 普通支出", () => {
  it("remainingToday = D_today - 普通支出合計", () => {
    const { remainingToday, dailyBudgetToday } = calculateDashboardCycleMetrics(buildInput({
      transactions: [normalTx(1_500), normalTx(500)],
    }));
    expect(remainingToday).toBe(dailyBudgetToday - 2_000);
  });

  it("todaySpentTotal は普通支出の合計を含む", () => {
    const { todaySpentTotal } = calculateDashboardCycleMetrics(buildInput({
      transactions: [normalTx(3_000), normalTx(2_000)],
    }));
    expect(todaySpentTotal).toBe(5_000);
  });

  it("todayNormalSpent は普通支出（光熱費以外）のみの合計", () => {
    const { todayNormalSpent } = calculateDashboardCycleMetrics(buildInput({
      transactions: [normalTx(2_000), normalTx(1_000)],
    }));
    expect(todayNormalSpent).toBe(3_000);
  });

  it("普通支出が D_today を超えると isOverBudget = true", () => {
    const input = buildInput({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
      transactions: [normalTx(5_001)],
    });
    const { isOverBudget, dailyBudgetToday } = calculateDashboardCycleMetrics(input);
    expect(dailyBudgetToday).toBe(5_000);
    expect(isOverBudget).toBe(true);
  });

  it("普通支出がちょうど D_today のとき isOverBudget = false（残り 0 は超過でない）", () => {
    const { isOverBudget, remainingToday } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
      transactions: [normalTx(5_000)],
    }));
    expect(remainingToday).toBe(0);
    expect(isOverBudget).toBe(false);
  });

  it("普通支出は D_future の分子からも差し引かれる", () => {
    const { futureDailyBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
      daysUntilNextPaydayExcludingToday: 9,
      transactions: [normalTx(2_000)],
    }));
    expect(futureDailyBudget).toBeCloseTo((50_000 - 2_000) / 9, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 通常サイクル: 特別支出
// ─────────────────────────────────────────────────────────────────────────────

describe("通常サイクル: 特別支出", () => {
  it("特別支出は remainingToday に影響しない", () => {
    const withoutSpecial = calculateDashboardCycleMetrics(buildInput({ transactions: [] }));
    const withSpecial = calculateDashboardCycleMetrics(buildInput({ transactions: [specialTx(30_000)] }));
    expect(withSpecial.remainingToday).toBe(withoutSpecial.remainingToday);
  });

  it("特別支出は D_today に影響しない", () => {
    const withoutSpecial = calculateDashboardCycleMetrics(buildInput({ transactions: [] }));
    const withSpecial = calculateDashboardCycleMetrics(buildInput({ transactions: [specialTx(30_000)] }));
    expect(withSpecial.dailyBudgetToday).toBe(withoutSpecial.dailyBudgetToday);
  });

  it("特別支出は D_future に影響しない", () => {
    const withoutSpecial = calculateDashboardCycleMetrics(buildInput({ transactions: [] }));
    const withSpecial = calculateDashboardCycleMetrics(buildInput({ transactions: [specialTx(30_000)] }));
    expect(withSpecial.futureDailyBudget).toBe(withoutSpecial.futureDailyBudget);
  });

  it("特別支出は todaySpentTotal にカウントされる", () => {
    const { todaySpentTotal } = calculateDashboardCycleMetrics(buildInput({
      transactions: [specialTx(10_000)],
    }));
    expect(todaySpentTotal).toBe(10_000);
  });

  it("特別支出は todayNormalSpent にカウントされない", () => {
    const { todayNormalSpent } = calculateDashboardCycleMetrics(buildInput({
      transactions: [specialTx(10_000)],
    }));
    expect(todayNormalSpent).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 通常サイクル: 光熱費
// ─────────────────────────────────────────────────────────────────────────────

describe("通常サイクル: 光熱費", () => {
  it("実額 < 概算のとき utilityDeltaTotal は正（予算増）", () => {
    const { utilityDeltaTotal } = calculateDashboardCycleMetrics(buildInput({
      transactions: [utilityTx(8_000, "ELECTRICITY")],
    }));
    expect(utilityDeltaTotal).toBe(2_000);
  });

  it("実額 > 概算のとき utilityDeltaTotal は負（予算減）", () => {
    const { utilityDeltaTotal } = calculateDashboardCycleMetrics(buildInput({
      transactions: [utilityTx(6_000, "GAS")],
    }));
    expect(utilityDeltaTotal).toBe(-1_000);
  });

  it("実額 = 概算のとき utilityDeltaTotal は 0", () => {
    const { utilityDeltaTotal } = calculateDashboardCycleMetrics(buildInput({
      transactions: [utilityTx(10_000, "ELECTRICITY")],
    }));
    expect(utilityDeltaTotal).toBe(0);
  });

  it("複数の光熱費入力のとき差額が正しく合算される", () => {
    const { utilityDeltaTotal } = calculateDashboardCycleMetrics(buildInput({
      transactions: [
        utilityTx(8_000, "ELECTRICITY"),  // delta +2_000
        utilityTx(6_000, "GAS"),          // delta -1_000
        utilityTx(3_000, "WATER"),        // delta  0
      ],
    }));
    expect(utilityDeltaTotal).toBe(1_000);
  });

  it("光熱費は remainingToday に直接影響しない（普通支出のみ差し引き）", () => {
    const withoutUtility = calculateDashboardCycleMetrics(buildInput({ transactions: [] }));
    const withUtility = calculateDashboardCycleMetrics(buildInput({
      transactions: [utilityTx(8_000, "ELECTRICITY")],
    }));
    expect(withUtility.remainingToday).toBe(withoutUtility.remainingToday);
  });

  it("光熱費は D_today に直接影響しない", () => {
    const withoutUtility = calculateDashboardCycleMetrics(buildInput({ transactions: [] }));
    const withUtility = calculateDashboardCycleMetrics(buildInput({
      transactions: [utilityTx(8_000, "ELECTRICITY")],
    }));
    expect(withUtility.dailyBudgetToday).toBe(withoutUtility.dailyBudgetToday);
  });

  it("光熱費の差額は D_future の分子に反映される（実額 < 概算 → 翌日以降が増える）", () => {
    const input = buildInput({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
      daysUntilNextPaydayExcludingToday: 9,
      transactions: [utilityTx(8_000, "ELECTRICITY")],
    });
    const { futureDailyBudget } = calculateDashboardCycleMetrics(input);
    // delta = +2_000 → 分子 = 50_000 + 2_000 = 52_000
    expect(futureDailyBudget).toBeCloseTo(52_000 / 9, 10);
  });

  it("光熱費の差額は D_future の分子に反映される（実額 > 概算 → 翌日以降が減る）", () => {
    const input = buildInput({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
      daysUntilNextPaydayExcludingToday: 9,
      transactions: [utilityTx(6_000, "GAS")],
    });
    const { futureDailyBudget } = calculateDashboardCycleMetrics(input);
    // delta = -1_000 → 分子 = 50_000 - 1_000 = 49_000
    expect(futureDailyBudget).toBeCloseTo(49_000 / 9, 10);
  });

  it("光熱費は todaySpentTotal にカウントされる", () => {
    const { todaySpentTotal } = calculateDashboardCycleMetrics(buildInput({
      transactions: [utilityTx(9_000, "ELECTRICITY")],
    }));
    expect(todaySpentTotal).toBe(9_000);
  });

  it("光熱費は todayNormalSpent にカウントされない", () => {
    const { todayNormalSpent } = calculateDashboardCycleMetrics(buildInput({
      transactions: [utilityTx(9_000, "ELECTRICITY")],
    }));
    expect(todayNormalSpent).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 通常サイクル: 複合ケース
// ─────────────────────────────────────────────────────────────────────────────

describe("通常サイクル: 複合ケース", () => {
  it("普通支出・特別支出・光熱費が混在するとき各指標が正しく算出される", () => {
    const input = buildInput({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
      daysUntilNextPaydayExcludingToday: 9,
      transactions: [
        normalTx(2_000),
        specialTx(10_000),
        utilityTx(8_000, "ELECTRICITY"),
      ],
    });
    const metrics = calculateDashboardCycleMetrics(input);

    expect(metrics.dailyBudgetToday).toBe(5_000);
    expect(metrics.remainingToday).toBe(5_000 - 2_000);
    expect(metrics.todayNormalSpent).toBe(2_000);
    expect(metrics.todaySpentTotal).toBe(2_000 + 10_000 + 8_000);
    expect(metrics.utilityDeltaTotal).toBe(2_000);
    // D_future: (50_000 + 2_000 - 2_000) / 9 = 50_000 / 9
    expect(metrics.futureDailyBudget).toBeCloseTo(50_000 / 9, 10);
    expect(metrics.isOverBudget).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 通常サイクル: 境界値
// ─────────────────────────────────────────────────────────────────────────────

describe("通常サイクル: 境界値", () => {
  it("残り1日（daysExcludingToday = 0）のとき D_future は remainingBudget そのまま返る", () => {
    const { futureDailyBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 8_000,
      daysUntilNextPaydayIncludingToday: 1,
      daysUntilNextPaydayExcludingToday: 0,
    }));
    expect(futureDailyBudget).toBe(8_000);
  });

  it("残り1日かつ普通支出あり（daysExcludingToday = 0）のとき D_future は残額を返す", () => {
    const { futureDailyBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 8_000,
      daysUntilNextPaydayIncludingToday: 1,
      daysUntilNextPaydayExcludingToday: 0,
      transactions: [normalTx(3_000)],
    }));
    expect(futureDailyBudget).toBe(8_000 - 3_000);
  });

  it("残り1日かつ光熱費あり（daysExcludingToday = 0）のとき D_future は差額適用後の残額を返す", () => {
    const { futureDailyBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 8_000,
      daysUntilNextPaydayIncludingToday: 1,
      daysUntilNextPaydayExcludingToday: 0,
      transactions: [utilityTx(8_000, "ELECTRICITY")],
    }));
    // delta = 10_000 - 8_000 = 2_000
    expect(futureDailyBudget).toBe(8_000 + 2_000);
  });

  it("remainingCycleBudget が 0 のとき D_today = 0 で isOverBudget = false", () => {
    const { dailyBudgetToday, remainingToday, isOverBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 0,
      daysUntilNextPaydayIncludingToday: 5,
    }));
    expect(dailyBudgetToday).toBe(0);
    expect(remainingToday).toBe(0);
    expect(isOverBudget).toBe(false);
  });

  it("remainingCycleBudget が負のとき D_today は負値になり isOverBudget = true", () => {
    const { dailyBudgetToday, remainingToday, isOverBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: -5_000,
      daysUntilNextPaydayIncludingToday: 5,
    }));
    expect(dailyBudgetToday).toBe(-1_000);
    expect(remainingToday).toBe(-1_000);
    expect(isOverBudget).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 初回サイクル
// ─────────────────────────────────────────────────────────────────────────────

describe("初回サイクル", () => {
  it("D_today は remainingCycleBudget / daysIncludingToday で算出される（通常と同じ）", () => {
    const { dailyBudgetToday } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 30_000,
      daysUntilNextPaydayIncludingToday: 6,
      isFirstCycle: true,
    }));
    expect(dailyBudgetToday).toBe(5_000);
  });

  it("remainingToday は普通支出のみで差し引かれる", () => {
    const { remainingToday, dailyBudgetToday } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 30_000,
      daysUntilNextPaydayIncludingToday: 6,
      transactions: [normalTx(1_500)],
      isFirstCycle: true,
    }));
    expect(remainingToday).toBe(dailyBudgetToday - 1_500);
  });

  it("D_future は utilityDeltaTotal を加算しない（光熱費差額は初回サイクルに影響しない）", () => {
    const withUtility = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 30_000,
      daysUntilNextPaydayIncludingToday: 6,
      daysUntilNextPaydayExcludingToday: 5,
      transactions: [utilityTx(8_000, "ELECTRICITY")],
      isFirstCycle: true,
    }));
    const withoutUtility = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 30_000,
      daysUntilNextPaydayIncludingToday: 6,
      daysUntilNextPaydayExcludingToday: 5,
      transactions: [],
      isFirstCycle: true,
    }));
    expect(withUtility.futureDailyBudget).toBe(withoutUtility.futureDailyBudget);
  });

  it("初回サイクルの D_future = (remainingCycleBudget - 普通支出) / daysExcludingToday", () => {
    const { futureDailyBudget } = calculateDashboardCycleMetrics(buildInput({
      remainingCycleBudget: 30_000,
      daysUntilNextPaydayIncludingToday: 6,
      daysUntilNextPaydayExcludingToday: 5,
      transactions: [normalTx(2_000)],
      isFirstCycle: true,
    }));
    expect(futureDailyBudget).toBeCloseTo((30_000 - 2_000) / 5, 10);
  });

  it("isFirstCycle と isFirstCycle=false で D_future が異なる（光熱費がある場合）", () => {
    const sharedParams = {
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
      daysUntilNextPaydayExcludingToday: 9,
      transactions: [utilityTx(8_000, "ELECTRICITY")],
    };
    const firstCycle = calculateDashboardCycleMetrics(buildInput({ ...sharedParams, isFirstCycle: true }));
    const normalCycle = calculateDashboardCycleMetrics(buildInput({ ...sharedParams, isFirstCycle: false }));
    // 初回: D_future = 50_000 / 9（光熱費差額なし）
    expect(firstCycle.futureDailyBudget).toBeCloseTo(50_000 / 9, 10);
    // 通常: D_future = (50_000 + 2_000) / 9
    expect(normalCycle.futureDailyBudget).toBeCloseTo(52_000 / 9, 10);
    expect(firstCycle.futureDailyBudget).not.toBeCloseTo(normalCycle.futureDailyBudget, 5);
  });
});
