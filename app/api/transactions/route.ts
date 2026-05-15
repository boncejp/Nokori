import { NextResponse } from "next/server";

import { getLogicalDate, isWithinFirstCycle, parseJstDateKeyToDate } from "@/lib/logic/budget-logic";
import { createTransactionPersistencePlan } from "@/lib/logic/transaction-persistence";
import { validateTransactionPayload } from "@/lib/logic/transaction-validation";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  insertOwnSpecialTransactionAndDecrementSavings,
  insertOwnTransaction,
} from "@/lib/supabase/transactions";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { errorMessage: "ログインが必要です。再度ログインしてください。" },
      { status: 401 },
    );
  }

  const rawBody: unknown = await request.json();
  const validationResult = validateTransactionPayload(rawBody);
  if (!validationResult.success) {
    return NextResponse.json({ errorMessage: validationResult.errorMessage }, { status: 400 });
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    return NextResponse.json(
      { errorMessage: "プロフィールが見つかりません。初期設定を完了してください。" },
      { status: 400 },
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

  if (inFirstCycle && (persistencePlan.shouldUseSpecialAtomicMutation || persistencePlan.utilityType !== null)) {
    return NextResponse.json(
      {
        errorMessage:
          "初回サイクルでは「普通支出」のみ登録できます。光熱費と特別支出は、次の給料日以降の通常サイクルから利用できます。",
      },
      { status: 400 },
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
    return NextResponse.json({ errorMessage }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    transaction: insertResult.data,
  });
}
