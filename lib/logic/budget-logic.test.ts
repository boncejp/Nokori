import { describe, expect, it } from "vitest";
import {
  applyUtilityDeltaToRemainingBudget,
  calculateBaseCycleBudget,
  calculateCycleWindow,
  calculateDailyBudgetFuture,
  calculateDailyBudgetToday,
  calculateDaysUntilNextPayday,
  calculateFirstCycleDailyProrationDayCounts,
  calculateNormalCycleDailyProrationDayCounts,
  calculateMonthlySavingsQuota,
  calculateNextRemainingCycleBudget,
  calculateRemainingMonthsToTarget,
  calculateNextPayday,
  calculateTargetDateFromDuration,
  calculateRemainingToday,
  calculateUtilityBudgetDelta,
  calculateYutoriCarryoverDisplay,
  getHistoryListingLogicalDateRange,
  getLogicalDate,
  isFirstCycleInitialBudgetExceedingTotalAssets,
  isWithinFirstCycle,
  parseJstDateKeyToDate,
  processFirstCycleClose,
  processMonthlyReset,
  resolveCurrentTotalSavingsForProfileSettingsUpdate,
  resolveInitialBudgetForSettingsUpdate,
  shouldExecuteMonthlyReset,
  sumPlainNormalExpenseAmounts,
  toJstStartOfDay,
  toJstDateString,
} from "./budget-logic";
import { calculateDashboardCycleMetrics } from "./dashboard-cycle-metrics";

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

describe("parseJstDateKeyToDate", () => {
  it("YYYY-MM-DD を JST 日付の開始として解釈する", () => {
    const d = parseJstDateKeyToDate("2026-05-11");
    expect(formatJstDate(d)).toBe("2026-05-11");
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

describe("calculateFirstCycleDailyProrationDayCounts", () => {
  it("初回開始日・給料日15・前倒しでは次の給料日前日までを分母に含め当日32日扱いにしない", () => {
    const anchor = parseJstDateKeyToDate("2026-05-15");
    const logicalToday = new Date("2026-05-15T12:00:00+09:00");
    const counts = calculateFirstCycleDailyProrationDayCounts({
      logicalToday,
      anchorLogicalDate: anchor,
      payday: 15,
      paydayRule: "BEFORE",
    });
    expect(counts.daysIncludingToday).toBe(31);
    expect(counts.daysExcludingToday).toBe(30);

    const wrongIncluding = calculateDaysUntilNextPayday({
      fromDate: logicalToday,
      nextPayday: new Date("2026-06-15T00:00:00+09:00"),
      includeToday: true,
    });
    const wrongExcluding = calculateDaysUntilNextPayday({
      fromDate: logicalToday,
      nextPayday: new Date("2026-06-15T00:00:00+09:00"),
      includeToday: false,
    });
    expect(wrongIncluding).toBe(32);
    expect(wrongExcluding).toBe(31);

    const range = getHistoryListingLogicalDateRange({
      logicalToday,
      anchorLogicalDate: anchor,
      payday: 15,
      paydayRule: "BEFORE",
      isFirstCycle: true,
    });
    expect(formatJstDate(range.to)).toBe("2026-06-14");
  });

  it("初回最終日では翌日以降の日数が0になり履歴の終端日と一致する", () => {
    const anchor = parseJstDateKeyToDate("2026-05-15");
    const logicalToday = new Date("2026-06-14T12:00:00+09:00");
    const counts = calculateFirstCycleDailyProrationDayCounts({
      logicalToday,
      anchorLogicalDate: anchor,
      payday: 15,
      paydayRule: "BEFORE",
    });
    expect(counts.daysIncludingToday).toBe(1);
    expect(counts.daysExcludingToday).toBe(0);

    const range = getHistoryListingLogicalDateRange({
      logicalToday,
      anchorLogicalDate: anchor,
      payday: 15,
      paydayRule: "BEFORE",
      isFirstCycle: true,
    });
    expect(formatJstDate(range.to)).toBe(formatJstDate(logicalToday));
  });

  it("初回・initial_budget 20_000・支出0のとき当日/翌日以降の日割りが 31 日・30 日基準になる", () => {
    const anchor = parseJstDateKeyToDate("2026-05-15");
    const logicalToday = new Date("2026-05-15T12:00:00+09:00");
    const { daysIncludingToday, daysExcludingToday } = calculateFirstCycleDailyProrationDayCounts({
      logicalToday,
      anchorLogicalDate: anchor,
      payday: 15,
      paydayRule: "BEFORE",
    });
    const metrics = calculateDashboardCycleMetrics({
      remainingCycleBudget: 20_000,
      daysUntilNextPaydayIncludingToday: daysIncludingToday,
      daysUntilNextPaydayExcludingToday: daysExcludingToday,
      utilityEstimates: { ELECTRICITY: 0, GAS: 0, WATER: 0 },
      transactions: [],
      isFirstCycle: true,
    });
    expect(metrics.dailyBudgetToday).toBeCloseTo(20_000 / 31, 10);
    expect(metrics.futureDailyBudget).toBeCloseTo(20_000 / 30, 10);
    expect(metrics.dailyBudgetToday).not.toBeCloseTo(20_000 / 32, 10);
    expect(metrics.futureDailyBudget).not.toBeCloseTo(20_000 / 31, 10);
  });
});

describe("calculateNormalCycleDailyProrationDayCounts", () => {
  it("次の給料日前日までを終端にし、旧 calculateDaysUntilNextPayday(給料日当日) より1日少ない", () => {
    const logicalToday = new Date("2026-05-15T12:00:00+09:00");
    const window = calculateCycleWindow({
      referenceDate: logicalToday,
      payday: 25,
      paydayRule: "FIXED",
    });
    expect(formatJstDate(window.nextPaydayDate)).toBe("2026-05-25");

    const counts = calculateNormalCycleDailyProrationDayCounts({
      logicalToday,
      nextPaydayDate: window.nextPaydayDate,
    });
    const range = getHistoryListingLogicalDateRange({
      logicalToday,
      anchorLogicalDate: parseJstDateKeyToDate("2026-04-10"),
      payday: 25,
      paydayRule: "FIXED",
      isFirstCycle: false,
    });
    expect(formatJstDate(range.to)).toBe("2026-05-24");

    const wrongIncluding = calculateDaysUntilNextPayday({
      fromDate: logicalToday,
      nextPayday: window.nextPaydayDate,
      includeToday: true,
    });
    const wrongExcluding = calculateDaysUntilNextPayday({
      fromDate: logicalToday,
      nextPayday: window.nextPaydayDate,
      includeToday: false,
    });
    expect(wrongIncluding).toBe(counts.daysIncludingToday + 1);
    expect(wrongExcluding).toBe(counts.daysExcludingToday + 1);
    expect(counts.daysIncludingToday).toBe(10);
    expect(counts.daysExcludingToday).toBe(9);
  });

  it("通常サイクル最終日では翌日以降の日数が0になり D_future は残額ベースになる", () => {
    const logicalToday = new Date("2026-05-24T12:00:00+09:00");
    const nextPayday = new Date("2026-05-25T00:00:00+09:00");
    const counts = calculateNormalCycleDailyProrationDayCounts({
      logicalToday,
      nextPaydayDate: nextPayday,
    });
    expect(counts.daysIncludingToday).toBe(1);
    expect(counts.daysExcludingToday).toBe(0);
    const future = calculateDailyBudgetFuture({
      remainingCycleBudget: 20_000,
      todaySpent: 0,
      daysUntilNextPaydayExcludingToday: counts.daysExcludingToday,
    });
    expect(future).toBe(20_000);
  });

  it("通常サイクル・残予算 39_000・支出0で分母が意図どおりなら日割りが揃う", () => {
    const logicalToday = new Date("2026-05-15T12:00:00+09:00");
    const window = calculateCycleWindow({
      referenceDate: logicalToday,
      payday: 25,
      paydayRule: "FIXED",
    });
    const { daysIncludingToday, daysExcludingToday } = calculateNormalCycleDailyProrationDayCounts({
      logicalToday,
      nextPaydayDate: window.nextPaydayDate,
    });
    const metrics = calculateDashboardCycleMetrics({
      remainingCycleBudget: 39_000,
      daysUntilNextPaydayIncludingToday: daysIncludingToday,
      daysUntilNextPaydayExcludingToday: daysExcludingToday,
      utilityEstimates: { ELECTRICITY: 0, GAS: 0, WATER: 0 },
      transactions: [],
      isFirstCycle: false,
    });
    expect(metrics.dailyBudgetToday).toBeCloseTo(39_000 / 10, 10);
    expect(metrics.futureDailyBudget).toBeCloseTo(39_000 / 9, 10);
    expect(metrics.dailyBudgetToday).not.toBeCloseTo(39_000 / 11, 10);
    expect(metrics.futureDailyBudget).not.toBeCloseTo(39_000 / 10, 10);
  });

  it("UTC インスタントが暦日とずれても JST キーで履歴終端と一致し、サイクル最終日の分母が壊れない（本番 500 再現系）", () => {
    const nextPayday = new Date("2026-05-25T00:00:00+09:00");
    // JST 2026-05-24 だが UTC では 2026-05-24 00:00（旧実装の startOfDay+toZonedTime が 1 日ずれうる）
    const logicalToday = new Date("2026-05-24T00:00:00.000Z");
    expect(toJstDateString(logicalToday)).toBe("2026-05-24");

    const range = getHistoryListingLogicalDateRange({
      logicalToday,
      anchorLogicalDate: parseJstDateKeyToDate("2026-04-10"),
      payday: 25,
      paydayRule: "FIXED",
      isFirstCycle: false,
    });
    expect(toJstDateString(range.to)).toBe("2026-05-24");

    const counts = calculateNormalCycleDailyProrationDayCounts({
      logicalToday,
      nextPaydayDate: nextPayday,
    });
    expect(counts.daysIncludingToday).toBe(1);
    expect(counts.daysExcludingToday).toBe(0);
  });

  it("論理日キーがサイクル終端より後ろでも throw せず分母をクランプする", () => {
    const logicalToday = parseJstDateKeyToDate("2026-05-24");
    const nextPayday = toJstStartOfDay(parseJstDateKeyToDate("2026-05-21"));
    const counts = calculateNormalCycleDailyProrationDayCounts({
      logicalToday,
      nextPaydayDate: nextPayday,
    });
    expect(counts).toEqual({ daysIncludingToday: 1, daysExcludingToday: 0 });
  });
});

describe("通常サイクルの日次予算と光熱費差額", () => {
  it("今日の残りは当日予算から普通支出のみを差し引く（光熱費差額は混ぜない）", () => {
    const dToday = calculateDailyBudgetToday({
      remainingCycleBudget: 50_000,
      daysUntilNextPaydayIncludingToday: 10,
    });
    expect(dToday).toBe(5_000);
    const remainingToday = calculateRemainingToday({
      dailyBudgetToday: dToday,
      todaySpent: 1_000,
    });
    expect(remainingToday).toBe(4_000);
  });

  it("光熱費差額は翌日以降の日次予算の分子へ反映する", () => {
    const merged = applyUtilityDeltaToRemainingBudget({
      remainingBudget: 50_000,
      utilityDelta: -2_000,
    });
    const dFuture = calculateDailyBudgetFuture({
      remainingCycleBudget: merged,
      todaySpent: 1_000,
      daysUntilNextPaydayExcludingToday: 9,
    });
    expect(dFuture).toBeCloseTo((48_000 - 1_000) / 9, 5);
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
  it("STRICT は余剰を貯金に加算し、繰り越しはゼロにする", () => {
    const result = processMonthlyReset({
      surplusMode: "STRICT",
      currentTotalSavings: 100_000,
      surplus: 5_000,
    });
    expect(result.nextTotalSavings).toBe(105_000);
    expect(result.nextYutoriCarryover).toBe(0);
  });

  it("YUTORI は余剰を繰り越し額として保持する（貯金総額は変わらない）", () => {
    const result = processMonthlyReset({
      surplusMode: "YUTORI",
      currentTotalSavings: 100_000,
      surplus: 5_000,
    });
    expect(result.nextTotalSavings).toBe(100_000);
    expect(result.nextYutoriCarryover).toBe(5_000);
  });

  it("余剰なし（赤字）のとき YUTORI でも繰り越しはゼロ", () => {
    const result = processMonthlyReset({
      surplusMode: "YUTORI",
      currentTotalSavings: 100_000,
      surplus: -3_000,
    });
    expect(result.nextTotalSavings).toBe(100_000);
    expect(result.nextYutoriCarryover).toBe(0);
  });
});

describe("processFirstCycleClose", () => {
  it("初回差額を貯金総額に加算する（超過例）。yutori_carryover は 0 にリセット", () => {
    const result = processFirstCycleClose({
      currentTotalSavings: 90_000,
      initialBudget: 50_000,
      sumPlainNormalSpentInFirstCycle: 60_000,
    });
    expect(result.nextTotalSavings).toBe(80_000);
    expect(result.nextYutoriCarryover).toBe(0);
  });

  it("初回差額が正のときは貯金総額が増える（余剰例）。yutori_carryover は 0 にリセット", () => {
    const result = processFirstCycleClose({
      currentTotalSavings: 90_000,
      initialBudget: 50_000,
      sumPlainNormalSpentInFirstCycle: 40_000,
    });
    expect(result.nextTotalSavings).toBe(100_000);
    expect(result.nextYutoriCarryover).toBe(0);
  });
});

describe("sumPlainNormalExpenseAmounts", () => {
  it("普通支出（光熱費なし）のみ合算する", () => {
    const total = sumPlainNormalExpenseAmounts([
      { type: "NORMAL", utility_type: null, amount: 3_000 },
      { type: "NORMAL", utility_type: "ELECTRICITY", amount: 5_000 },
      { type: "SPECIAL", utility_type: null, amount: 20_000 },
    ]);
    expect(total).toBe(3_000);
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
  it("初回サイクルは initial_budget から前日までの普通支出（光熱費以外）を差し引く", () => {
    const result = calculateNextRemainingCycleBudget({
      isFirstCycle: true,
      surplusMode: "STRICT",
      initialBudget: 120_000,
      yutoriCarryover: 0,
      baseCycleBudget: 95_000,
      confirmedNormalSpentBeforeToday: 12_000,
    });

    expect(result).toBe(108_000);
  });

  it("2回目以降・STRICT は baseCycleBudget のみから確定支出を差し引く（yutori_carryover は無視）", () => {
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
      surplusMode: "STRICT",
      initialBudget: 150_000,
      yutoriCarryover: 30_000,
      baseCycleBudget,
      confirmedNormalSpentBeforeToday: 40_000,
    });

    expect(baseCycleBudget).toBeCloseTo(138_714.285, 2);
    expect(result).toBeCloseTo(98_714.285, 2);
  });

  it("2回目以降・YUTORI は baseCycleBudget + yutori_carryover から確定支出を差し引く", () => {
    const monthlyReset = processMonthlyReset({
      surplusMode: "YUTORI",
      currentTotalSavings: 200_000,
      surplus: 25_000,
    });
    expect(monthlyReset.nextYutoriCarryover).toBe(25_000);

    const remaining = calculateNextRemainingCycleBudget({
      isFirstCycle: false,
      surplusMode: "YUTORI",
      initialBudget: 50_000,
      yutoriCarryover: monthlyReset.nextYutoriCarryover,
      baseCycleBudget: 100_000,
      confirmedNormalSpentBeforeToday: 0,
    });
    expect(remaining).toBe(125_000);
  });

  it("2回目以降・STRICT では yutori_carryover が正値でも baseCycleBudget のみを母数にする", () => {
    const result = calculateNextRemainingCycleBudget({
      isFirstCycle: false,
      surplusMode: "STRICT",
      initialBudget: 200_000,
      yutoriCarryover: 30_000,
      baseCycleBudget: 100_000,
      confirmedNormalSpentBeforeToday: 10_000,
    });
    expect(result).toBe(90_000);
  });

  it("2回目以降・YUTORI で yutori_carryover が 0 のとき baseCycleBudget のみになる", () => {
    const result = calculateNextRemainingCycleBudget({
      isFirstCycle: false,
      surplusMode: "YUTORI",
      initialBudget: 50_000,
      yutoriCarryover: 0,
      baseCycleBudget: 100_000,
      confirmedNormalSpentBeforeToday: 20_000,
    });
    expect(result).toBe(80_000);
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

describe("getHistoryListingLogicalDateRange", () => {
  it("初回サイクルではアンカー論理日から初回終了論理日までを返す", () => {
    const anchor = parseJstDateKeyToDate("2026-04-10");
    const result = getHistoryListingLogicalDateRange({
      logicalToday: new Date("2026-04-15T09:00:00+09:00"),
      anchorLogicalDate: anchor,
      payday: 24,
      paydayRule: "FIXED",
      isFirstCycle: true,
    });
    expect(formatJstDate(result.from)).toBe("2026-04-10");
    expect(formatJstDate(result.to)).toBe("2026-04-23");
  });

  it("通常サイクルではサイクル開始の給料日から次の給料日前日までを返す", () => {
    const anchor = parseJstDateKeyToDate("2026-04-10");
    const result = getHistoryListingLogicalDateRange({
      logicalToday: new Date("2026-05-15T09:00:00+09:00"),
      anchorLogicalDate: anchor,
      payday: 25,
      paydayRule: "FIXED",
      isFirstCycle: false,
    });
    expect(formatJstDate(result.from)).toBe("2026-04-25");
    expect(formatJstDate(result.to)).toBe("2026-05-24");
  });
});

describe("isWithinFirstCycle", () => {
  const anchorApril10 = parseJstDateKeyToDate("2026-04-10");

  it("初回当日は初回サイクル内として判定される", () => {
    const result = isWithinFirstCycle({
      anchorLogicalDate: anchorApril10,
      referenceDate: new Date("2026-04-10T15:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("初回中日も初回サイクル内として判定される", () => {
    const result = isWithinFirstCycle({
      anchorLogicalDate: anchorApril10,
      referenceDate: new Date("2026-04-15T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("初回最終日(最初の給料日前日)は初回サイクル内として判定される", () => {
    const result = isWithinFirstCycle({
      anchorLogicalDate: anchorApril10,
      referenceDate: new Date("2026-04-23T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("2回目初日(最初の給料日)は初回サイクル外として判定される", () => {
    const result = isWithinFirstCycle({
      anchorLogicalDate: anchorApril10,
      referenceDate: new Date("2026-04-24T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(false);
  });

  it("アンカーが27:00前日付と一致する場合も初回サイクル内として判定される", () => {
    const anchorApril9 = parseJstDateKeyToDate("2026-04-09");
    const result = isWithinFirstCycle({
      anchorLogicalDate: anchorApril9,
      referenceDate: new Date("2026-04-09T12:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(result).toBe(true);
  });

  it("オンボーディング論理日が給料日当日でも初回サイクルは空にならない", () => {
    const anchorApril24 = parseJstDateKeyToDate("2026-04-24");
    const duringFirstCycle = isWithinFirstCycle({
      anchorLogicalDate: anchorApril24,
      referenceDate: new Date("2026-05-10T09:00:00+09:00"),
      payday: 24,
      paydayRule: "FIXED",
    });

    expect(duringFirstCycle).toBe(true);
  });

  it("オンボーディング論理日が給料日当日の場合は次回給料日当日にfalseになる", () => {
    const anchorApril24 = parseJstDateKeyToDate("2026-04-24");
    const result = isWithinFirstCycle({
      anchorLogicalDate: anchorApril24,
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

  it("初回サイクル外では送信値に関わらず既存 initial_budget を保持する", () => {
    const result = resolveInitialBudgetForSettingsUpdate({
      isWithinFirstCycle: false,
      existingInitialBudget: 80_000,
      submittedInitialBudget: 65_000,
    });

    expect(result).toBe(80_000);
  });
});

describe("calculateYutoriCarryoverDisplay", () => {
  it("YUTORI のとき yutori_carryover をそのまま返す", () => {
    expect(
      calculateYutoriCarryoverDisplay({
        surplusMode: "YUTORI",
        yutoriCarryover: 30_000,
      }),
    ).toBe(30_000);
  });

  it("YUTORI で繰り越しがゼロのとき 0 を返す", () => {
    expect(
      calculateYutoriCarryoverDisplay({
        surplusMode: "YUTORI",
        yutoriCarryover: 0,
      }),
    ).toBe(0);
  });

  it("STRICT のとき null を返す", () => {
    expect(
      calculateYutoriCarryoverDisplay({
        surplusMode: "STRICT",
        yutoriCarryover: 30_000,
      }),
    ).toBeNull();
  });
});

describe("resolveCurrentTotalSavingsForProfileSettingsUpdate", () => {
  it("初回サイクル中に次の給料日まで使う予算を変えたとき、内訳式が成り立っていれば貯金を再計算する", () => {
    const result = resolveCurrentTotalSavingsForProfileSettingsUpdate({
      isWithinFirstCycle: true,
      initialTotalAssets: 140_000,
      existingInitialBudget: 50_000,
      submittedInitialBudget: 60_000,
      existingCurrentTotalSavings: 90_000,
    });

    expect(result).toBe(80_000);
  });

  it("初回サイクル中で予算を変えていないときは既存の貯金総額を維持する", () => {
    const result = resolveCurrentTotalSavingsForProfileSettingsUpdate({
      isWithinFirstCycle: true,
      initialTotalAssets: 140_000,
      existingInitialBudget: 50_000,
      submittedInitialBudget: 50_000,
      existingCurrentTotalSavings: 90_000,
    });

    expect(result).toBe(90_000);
  });

  it("通常サイクル中は既存の貯金総額を維持する", () => {
    const result = resolveCurrentTotalSavingsForProfileSettingsUpdate({
      isWithinFirstCycle: false,
      initialTotalAssets: 140_000,
      existingInitialBudget: 50_000,
      submittedInitialBudget: 60_000,
      existingCurrentTotalSavings: 90_000,
    });

    expect(result).toBe(90_000);
  });

  it("初回サイクル中でも貯金が内訳式とずれていれば予算変更で巻き戻さない", () => {
    const result = resolveCurrentTotalSavingsForProfileSettingsUpdate({
      isWithinFirstCycle: true,
      initialTotalAssets: 140_000,
      existingInitialBudget: 50_000,
      submittedInitialBudget: 60_000,
      existingCurrentTotalSavings: 85_000,
    });

    expect(result).toBe(85_000);
  });
});

describe("isFirstCycleInitialBudgetExceedingTotalAssets", () => {
  it("初回サイクル中かつ次の給料日まで使う予算が全財産を超えるとき true", () => {
    expect(
      isFirstCycleInitialBudgetExceedingTotalAssets({
        isWithinFirstCycle: true,
        submittedInitialBudget: 150_000,
        initialTotalAssets: 140_000,
      }),
    ).toBe(true);
  });

  it("初回サイクル中でも予算が全財産以下なら false", () => {
    expect(
      isFirstCycleInitialBudgetExceedingTotalAssets({
        isWithinFirstCycle: true,
        submittedInitialBudget: 140_000,
        initialTotalAssets: 140_000,
      }),
    ).toBe(false);
  });

  it("通常サイクル中は予算が全財産を超えても false（このガードは初回専用）", () => {
    expect(
      isFirstCycleInitialBudgetExceedingTotalAssets({
        isWithinFirstCycle: false,
        submittedInitialBudget: 200_000,
        initialTotalAssets: 140_000,
      }),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// タイムゾーン（UTC サーバー）リグレッションテスト
//
// Vercel 本番は UTC で動作する。date-fns の endOfMonth / addMonths は
// サーバーローカル TZ に依存するため、UTC 環境では月末日計算や月送りが
// ずれて給料日・サイクル判定が壊れる。
// 以下のテストは UTC 相当の Date 値（".000Z" 形式）を明示的に渡すことで、
// 修正が正しく機能することを保証するリグレッションスイートである。
// ─────────────────────────────────────────────────────────────────────
describe("タイムゾーン UTC リグレッション", () => {
  // ユーザー実環境：payday=25、BEFORE、anchor=2026-05-15
  // Vercel での onboarding 完了時刻相当（JST 14:50 = UTC 05:50）
  const utcOnboardingTimestamp = new Date("2026-05-15T05:50:00Z");
  const anchor = parseJstDateKeyToDate("2026-05-15");

  describe("calculateNextPayday — UTC タイムスタンプを渡しても正しい給料日を返す", () => {
    it("payday=25 BEFORE: 2026年5月は月曜で平日なので 5/25 そのまま", () => {
      // 5月25日は月曜（2026-01-01=木+144日%7=+4=月）→ 前倒し不要
      const result = calculateNextPayday({
        fromDate: utcOnboardingTimestamp,
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(formatJstDate(result)).toBe("2026-05-25");
    });

    it("payday=25 BEFORE: 4月25日は土曜なので前倒しで 4/24（金）", () => {
      // 2026年4月25日は土曜 → BEFORE → 4月24日（金・祝日でない）
      const result = calculateNextPayday({
        fromDate: new Date("2026-04-01T05:50:00Z"),
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(formatJstDate(result)).toBe("2026-04-24");
    });

    it("月末が 2 月: payday=31 を月末日（28日）に補正する（UTC タイムスタンプ）", () => {
      const result = calculateNextPayday({
        fromDate: new Date("2026-02-01T00:30:00Z"), // JST 09:30
        payday: 31,
        paydayRule: "FIXED",
      });
      expect(formatJstDate(result)).toBe("2026-02-28");
    });
  });

  describe("calculateTargetDateFromDuration — UTC 環境でも目標日が正しく計算される", () => {
    it("anchor=2026-05-15、12ヶ月後の給料日は 2027-05-25（火・祝日なし→補正なし）", () => {
      // 修正前バグ: monthLastDay=1 → payday=1 → 5/1(土) → BEFORE で4/30を「昭和の日」
      // と誤判定 → 4/29 という誤った値が返っていた
      const result = calculateTargetDateFromDuration({
        anchorLogicalDate: anchor,
        durationMonths: 12,
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(formatJstDate(result)).toBe("2027-05-25");
    });

    it("anchor=2026-05-15、1ヶ月後の給料日は 2026-06-25（木・祝日なし→補正なし）", () => {
      const result = calculateTargetDateFromDuration({
        anchorLogicalDate: anchor,
        durationMonths: 1,
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(formatJstDate(result)).toBe("2026-06-25");
    });
  });

  describe("isWithinFirstCycle — UTC タイムスタンプで初回サイクル判定が正しく動く", () => {
    it("オンボーディング完了の UTC 日時（JST 14:50）は初回サイクル内", () => {
      // 修正前バグ: firstCycleEnd が「4月30日」になり anchor(5/15) より過去のため
      // isWithinFirstCycle が false を返していた
      const result = isWithinFirstCycle({
        anchorLogicalDate: anchor,
        referenceDate: utcOnboardingTimestamp,
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(result).toBe(true);
    });

    it("初回サイクル中盤（5月20日 UTC 相当）も初回サイクル内", () => {
      const result = isWithinFirstCycle({
        anchorLogicalDate: anchor,
        referenceDate: new Date("2026-05-20T05:50:00Z"),
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(result).toBe(true);
    });

    it("初回サイクル最終日（5月24日）は初回サイクル内", () => {
      const result = isWithinFirstCycle({
        anchorLogicalDate: anchor,
        referenceDate: new Date("2026-05-24T05:50:00Z"),
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(result).toBe(true);
    });

    it("最初の給料日当日（5月25日）は初回サイクル外", () => {
      const result = isWithinFirstCycle({
        anchorLogicalDate: anchor,
        referenceDate: new Date("2026-05-25T05:50:00Z"),
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(result).toBe(false);
    });
  });

  describe("calculateCycleWindow — UTC 環境でサイクル開始日・次の給料日が正しく返る", () => {
    it("5月15日（給料日前）のサイクルは 4/24 開始・次の給料日 5/25", () => {
      // 修正前バグ: cycleStart = 5/1、nextPayday = 5/1（同日）→ 履歴範囲が逆転
      const result = calculateCycleWindow({
        referenceDate: utcOnboardingTimestamp,
        payday: 25,
        paydayRule: "BEFORE",
      });
      expect(formatJstDate(result.cycleStartDate)).toBe("2026-04-24");
      expect(formatJstDate(result.nextPaydayDate)).toBe("2026-05-25");
    });
  });
});
