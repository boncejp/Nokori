import { describe, expect, it } from "vitest";

import { validateOnboardingPayload } from "./onboarding-validation";

const VALID_PAYLOAD = {
  target_amount: "1000000",
  target_years: "1",
  target_months: "0",
  current_total_savings: "100000",
  monthly_income: "300000",
  payday: "24",
  payday_rule: "FIXED",
  fixed_costs: "80000",
  estimated_electricity: "10000",
  estimated_gas: "6000",
  estimated_water: "4000",
  surplus_mode: "STRICT",
  initial_budget: "120000",
} as const;

describe("validateOnboardingPayload", () => {
  it("カンマ付き数値文字列を受け入れる", () => {
    const result = validateOnboardingPayload({
      ...VALID_PAYLOAD,
      target_amount: "1,000,000",
      current_total_savings: "100,000",
      monthly_income: "300,000",
      fixed_costs: "80,000",
      estimated_electricity: "10,000",
      estimated_gas: "6,000",
      estimated_water: "4,000",
      initial_budget: "120,000",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected validation success");
    }
    expect(result.data.target_amount).toBe(1_000_000);
    expect(result.data.initial_budget).toBe(120_000);
  });

  it("0年0か月をバリデーションエラーにする", () => {
    const result = validateOnboardingPayload({
      ...VALID_PAYLOAD,
      target_years: "0",
      target_months: "0",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected validation error");
    }
    expect(result.errorMessage).toBe("達成期限は1か月以上になるように選択してください。");
  });

  it("年/月入力から合計月数を返す", () => {
    const result = validateOnboardingPayload({
      ...VALID_PAYLOAD,
      target_years: "2",
      target_months: "3",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected validation success");
    }
    expect(result.data.target_duration_months).toBe(27);
    expect(result.data.target_years).toBe(2);
    expect(result.data.target_months).toBe(3);
  });
});
