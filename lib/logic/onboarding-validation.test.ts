import { describe, expect, it } from "vitest";

import { validateOnboardingPayload, validateProfileSettingsPayload } from "./onboarding-validation";
import { parseJstDateKeyToDate } from "./budget-logic";

const VALID_PAYLOAD = {
  target_amount: "1000000",
  target_years: "1",
  target_months: "0",
  initial_total_assets: "200000",
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
      initial_total_assets: "200,000",
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
    expect(result.data.initial_total_assets).toBe(200_000);
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

  it("次の給料日まで使う予算が現在の全財産を超えるとエラーにする", () => {
    const result = validateOnboardingPayload({
      ...VALID_PAYLOAD,
      initial_total_assets: "50000",
      initial_budget: "80000",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected validation error");
    }
    expect(result.errorMessage).toContain("全財産以下");
  });
});

describe("validateProfileSettingsPayload", () => {
  const normalCycleContext = {
    anchorLogicalDateKey: "2026-05-01",
    logicalToday: parseJstDateKeyToDate("2026-06-15"),
    existingInitialBudget: 120_000,
    existingMonthlyIncome: 280_000,
  };

  const firstCycleContext = {
    anchorLogicalDateKey: "2026-05-10",
    logicalToday: parseJstDateKeyToDate("2026-05-14"),
    existingInitialBudget: 50_000,
    existingMonthlyIncome: 0,
  };

  it("オンボーディングと同形式のフィールドを検証する", () => {
    const result = validateProfileSettingsPayload(
      {
        target_amount: "900000",
        target_years: "1",
        target_months: "0",
        monthly_income: "280000",
        payday: "25",
        payday_rule: "FIXED",
        fixed_costs: "70000",
        estimated_electricity: "8000",
        estimated_gas: "5000",
        estimated_water: "3000",
        surplus_mode: "YUTORI",
        initial_budget: "100000",
      },
      normalCycleContext,
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected validation success");
    }
    expect(result.data.initial_budget).toBe(100_000);
  });

  it("通常サイクルで initial_budget を省略したときは既存値で検証する", () => {
    const result = validateProfileSettingsPayload(
      {
        target_amount: "900000",
        target_years: "1",
        target_months: "0",
        monthly_income: "280000",
        payday: "25",
        payday_rule: "FIXED",
        fixed_costs: "70000",
        estimated_electricity: "8000",
        estimated_gas: "5000",
        estimated_water: "3000",
        surplus_mode: "STRICT",
      },
      normalCycleContext,
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected validation success");
    }
    expect(result.data.initial_budget).toBe(120_000);
  });

  it("初回サイクルで monthly_income を送らないときは既存の月収を採用する", () => {
    const result = validateProfileSettingsPayload(
      {
        target_amount: "900000",
        target_years: "1",
        target_months: "0",
        payday: "25",
        payday_rule: "FIXED",
        fixed_costs: "70000",
        estimated_electricity: "8000",
        estimated_gas: "5000",
        estimated_water: "3000",
        surplus_mode: "STRICT",
        initial_budget: "45000",
      },
      firstCycleContext,
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected validation success");
    }
    expect(result.data.monthly_income).toBe(0);
    expect(result.data.initial_budget).toBe(45_000);
  });
});
