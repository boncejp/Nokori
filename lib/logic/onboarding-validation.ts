import { isWithinFirstCycle, parseJstDateKeyToDate } from "@/lib/logic/budget-logic";

export const PAYDAY_RULE_VALUES = ["BEFORE", "AFTER", "FIXED"] as const;
export const SURPLUS_MODE_VALUES = ["STRICT", "YUTORI"] as const;

export type PaydayRule = (typeof PAYDAY_RULE_VALUES)[number];
export type SurplusMode = (typeof SURPLUS_MODE_VALUES)[number];

export type OnboardingProfileInput = {
  readonly target_amount: number;
  readonly target_years: number;
  readonly target_months: number;
  readonly target_duration_months: number;
  readonly initial_total_assets: number;
  readonly payday: number;
  readonly payday_rule: PaydayRule;
  readonly fixed_costs: number;
  readonly estimated_electricity: number;
  readonly estimated_gas: number;
  readonly estimated_water: number;
  readonly surplus_mode: SurplusMode;
  readonly initial_budget: number;
};

/** 設定画面 PATCH 用（全財産はサーバー側の既存値を維持し、フォームからは送らない） */
export type ProfileSettingsFormInput = Omit<OnboardingProfileInput, "initial_total_assets"> & {
  readonly monthly_income: number;
};

/** `validateProfileSettingsPayload` で初回判定・通常時の initial_budget 省略に使う。 */
export type ProfileSettingsValidationContext = {
  readonly anchorLogicalDateKey: string;
  readonly logicalToday: Date;
  /** `isWithinFirstCycle` の 27:00 跨ぎ補正用。省略時は補正しない。 */
  readonly wallClockNow?: Date;
  readonly existingInitialBudget: number;
  /** 初回サイクルでは月収フィールドを出さないため、未送信時はこの値を採用する。 */
  readonly existingMonthlyIncome: number;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errorMessage: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumberField(
  source: Record<string, unknown>,
  fieldName: string,
  label: string,
): ValidationResult<number> {
  const rawValue = source[fieldName];
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return { success: false, errorMessage: `${label}を入力してください。` };
  }

  const normalizedValue = rawValue.replace(/,/g, "");
  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue)) {
    return { success: false, errorMessage: `${label}は数値で入力してください。` };
  }
  if (parsedValue < 0) {
    return { success: false, errorMessage: `${label}は0以上で入力してください。` };
  }

  return { success: true, data: Math.floor(parsedValue) };
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

  const targetYearsResult = parseNumberField(rawPayload, "target_years", "達成期限（年）");
  if (!targetYearsResult.success) return targetYearsResult;
  if (targetYearsResult.data < 0 || targetYearsResult.data > 20) {
    return { success: false, errorMessage: "達成期限（年）は0〜20で選択してください。" };
  }

  const targetMonthsResult = parseNumberField(rawPayload, "target_months", "達成期限（月）");
  if (!targetMonthsResult.success) return targetMonthsResult;
  if (targetMonthsResult.data < 0 || targetMonthsResult.data > 11) {
    return { success: false, errorMessage: "達成期限（月）は0〜11で選択してください。" };
  }

  const targetDurationMonths = targetYearsResult.data * 12 + targetMonthsResult.data;
  if (targetDurationMonths < 1) {
    return { success: false, errorMessage: "達成期限は1か月以上になるように選択してください。" };
  }

  const initialTotalAssetsResult = parseNumberField(rawPayload, "initial_total_assets", "現在の全財産");
  if (!initialTotalAssetsResult.success) return initialTotalAssetsResult;

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

  const initialBudgetResult = parseNumberField(
    rawPayload,
    "initial_budget",
    "次の給料日まで使う予算",
  );
  if (!initialBudgetResult.success) return initialBudgetResult;

  if (initialBudgetResult.data > initialTotalAssetsResult.data) {
    return {
      success: false,
      errorMessage:
        "次の給料日まで使う予算は、現在の全財産以下で入力してください。全財産より大きい金額は登録できません。",
    };
  }

  return {
    success: true,
    data: {
      target_amount: targetAmountResult.data,
      target_years: targetYearsResult.data,
      target_months: targetMonthsResult.data,
      target_duration_months: targetDurationMonths,
      initial_total_assets: initialTotalAssetsResult.data,
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

export function validateProfileSettingsPayload(
  rawPayload: unknown,
  context: ProfileSettingsValidationContext,
): ValidationResult<ProfileSettingsFormInput> {
  if (!isRecord(rawPayload)) {
    return { success: false, errorMessage: "送信データの形式が不正です。" };
  }

  const targetAmountResult = parseNumberField(rawPayload, "target_amount", "目標金額");
  if (!targetAmountResult.success) return targetAmountResult;

  const targetYearsResult = parseNumberField(rawPayload, "target_years", "達成期限（年）");
  if (!targetYearsResult.success) return targetYearsResult;
  if (targetYearsResult.data < 0 || targetYearsResult.data > 20) {
    return { success: false, errorMessage: "達成期限（年）は0〜20で選択してください。" };
  }

  const targetMonthsResult = parseNumberField(rawPayload, "target_months", "達成期限（月）");
  if (!targetMonthsResult.success) return targetMonthsResult;
  if (targetMonthsResult.data < 0 || targetMonthsResult.data > 11) {
    return { success: false, errorMessage: "達成期限（月）は0〜11で選択してください。" };
  }

  const targetDurationMonths = targetYearsResult.data * 12 + targetMonthsResult.data;
  if (targetDurationMonths < 1) {
    return { success: false, errorMessage: "達成期限は1か月以上になるように選択してください。" };
  }

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

  const anchorLogicalDate = parseJstDateKeyToDate(context.anchorLogicalDateKey);
  const withinFirstCycle = isWithinFirstCycle({
    anchorLogicalDate,
    referenceDate: context.logicalToday,
    payday: paydayResult.data,
    paydayRule: paydayRuleResult.data,
    wallClockNow: context.wallClockNow,
  });

  let monthlyIncome: number;
  if (withinFirstCycle) {
    const rawMonthly = rawPayload.monthly_income;
    const isMissing =
      typeof rawMonthly === "undefined" ||
      rawMonthly === null ||
      (typeof rawMonthly === "string" && rawMonthly.trim().length === 0);
    if (isMissing) {
      monthlyIncome = context.existingMonthlyIncome;
    } else {
      const monthlyIncomeResult = parseNumberField(rawPayload, "monthly_income", "月収（手取り）");
      if (!monthlyIncomeResult.success) return monthlyIncomeResult;
      monthlyIncome = monthlyIncomeResult.data;
    }
  } else {
    const monthlyIncomeResult = parseNumberField(rawPayload, "monthly_income", "月収（手取り）");
    if (!monthlyIncomeResult.success) return monthlyIncomeResult;
    monthlyIncome = monthlyIncomeResult.data;
  }

  let initialBudget: number;
  if (withinFirstCycle) {
    const initialBudgetResult = parseNumberField(
      rawPayload,
      "initial_budget",
      "次の給料日まで使う予算",
    );
    if (!initialBudgetResult.success) return initialBudgetResult;
    initialBudget = initialBudgetResult.data;
  } else {
    const rawInitial = rawPayload.initial_budget;
    const isMissing =
      typeof rawInitial === "undefined" ||
      rawInitial === null ||
      (typeof rawInitial === "string" && rawInitial.trim().length === 0);
    if (isMissing) {
      initialBudget = context.existingInitialBudget;
    } else {
      const initialBudgetResult = parseNumberField(
        rawPayload,
        "initial_budget",
        "次の給料日まで使う予算",
      );
      if (!initialBudgetResult.success) return initialBudgetResult;
      initialBudget = initialBudgetResult.data;
    }
  }

  return {
    success: true,
    data: {
      target_amount: targetAmountResult.data,
      target_years: targetYearsResult.data,
      target_months: targetMonthsResult.data,
      target_duration_months: targetDurationMonths,
      monthly_income: monthlyIncome,
      payday: paydayResult.data,
      payday_rule: paydayRuleResult.data,
      fixed_costs: fixedCostsResult.data,
      estimated_electricity: estimatedElectricityResult.data,
      estimated_gas: estimatedGasResult.data,
      estimated_water: estimatedWaterResult.data,
      surplus_mode: surplusModeResult.data,
      initial_budget: initialBudget,
    },
  };
}
