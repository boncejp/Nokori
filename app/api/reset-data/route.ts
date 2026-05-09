import { NextResponse } from "next/server";

import { resetOwnDataAtomically } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const resetResult = await resetOwnDataAtomically(supabase);
  if (!resetResult.success) {
    console.error("[api/reset-data] atomic reset failed", {
      userId: user.id,
      message: resetResult.error.message,
    });
    return NextResponse.json(
      {
        errorMessage:
          "データ初期化に失敗しました。全件ロールバック済みのため、時間をおいて再試行してください。",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedTransactionCount: resetResult.data.deletedTransactionCount,
    requiresOnboarding: true,
  });
}
