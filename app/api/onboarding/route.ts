import { requireAuthenticatedUser } from "@/lib/api/auth";
import {
  apiServerErrorResponse,
  apiSuccessResponse,
  apiValidationErrorResponse,
} from "@/lib/api/responses";
import {
  calculateCycleWindow,
  calculateTargetDateFromDuration,
  getLogicalDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { validateOnboardingPayload } from "@/lib/logic/onboarding-validation";
import { upsertOwnProfile } from "@/lib/supabase/profiles";

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const rawBody: unknown = await request.json();
  const validationResult = validateOnboardingPayload(rawBody);
  if (!validationResult.success) {
    return apiValidationErrorResponse(validationResult.errorMessage);
  }

  const logicalNow = getLogicalDate(new Date());
  const targetDate = calculateTargetDateFromDuration({
    anchorLogicalDate: logicalNow,
    durationMonths: validationResult.data.target_duration_months,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  const cycleWindow = calculateCycleWindow({
    referenceDate: logicalNow,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  const cycleStartKey = toJstDateString(cycleWindow.cycleStartDate);
  const logicalTodayKey = toJstDateString(logicalNow);
  const targetDateKey = toJstDateString(targetDate);

  // オンボ完了日が偶然「給料サイクル開始日」と一致するときは、
  // 当日の給料日モーダルを再度出さないよう last_salary_cycle_logical_date を埋める。
  const lastSalaryCycleLogicalDate = logicalTodayKey === cycleStartKey ? cycleStartKey : null;

  const initialTotalAssets = validationResult.data.initial_total_assets;
  const initialBudget = validationResult.data.initial_budget;
  // 要件 §2.2 の不変条件: オンボ初回保存時のみ `initial_total_assets - initial_budget` で初期化する。
  // 設定 PATCH ではこの式を再適用しない（`resolveCurrentTotalSavingsForProfileSettingsUpdate` を参照）。
  const currentTotalSavingsFromOnboarding = initialTotalAssets - initialBudget;

  const upsertResult = await upsertOwnProfile(supabase, {
    id: user.id,
    target_amount: validationResult.data.target_amount,
    target_duration_months: validationResult.data.target_duration_months,
    initial_total_assets: initialTotalAssets,
    current_total_savings: currentTotalSavingsFromOnboarding,
    // オンボでは手取りを取らない。NOT NULL 列のため 0 を入れ、給料日モーダルで実値を保存する。
    monthly_income: 0,
    payday: validationResult.data.payday,
    payday_rule: validationResult.data.payday_rule,
    fixed_costs: validationResult.data.fixed_costs,
    estimated_electricity: validationResult.data.estimated_electricity,
    estimated_gas: validationResult.data.estimated_gas,
    estimated_water: validationResult.data.estimated_water,
    surplus_mode: validationResult.data.surplus_mode,
    initial_budget: initialBudget,
    target_date: targetDateKey,
    target_anchor_logical_date: logicalTodayKey,
    last_salary_cycle_logical_date: lastSalaryCycleLogicalDate,
  });

  if (!upsertResult.success) {
    console.error("[api/onboarding] profile upsert failed", {
      userId: user.id,
      message: upsertResult.error.message,
    });
    return apiServerErrorResponse("設定の保存に失敗しました。時間をおいて再試行してください。");
  }

  return apiSuccessResponse();
}
