import { requireAuthenticatedUser } from "@/lib/api/auth";
import {
  apiServerErrorResponse,
  apiSuccessResponse,
  apiValidationErrorResponse,
} from "@/lib/api/responses";
import {
  calculateTargetDateFromDuration,
  getLogicalDate,
  isFirstCycleInitialBudgetExceedingTotalAssets,
  isWithinFirstCycle,
  parseJstDateKeyToDate,
  resolveCurrentTotalSavingsForProfileSettingsUpdate,
  resolveInitialBudgetForSettingsUpdate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { validateProfileSettingsPayload } from "@/lib/logic/onboarding-validation";
import { fetchProfileByUserId, upsertOwnProfile } from "@/lib/supabase/profiles";

export async function PATCH(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const rawBody: unknown = await request.json();
  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    return apiValidationErrorResponse(
      "プロフィールが見つかりません。オンボーディングを完了してください。",
    );
  }

  const anchorLogicalDateKey = profileResult.data.target_anchor_logical_date;
  const anchorLogicalDate = parseJstDateKeyToDate(anchorLogicalDateKey);
  const logicalNow = getLogicalDate(new Date());
  const validationResult = validateProfileSettingsPayload(rawBody, {
    anchorLogicalDateKey,
    logicalToday: logicalNow,
    existingInitialBudget: profileResult.data.initial_budget,
    existingMonthlyIncome: profileResult.data.monthly_income,
  });
  if (!validationResult.success) {
    return apiValidationErrorResponse(validationResult.errorMessage);
  }

  const firstCycleWithSubmittedPayday = isWithinFirstCycle({
    anchorLogicalDate,
    referenceDate: logicalNow,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  if (
    isFirstCycleInitialBudgetExceedingTotalAssets({
      isWithinFirstCycle: firstCycleWithSubmittedPayday,
      submittedInitialBudget: validationResult.data.initial_budget,
      initialTotalAssets: profileResult.data.initial_total_assets,
    })
  ) {
    return apiValidationErrorResponse(
      "次の給料日まで使う予算は、オンボーディング時点の現在の全財産以下にしてください。全財産より大きい金額は登録できません。",
    );
  }

  const recalculatedTargetDate = calculateTargetDateFromDuration({
    anchorLogicalDate,
    durationMonths: validationResult.data.target_duration_months,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  const resolvedInitialBudget = resolveInitialBudgetForSettingsUpdate({
    isWithinFirstCycle: firstCycleWithSubmittedPayday,
    existingInitialBudget: profileResult.data.initial_budget,
    submittedInitialBudget: validationResult.data.initial_budget,
  });
  const resolvedCurrentTotalSavings = resolveCurrentTotalSavingsForProfileSettingsUpdate({
    isWithinFirstCycle: firstCycleWithSubmittedPayday,
    initialTotalAssets: profileResult.data.initial_total_assets,
    existingInitialBudget: profileResult.data.initial_budget,
    submittedInitialBudget: validationResult.data.initial_budget,
    existingCurrentTotalSavings: profileResult.data.current_total_savings,
  });

  const updateResult = await upsertOwnProfile(supabase, {
    id: user.id,
    target_amount: validationResult.data.target_amount,
    target_duration_months: validationResult.data.target_duration_months,
    monthly_income: validationResult.data.monthly_income,
    payday: validationResult.data.payday,
    payday_rule: validationResult.data.payday_rule,
    fixed_costs: validationResult.data.fixed_costs,
    estimated_electricity: validationResult.data.estimated_electricity,
    estimated_gas: validationResult.data.estimated_gas,
    estimated_water: validationResult.data.estimated_water,
    surplus_mode: validationResult.data.surplus_mode,
    initial_budget: resolvedInitialBudget,
    current_total_savings: resolvedCurrentTotalSavings,
    initial_total_assets: profileResult.data.initial_total_assets,
    target_date: toJstDateString(recalculatedTargetDate),
    target_anchor_logical_date: anchorLogicalDateKey,
  });

  if (!updateResult.success) {
    console.error("[api/profile] profile upsert failed", {
      userId: user.id,
      message: updateResult.error.message,
    });
    return apiServerErrorResponse(
      "プロフィールの更新に失敗しました。時間をおいて再試行してください。",
    );
  }

  return apiSuccessResponse({ profile: updateResult.data });
}
