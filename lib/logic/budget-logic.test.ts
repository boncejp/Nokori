import { describe, expect, it } from "vitest";
import {
  applyUtilityDeltaToRemainingBudget,
  calculateDailyBudgetFuture,
  calculateDailyBudgetToday,
  calculateDaysUntilNextPayday,
  calculateNextPayday,
  calculateRemainingToday,
  calculateUtilityBudgetDelta,
  getLogicalDate,
  processMonthlyReset,
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
