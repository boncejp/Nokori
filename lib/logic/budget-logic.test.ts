import { describe, expect, it } from "vitest";
import {
  applyUtilityDeltaToRemainingBudget,
  calculateBaseCycleBudget,
  calculateCycleWindow,
  calculateDailyBudgetFuture,
  calculateDailyBudgetToday,
  calculateDaysUntilNextPayday,
  calculateMonthlySavingsQuota,
  calculateNextRemainingCycleBudget,
  calculateRemainingMonthsToTarget,
  calculateNextPayday,
  calculateTargetDateFromDuration,
  calculateRemainingToday,
  calculateUtilityBudgetDelta,
  getLogicalDate,
  isWithinFirstCycle,
  processMonthlyReset,
  resolveInitialBudgetForSettingsUpdate,
  shouldExecuteMonthlyReset,
} from "./budget-logic";

function formatJstDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("/", "-");
}

describe("getLogicalDate", () => {
  it("JST 02:59:59 のとき前日を返す", () => {
    const now = new Date("2026-04-28T17:59:59Z");
    expect(formatJstDate(getLogicalDate(now))).toBe("2026-04-28");
  });

  it("JST 03:00:00 のとき当日を返す", () => {
    const now = new Date("2026-04-28T18:00:00Z");
    expect(formatJstDate(getLogicalDate(now))).toBe("2026-04-29");
  });
});

describe("daily budget calculations", () => {
  it("D_today を算出する", () => {
    const result = calculateDailyBudgetToday({
      remainingCycleBudget: 90_000,
      daysUntilNextPaydayIncludingToday: 9,
    });
    expect(result).toBe(10_000);
  });

  it("remainingToday を算出する", () => {
    const result = calculateRemainingToday({
      dailyBudgetToday: 10_000,
      todaySpent: 3_500,
    });
    expect(result).toBe(6_500);
  });

  it("D_future を算出する", () => {
    const result = calculateDailyBudgetFuture({
      remainingCycleBudget: 90_000,
      todaySpent: 9_000,
      daysUntilNextPaydayExcludingToday: 9,
    });
    expect(result).toBe(9_000);
  });

  it("月またぎでも残日数を正しく算出する", () => {
    const fromDate = new Date("2026-01-31T04:00:00Z");
    const nextPayday = new Date("2026-02-24T15:00:00Z");
    const includingToday = calculateDaysUntilNextPayday({
      fromDate,
      nextPayday,
      includeToday: true,
    });
    const excludingToday = calculateDaysUntilNextPayday({
      fromDate,
      nextPayday,
      includeToday: false,
    });

    expect(includingToday).toBe(26);
    expect(excludingToday).toBe(25);
  });

  it("翌日が存在しない最終日では D_future に残額を返す", () => {
    const result = calculateDailyBudgetFuture({
      remainingCycleBudget: 8_000,
      todaySpent: 3_000,
      daysUntilNextPaydayExcludingToday: 0,
    });
    expect(result).toBe(5_000);
  });
});

describe("utility reflection", () => {
  it("概算より安いと予算増の差額になる", () => {
    const delta = calculateUtilityBudgetDelta({
      utilityType: "ELECTRICITY",
      actualAmount: 8_000,
      estimatedByType: {
        ELECTRICITY: 10_000,
        GAS: 5_000,
        WATER: 3_000,
      },
    });
    expect(delta).toBe(2_000);
  });

  it("概算より高いと予算減の差額になる", () => {
    const delta = calculateUtilityBudgetDelta({
      utilityType: "GAS",
      actualAmount: 6_300,
      estimatedByType: {
        ELECTRICITY: 10_000,
        GAS: 5_000,
        WATER: 3_000,
      },
    });
    const remaining = applyUtilityDeltaToRemainingBudget({
      remainingBudget: 50_000,
      utilityDelta: delta,
    });

    expect(delta).toBe(-1_300);
    expect(remaining).toBe(48_700);
  });
});

describe("calculateNextPayday", () => {
  it("BEFORE: 土日祝は前倒しする", () => {
    const result = calculateNextPayday({
      fromDate: new Date("2026-04-20T00:00:00Z"),
      payday: 3,
      paydayRule: "BEFORE",
    });
    expect(formatJstDate(result)).toBe("2026-05-01");
  });

  it("AFTER: 土日祝は後ろ倒しする", () => {
    const result = calculateNextPayday({
      fromDate: new Date("2026-04-20T00:00:00Z"),
      payday: 3,
      paydayRule: "AFTER",
    });
    expect(formatJstDate(result)).toBe("2026-05-07");
  });

  it("FIXED: 土日祝でも固定日を返す", () => {
    const result = calculateNextPayday({
      fromDate: new Date("2026-04-20T00:00:00Z"),
      payday: 3,
      paydayRule: "FIXED",
    });
    expect(formatJstDate(result)).toBe("2026-05-03");
  });

  it("BEFORE: 平日の祝日もJST基準で前倒しする", () => {
    const result = calculateNextPayday({
      fromDate: new Date("2026-02-01T12:34:56Z"),
      payday: 11,
      paydayRule: "BEFORE",
    });
    expect(formatJstDate(result)).toBe("2026-02-10");
  });

  it("月末が存在しない場合は月末日に補正する", () => {
    const result = calculateNextPayday({
      fromDate: new Date("2026-02-01T00:00:00Z"),
      payday: 31,
      paydayRule: "FIXED",
    });
    expect(formatJstDate(result)).toBe("2026-02-28");
  });
});

describe("calculateTargetDateFromDuration", () => {
  it("期間1か月後の同月給料日を返す", () => {
    const result = calculateTargetDateFromDuration({
      anchorLogicalDate: new Date("2026-04-10T00:00:00+09:00"),
      durationMonths: 1,
      payday: 24,
      paydayRule: "FIXED",
    });
    expect(formatJstDate(result)).toBe("2026-05-24");
  });

  it("給料日補正ルールを適用して目標日を算出する", () => {
    const result = calculateTargetDateFromDuration({
      anchorLogicalDate: new Date("2026-04-10T00:00:00+09:00"),
      durationMonths: 1,
      payday: 3,
      paydayRule: "AFTER",
    });
    expect(formatJstDate(result)).toBe("2026-05-07");
  });

  it("月末が存在しない月では月末補正を適用する", () => {
    const result = calculateTargetDateFromDuration({
      anchorLogicalDate: new Date("2026-01-15T00:00:00+09:00"),
      durationMonths: 1,
      payday: 31,
      paydayRule: "FIXED",
    });
    expect(formatJstDate(result)).toBe("2026-02-28");
  });

  it("同一期間でも給料日変更時は目標日が再計算される", () => {
    const fixed = calculateTargetDateFromDuration({
      anchorLogicalDate: new Date("2026-04-10T00:00:00+09:00"),
      durationMonths: 2,
      payday: 24,
      paydayRule: "FIXED",
    });
    const changedPayday = calculateTargetDateFromDuration({
      anchorLogicalDate: new Date("2026-04-10T00:00:00+09:00"),
      durationMonths: 2,
      payday: 28,
      paydayRule: "FIXED",
    });

    expect(formatJstDate(fixed)).toBe("2026-06-24");
    expect(formatJstDate(changedPayday)).toBe("2026-06-28");
  });
});

describe("processMonthlyReset", () => {
  it("STRICT は余剰を貯金に加算する", () => {
    const result = processMonthlyReset({
      surplusMode: "STRICT",
      currentTotalSavings: 100_000,
      baseBudget: 80_000,
      surplus: 5_000,
    });
    expect(result.nextTotalSavings).toBe(105_000);
    expect(result.nextInitialBudget).toBe(80_000);
  });

  it("YUTORI は余剰を翌月予算に加算する", () => {
    const result = processMonthlyReset({
      surplusMode: "YUTORI",
      currentTotalSavings: 100_000,
      baseBudget: 80_000,
      surplus: 5_000,
    });
    expect(result.nextTotalSavings).toBe(100_000);
    expect(result.nextInitialBudget).toBe(85_000);
  });
});

describe("monthly savings quota", () => {
  it("残り月数で月次ノルマを再計算する", () => {
    const remainingMonths = calculateRemainingMonthsToTarget({
      targetDate: new Date("2026-12-31T00:00:00+09:00"),
      referenceDate: new Date("2026-04-15T12:00:00+09:00"),
    });
    const quota = calculateMonthlySavingsQuota({
      targetAmount: 1_000_000,
      currentTotalSavings: 400_000,
      targetDate: new Date("2026-12-31T00:00:00+09:00"),
      referenceDate: new Date("2026-04-15T12:00:00+09:00"),
    });

    expect(remainingMonths).toBe(9);
    expect(quota).toBeCloseTo(66_666.666, 2);
  });

  it("目標超過時はノルマを0で下限固定する", () => {
    const quota = calculateMonthlySavingsQuota({
      targetAmount: 300_000,
      currentTotalSavings: 350_000,
      targetDate: new Date("2026-05-01T00:00:00+09:00"),
      referenceDate: new Date("2026-04-15T00:00:00+09:00"),
    });

    expect(quota).toBe(0);
  });
});

describe("next remaining cycle budget", () => {
  it("初回サイクルはinitial_budgetをそのまま使う", () => {
    const result = calculateNextRemainingCycleBudget({
      isFirstCycle: true,
      initialBudget: 120_000,
      baseCycleBudget: 95_000,
      confirmedNormalSpentBeforeToday: 12_000,
    });

    expect(result).toBe(120_000);
  });

  it("2回目以降は設計4.2の式で算出する", () => {
    const monthlySavingsQuota = calculateMonthlySavingsQuota({
      targetAmount: 900_000,
      currentTotalSavings: 450_000,
      targetDate: new Date("2026-10-31T00:00:00+09:00"),
      referenceDate: new Date("2026-04-15T00:00:00+09:00"),
    });
    const baseCycleBudget = calculateBaseCycleBudget({
      monthlyIncome: 300_000,
      fixedCosts: 80_000,
      estimatedElectricity: 8_000,
      estimatedGas: 5_000,
      estimatedWater: 4_000,
      monthlySavingsQuota,
    });
    const result = calculateNextRemainingCycleBudget({
      isFirstCycle: false,
      initialBudget: 150_000,
      baseCycleBudget,
      confirmedNormalSpentBeforeToday: 40_000,
    });

    expect(baseCycleBudget).toBeCloseTo(138_714.285, 2);
    expect(result).toBeCloseTo(98_714.285, 2);
  });
});

describe("calculateBaseCycleBudget", () => {
  it("基準予算が負値になる場合は0にクランプする", () => {
    const result = calculateBaseCycleBudget({
      monthlyIncome: 120_000,
      fixedCosts: 90_000,
      estimatedElectricity: 20_000,
      estimatedGas: 10_000,
      estimatedWater: 8_000,
      monthlySavingsQuota: 15_000,
    });

    expect(result).toBe(0);
  });
});

describe("calculateCycleWindow", () => {
  it("給料日当日は当日をサイクル開始日として返す", () => {
    const result = calculateCycleWindow({
      referenceDate: new Date("2026-04-24T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(formatJstDate(result.cycleStartDate)).toBe("2026-04-24");
    expect(formatJstDate(result.nextPaydayDate)).toBe("2026-05-24");
  });

  it("給料日前日は前月給料日がサイクル開始になる", () => {
    const result = calculateCycleWindow({
      referenceDate: new Date("2026-04-23T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(formatJstDate(result.cycleStartDate)).toBe("2026-03-24");
    expect(formatJstDate(result.nextPaydayDate)).toBe("2026-04-24");
  });
});

describe("isWithinFirstCycle", () => {
  it("初回当日は初回サイクル内として判定される", () => {
    const result = isWithinFirstCycle({
      onboardingCompletedAt: new Date("2026-04-10T10:00:00+09:00"),
      referenceDate: new Date("2026-04-10T15:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("初回中日も初回サイクル内として判定される", () => {
    const result = isWithinFirstCycle({
      onboardingCompletedAt: new Date("2026-04-10T10:00:00+09:00"),
      referenceDate: new Date("2026-04-15T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("初回最終日(最初の給料日前日)は初回サイクル内として判定される", () => {
    const result = isWithinFirstCycle({
      onboardingCompletedAt: new Date("2026-04-10T10:00:00+09:00"),
      referenceDate: new Date("2026-04-23T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("2回目初日(最初の給料日)は初回サイクル外として判定される", () => {
    const result = isWithinFirstCycle({
      onboardingCompletedAt: new Date("2026-04-10T10:00:00+09:00"),
      referenceDate: new Date("2026-04-24T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(false);
  });

  it("27:00ルールでオンボーディング日を論理日付として扱う", () => {
    const result = isWithinFirstCycle({
      onboardingCompletedAt: new Date("2026-04-10T02:00:00+09:00"),
      referenceDate: new Date("2026-04-09T12:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("オンボーディング論理日が給料日当日でも初回サイクルは空にならない", () => {
    const duringFirstCycle = isWithinFirstCycle({
      onboardingCompletedAt: new Date("2026-04-24T12:00:00+09:00"),
      referenceDate: new Date("2026-05-10T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(duringFirstCycle).toBe(true);
  });

  it("オンボーディング論理日が給料日当日の場合は次回給料日当日にfalseになる", () => {
    const result = isWithinFirstCycle({
      onboardingCompletedAt: new Date("2026-04-24T12:00:00+09:00"),
      referenceDate: new Date("2026-05-24T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(false);
  });
});

describe("shouldExecuteMonthlyReset", () => {
  it("給料日かつ未実行日の場合は実行する", () => {
    const result = shouldExecuteMonthlyReset({
      isPayday: true,
      logicalTodayString: "2026-05-24",
      lastMonthlyResetLogicalDate: null,
    });

    expect(result).toBe(true);
  });

  it("同日2回目アクセスでは実行しない", () => {
    const result = shouldExecuteMonthlyReset({
      isPayday: true,
      logicalTodayString: "2026-05-24",
      lastMonthlyResetLogicalDate: "2026-05-24",
    });

    expect(result).toBe(false);
  });

  it("給料日でなければ実行しない", () => {
    const result = shouldExecuteMonthlyReset({
      isPayday: false,
      logicalTodayString: "2026-05-20",
      lastMonthlyResetLogicalDate: null,
    });

    expect(result).toBe(false);
  });

  it("給料日の他更新が先に発生しても専用日付が未設定なら実行する", () => {
    const result = shouldExecuteMonthlyReset({
      isPayday: true,
      logicalTodayString: "2026-05-24",
      lastMonthlyResetLogicalDate: null,
    });

    expect(result).toBe(true);
  });
});

describe("resolveInitialBudgetForSettingsUpdate", () => {
  it("初回サイクルで目標金額のみ変更した保存では既存initial_budgetを保持する", () => {
    const result = resolveInitialBudgetForSettingsUpdate({
      isWithinFirstCycle: true,
      existingInitialBudget: 80_000,
      submittedInitialBudget: 80_000,
    });

    expect(result).toBe(80_000);
  });

  it("初回サイクルでもinitial_budgetを明示変更した場合は更新値を採用する", () => {
    const result = resolveInitialBudgetForSettingsUpdate({
      isWithinFirstCycle: true,
      existingInitialBudget: 80_000,
      submittedInitialBudget: 70_000,
    });

    expect(result).toBe(70_000);
  });

  it("初回サイクル外では送信値を採用する", () => {
    const result = resolveInitialBudgetForSettingsUpdate({
      isWithinFirstCycle: false,
      existingInitialBudget: 80_000,
      submittedInitialBudget: 65_000,
    });

    expect(result).toBe(65_000);
  });
});
