import { requireAuthenticatedUser } from "@/lib/api/auth";
import {
  apiServerErrorResponse,
  apiSuccessResponse,
  apiValidationErrorResponse,
} from "@/lib/api/responses";
import {
  calculateCycleWindow,
  getLogicalDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { validateSalaryCyclePayload } from "@/lib/logic/salary-cycle-validation";
import { fetchProfileByUserId, updateOwnProfileByUserId } from "@/lib/supabase/profiles";

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const rawBody: unknown = await request.json();
  const validationResult = validateSalaryCyclePayload(rawBody);
  if (!validationResult.success) {
    return apiValidationErrorResponse(validationResult.errorMessage);
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    return apiValidationErrorResponse(
      "プロフィールが見つかりません。オンボーディングを完了してください。",
    );
  }

  const profile = profileResult.data;
  const logicalNow = getLogicalDate(new Date());
  const logicalTodayKey = toJstDateString(logicalNow);

  const cycleWindow = calculateCycleWindow({
    referenceDate: logicalNow,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });
  const expectedCycleStartKey = toJstDateString(cycleWindow.cycleStartDate);

  // 給料日モーダルは「給料サイクル開始日（=その日が論理的な給料日）」だけ受け付ける。
  // 別の日に更新できると、月内に複数回の更新が走り `last_salary_cycle_logical_date` の整合が崩れるため。
  if (logicalTodayKey !== expectedCycleStartKey) {
    return apiValidationErrorResponse("今日は給料サイクル開始日ではありません。");
  }
  if (validationResult.data.cycleStartLogicalDate !== expectedCycleStartKey) {
    return apiValidationErrorResponse(
      "サイクル開始日が一致しません。画面を再読み込みしてください。",
    );
  }

  const updateResult = await updateOwnProfileByUserId(supabase, user.id, {
    monthly_income: validationResult.data.monthlyIncome,
    last_salary_cycle_logical_date: validationResult.data.cycleStartLogicalDate,
  });

  if (!updateResult.success) {
    return apiServerErrorResponse("保存に失敗しました。時間をおいて再試行してください。");
  }

  return apiSuccessResponse({ profile: updateResult.data });
}
