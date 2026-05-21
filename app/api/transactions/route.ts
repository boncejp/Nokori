import { requireAuthenticatedUser } from "@/lib/api/auth";
import {
  apiServerErrorResponse,
  apiSuccessResponse,
  apiValidationErrorResponse,
} from "@/lib/api/responses";
import { getLogicalDate, isWithinFirstCycle, parseJstDateKeyToDate } from "@/lib/logic/budget-logic";
import { createTransactionPersistencePlan } from "@/lib/logic/transaction-persistence";
import { validateTransactionPayload } from "@/lib/logic/transaction-validation";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import {
  insertOwnSpecialTransactionAndDecrementSavings,
  insertOwnTransaction,
} from "@/lib/supabase/transactions";

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const rawBody: unknown = await request.json();
  const validationResult = validateTransactionPayload(rawBody);
  if (!validationResult.success) {
    return apiValidationErrorResponse(validationResult.errorMessage);
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    return apiValidationErrorResponse(
      "プロフィールが見つかりません。初期設定を完了してください。",
    );
  }

  const logicalNow = getLogicalDate(new Date());
  const inFirstCycle = isWithinFirstCycle({
    anchorLogicalDate: parseJstDateKeyToDate(profileResult.data.target_anchor_logical_date),
    referenceDate: logicalNow,
    payday: profileResult.data.payday,
    paydayRule: profileResult.data.payday_rule,
  });

  const persistencePlan = createTransactionPersistencePlan({
    kind: validationResult.data.kind,
    utilityType: validationResult.data.utilityType,
  });

  // 初回サイクルでは普通支出のみを許可（要件 §2.3 / 設計 §2.2）。
  // 光熱費差額の反映と特別支出の貯金引き出しは通常サイクルからの機能のため、ここで弾く。
  const isRestrictedInFirstCycle =
    inFirstCycle &&
    (persistencePlan.shouldUseSpecialAtomicMutation || persistencePlan.utilityType !== null);
  if (isRestrictedInFirstCycle) {
    return apiValidationErrorResponse(
      "初回サイクルでは「普通支出」のみ登録できます。光熱費と特別支出は、次の給料日以降の通常サイクルから利用できます。",
    );
  }

  const insertResult = persistencePlan.shouldUseSpecialAtomicMutation
    ? await insertOwnSpecialTransactionAndDecrementSavings(supabase, {
        amount: validationResult.data.amount,
        memo: validationResult.data.memo,
      })
    : await insertOwnTransaction(supabase, user.id, {
        amount: validationResult.data.amount,
        memo: validationResult.data.memo,
        type: persistencePlan.transactionType,
        utility_type: persistencePlan.utilityType,
      });

  if (!insertResult.success) {
    const errorMessage = persistencePlan.shouldUseSpecialAtomicMutation
      ? "特別支出の保存に失敗しました。時間をおいて再試行してください。"
      : "支出の保存に失敗しました。時間をおいて再試行してください。";
    return apiServerErrorResponse(errorMessage);
  }

  return apiSuccessResponse({ transaction: insertResult.data });
}
