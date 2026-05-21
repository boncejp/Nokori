import { requireAuthenticatedUser } from "@/lib/api/auth";
import {
  apiErrorResponse,
  apiServerErrorResponse,
  apiSuccessResponse,
  apiValidationErrorResponse,
} from "@/lib/api/responses";
import { deleteOwnTransactionById } from "@/lib/supabase/transactions";

type RouteContext = {
  readonly params: Promise<{
    readonly id: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase } = authResult.data;

  const params = await context.params;
  const transactionId = params.id;
  if (!isUuid(transactionId)) {
    return apiValidationErrorResponse("取引IDの形式が不正です。URLを確認してください。");
  }

  const deleteResult = await deleteOwnTransactionById(supabase, transactionId);
  if (!deleteResult.success) {
    return apiServerErrorResponse("削除に失敗しました。時間をおいて再試行してください。");
  }
  if (deleteResult.data === null) {
    return apiErrorResponse("対象の取引が見つかりませんでした。", 404);
  }

  return apiSuccessResponse({ transaction: deleteResult.data });
}
