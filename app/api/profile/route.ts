import { NextResponse } from "next/server";

import { validateOnboardingPayload } from "@/lib/logic/onboarding-validation";
import { upsertOwnProfile } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
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
  const validationResult = validateOnboardingPayload(rawBody);
  if (!validationResult.success) {
    return NextResponse.json({ errorMessage: validationResult.errorMessage }, { status: 400 });
  }

  const updateResult = await upsertOwnProfile(supabase, {
    id: user.id,
    ...validationResult.data,
  });
  if (!updateResult.success) {
    return NextResponse.json(
      { errorMessage: "プロフィールの更新に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    profile: updateResult.data,
  });
}
