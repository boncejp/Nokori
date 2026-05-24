import { describe, expect, it } from "vitest";

import {
  FUTURE_DAILY_BUDGET_MASKED_LABEL,
  shouldMaskFutureDailyBudgetDisplay,
} from "./future-daily-budget-display";

describe("shouldMaskFutureDailyBudgetDisplay", () => {
  it("当日を除く残り日数が 0 のときマスクする（サイクル最終日）", () => {
    expect(shouldMaskFutureDailyBudgetDisplay({ daysUntilNextPaydayExcludingToday: 0 })).toBe(true);
  });

  it("当日を除く残り日数が 1 以上のときは表示する", () => {
    expect(shouldMaskFutureDailyBudgetDisplay({ daysUntilNextPaydayExcludingToday: 1 })).toBe(false);
    expect(shouldMaskFutureDailyBudgetDisplay({ daysUntilNextPaydayExcludingToday: 10 })).toBe(false);
  });
});

describe("FUTURE_DAILY_BUDGET_MASKED_LABEL", () => {
  it("ダッシュボード表示用のプレースホルダ", () => {
    expect(FUTURE_DAILY_BUDGET_MASKED_LABEL).toBe("—");
  });
});
