import { requireAuthenticatedUser } from "@/lib/api/auth";
import { apiServerErrorResponse, apiSuccessResponse } from "@/lib/api/responses";
import { upsertUserWelcomeCompleted } from "@/lib/supabase/user-welcome";

export async function POST() {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const upsertResult = await upsertUserWelcomeCompleted(supabase, user.id);
  if (!upsertResult.success) {
    console.error("[api/welcome/complete] upsert failed", {
      userId: user.id,
      message: upsertResult.error.message,
    });
    return apiServerErrorResponse("保存に失敗しました。時間をおいて再試行してください。");
  }

  return apiSuccessResponse();
}
