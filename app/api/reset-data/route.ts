import { NextResponse } from "next/server";

import { deleteOwnProfileById } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAllOwnTransactions } from "@/lib/supabase/transactions";

const REQUIRED_CONFIRM_TEXT = "RESET";

type ResetDataPayload = {
  readonly confirmText: string;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errorMessage: string };

function validateResetDataPayload(payload: unknown): ValidationResult<ResetDataPayload> {
  if (typeof payload !== "object" || payload === null) {
    return { success: false, errorMessage: "送信データの形式が不正です。" };
  }
  if (!("confirmText" in payload) || typeof payload.confirmText !== "string") {
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
  const validationResult = validateResetDataPayload(rawBody);
  if (!validationResult.success) {
    return NextResponse.json({ errorMessage: validationResult.errorMessage }, { status: 400 });
  }

  const deleteTransactionsResult = await deleteAllOwnTransactions(supabase);
  if (!deleteTransactionsResult.success) {
    return NextResponse.json(
      { errorMessage: "取引データの削除に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  const deleteProfileResult = await deleteOwnProfileById(supabase, user.id);
  if (!deleteProfileResult.success) {
    return NextResponse.json(
      { errorMessage: "プロフィールの初期化に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedTransactionCount: deleteTransactionsResult.data,
    requiresOnboarding: true,
  });
}
