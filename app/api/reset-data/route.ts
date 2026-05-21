import { requireAuthenticatedUser } from "@/lib/api/auth";
import {
  apiServerErrorResponse,
  apiSuccessResponse,
  apiValidationErrorResponse,
} from "@/lib/api/responses";
import { resetOwnDataAtomically } from "@/lib/supabase/profiles";
import { isRecord } from "@/lib/types/object-parsing";
import type { ValidationResult } from "@/lib/types/result";

const REQUIRED_CONFIRM_TEXT = "RESET";

type ResetDataPayload = {
  readonly confirmText: string;
};

function validateResetDataPayload(payload: unknown): ValidationResult<ResetDataPayload> {
  if (!isRecord(payload)) {
    return { success: false, errorMessage: "送信データの形式が不正です。" };
  }
  if (typeof payload.confirmText !== "string") {
    return { success: false, errorMessage: "確認テキストを入力してください。" };
  }
  if (payload.confirmText !== REQUIRED_CONFIRM_TEXT) {
    return {
      success: false,
      errorMessage: `データ初期化には確認テキスト「${REQUIRED_CONFIRM_TEXT}」を正確に入力してください。`,
    };
  }
  return { success: true, data: { confirmText: payload.confirmText } };
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const rawBody: unknown = await request.json();
  const validationResult = validateResetDataPayload(rawBody);
  if (!validationResult.success) {
    return apiValidationErrorResponse(validationResult.errorMessage);
  }

  const resetResult = await resetOwnDataAtomically(supabase);
  if (!resetResult.success) {
    console.error("[api/reset-data] atomic reset failed", {
      userId: user.id,
      message: resetResult.error.message,
    });
    return apiServerErrorResponse(
      "データ初期化に失敗しました。全件ロールバック済みのため、時間をおいて再試行してください。",
    );
  }

  return apiSuccessResponse({
    deletedTransactionCount: resetResult.data.deletedTransactionCount,
    requiresOnboarding: true,
  });
}
