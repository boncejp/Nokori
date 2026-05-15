import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertUserWelcomeCompleted } from "@/lib/supabase/user-welcome";

export async function POST() {
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

  const upsertResult = await upsertUserWelcomeCompleted(supabase, user.id);
  if (!upsertResult.success) {
    console.error("[api/welcome/complete] upsert failed", {
      userId: user.id,
      message: upsertResult.error.message,
    });
    return NextResponse.json(
      { errorMessage: "保存に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
