export const PAYDAY_RULE_VALUES = ["BEFORE", "AFTER", "FIXED"] as const;
export const SURPLUS_MODE_VALUES = ["STRICT", "YUTORI"] as const;

export type PaydayRule = (typeof PAYDAY_RULE_VALUES)[number];
export type SurplusMode = (typeof SURPLUS_MODE_VALUES)[number];

export type OnboardingProfileInput = {
  readonly target_amount: number;
  readonly target_date: string;
  readonly current_total_savings: number;
  readonly monthly_income: number;
  readonly payday: number;
  readonly payday_rule: PaydayRule;
  readonly fixed_costs: number;
  readonly estimated_electricity: number;
  readonly estimated_gas: number;
  readonly estimated_water: number;
  readonly surplus_mode: SurplusMode;
  readonly initial_budget: number;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errorMessage: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumberField(
  source: Record<string, unknown>,
  fieldName: keyof OnboardingProfileInput,
  label: string,
): ValidationResult<number> {
  const rawValue = source[fieldName];
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return { success: false, errorMessage: `${label}を入力してください。` };
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return { success: false, errorMessage: `${label}は数値で入力してください。` };
  }
  if (parsedValue < 0) {
    return { success: false, errorMessage: `${label}は0以上で入力してください。` };
  }

  return { success: true, data: Math.floor(parsedValue) };
}

function parseTargetDate(rawValue: unknown): ValidationResult<string> {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return { success: false, errorMessage: "達成期限を入力してください。" };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(rawValue)) {
    return { success: false, errorMessage: "達成期限の形式が不正です。" };
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, errorMessage: "達成期限が不正です。" };
  }

  return { success: true, data: rawValue };
}

function parsePaydayRule(rawValue: unknown): ValidationResult<PaydayRule> {
  if (typeof rawValue !== "string") {
    return { success: false, errorMessage: "給料日ルールを選択してください。" };
  }
  const matchedPaydayRule = PAYDAY_RULE_VALUES.find((value) => value === rawValue);
  if (typeof matchedPaydayRule === "undefined") {
    return { success: false, errorMessage: "給料日ルールが不正です。" };
  }
  return { success: true, data: matchedPaydayRule };
}

function parseSurplusMode(rawValue: unknown): ValidationResult<SurplusMode> {
  if (typeof rawValue !== "string") {
    return { success: false, errorMessage: "余剰金モードを選択してください。" };
  }
  const matchedSurplusMode = SURPLUS_MODE_VALUES.find((value) => value === rawValue);
  if (typeof matchedSurplusMode === "undefined") {
    return { success: false, errorMessage: "余剰金モードが不正です。" };
  }
  return { success: true, data: matchedSurplusMode };
}

export function validateOnboardingPayload(rawPayload: unknown): ValidationResult<OnboardingProfileInput> {
  if (!isRecord(rawPayload)) {
    return { success: false, errorMessage: "送信データの形式が不正です。" };
  }

  const targetAmountResult = parseNumberField(rawPayload, "target_amount", "目標金額");
  if (!targetAmountResult.success) return targetAmountResult;

  const targetDateResult = parseTargetDate(rawPayload.target_date);
  if (!targetDateResult.success) return targetDateResult;

  const currentSavingsResult = parseNumberField(
    rawPayload,
    "current_total_savings",
    "現在の貯金総額",
  );
  if (!currentSavingsResult.success) return currentSavingsResult;

  const monthlyIncomeResult = parseNumberField(rawPayload, "monthly_income", "月収");
  if (!monthlyIncomeResult.success) return monthlyIncomeResult;

  const paydayResult = parseNumberField(rawPayload, "payday", "給料日");
  if (!paydayResult.success) return paydayResult;
  if (paydayResult.data < 1 || paydayResult.data > 31) {
    return { success: false, errorMessage: "給料日は1〜31の範囲で入力してください。" };
  }

  const paydayRuleResult = parsePaydayRule(rawPayload.payday_rule);
  if (!paydayRuleResult.success) return paydayRuleResult;

  const fixedCostsResult = parseNumberField(rawPayload, "fixed_costs", "固定費");
  if (!fixedCostsResult.success) return fixedCostsResult;

  const estimatedElectricityResult = parseNumberField(
    rawPayload,
    "estimated_electricity",
    "電気代概算",
  );
  if (!estimatedElectricityResult.success) return estimatedElectricityResult;

  const estimatedGasResult = parseNumberField(rawPayload, "estimated_gas", "ガス代概算");
  if (!estimatedGasResult.success) return estimatedGasResult;

  const estimatedWaterResult = parseNumberField(rawPayload, "estimated_water", "水道代概算");
  if (!estimatedWaterResult.success) return estimatedWaterResult;

  const surplusModeResult = parseSurplusMode(rawPayload.surplus_mode);
  if (!surplusModeResult.success) return surplusModeResult;

  const initialBudgetResult = parseNumberField(rawPayload, "initial_budget", "初回開始予算");
  if (!initialBudgetResult.success) return initialBudgetResult;

  return {
    success: true,
    data: {
      target_amount: targetAmountResult.data,
      target_date: targetDateResult.data,
      current_total_savings: currentSavingsResult.data,
      monthly_income: monthlyIncomeResult.data,
      payday: paydayResult.data,
      payday_rule: paydayRuleResult.data,
      fixed_costs: fixedCostsResult.data,
      estimated_electricity: estimatedElectricityResult.data,
      estimated_gas: estimatedGasResult.data,
      estimated_water: estimatedWaterResult.data,
      surplus_mode: surplusModeResult.data,
      initial_budget: initialBudgetResult.data,
    },
  };
}
