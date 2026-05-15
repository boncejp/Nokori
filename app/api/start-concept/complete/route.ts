import { NextResponse } from "next/server";

import { markStartConceptCompleted } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const updateResult = await markStartConceptCompleted(supabase, user.id);
  if (!updateResult.success) {
    console.error("[api/start-concept/complete] update failed", {
      userId: user.id,
      message: updateResult.error.message,
    });
    return NextResponse.json(
      { errorMessage: "保存に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
