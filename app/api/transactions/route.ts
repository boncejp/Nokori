import { NextResponse } from "next/server";

import { validateTransactionPayload } from "@/lib/logic/transaction-validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertOwnTransaction } from "@/lib/supabase/transactions";

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

  const insertResult = await insertOwnTransaction(supabase, user.id, {
    amount: validationResult.data.amount,
    memo: validationResult.data.memo,
    type: validationResult.data.kind === "SPECIAL" ? "SPECIAL" : "NORMAL",
    utility_type: validationResult.data.kind === "UTILITY" ? validationResult.data.utilityType : null,
  });

  if (!insertResult.success) {
    return NextResponse.json(
      { errorMessage: "支出の保存に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    transaction: insertResult.data,
  });
}
