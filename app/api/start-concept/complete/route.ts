import { requireAuthenticatedUser } from "@/lib/api/auth";
import { apiServerErrorResponse, apiSuccessResponse } from "@/lib/api/responses";
import { markStartConceptCompleted } from "@/lib/supabase/profiles";

export async function POST() {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const updateResult = await markStartConceptCompleted(supabase, user.id);
  if (!updateResult.success) {
    console.error("[api/start-concept/complete] update failed", {
      userId: user.id,
      message: updateResult.error.message,
    });
    return apiServerErrorResponse("保存に失敗しました。時間をおいて再試行してください。");
  }

  return apiSuccessResponse();
}
