import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { fetchUserWelcomeByUserId } from "@/lib/supabase/user-welcome";
import type { Database } from "@/lib/types/database";

export type PostAuthLandingPath = "/dashboard" | "/welcome" | "/onboarding" | "/start";

/**
 * テスト用: DB 取得結果が既に分かっているときの純粋な遷移先（フラグの組み合わせのみ）。
 */
export function resolvePostAuthLandingFromFlags(flags: {
  readonly hasProfile: boolean;
  readonly welcomeRecordPresent: boolean;
  readonly startConceptCompleted: boolean;
}): PostAuthLandingPath {
  if (flags.hasProfile) {
    return flags.startConceptCompleted ? "/dashboard" : "/start";
  }
  if (flags.welcomeRecordPresent) {
    return "/onboarding";
  }
  return "/welcome";
}

/**
 * ログイン後のホーム相当で、プロフィール有無・ウェルカム完了・コンセプト画面完了で遷移先を決める。
 * `user_welcome` の読み取りに失敗した場合はウェルカムへ寄せる（初回導線を優先）。
 */
export async function resolvePostAuthLandingPath(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PostAuthLandingPath> {
  const profileResult = await fetchProfileByUserId(supabase, userId);
  if (profileResult.success) {
    const completed = profileResult.data.start_concept_completed_at !== null;
    return resolvePostAuthLandingFromFlags({
      hasProfile: true,
      welcomeRecordPresent: false,
      startConceptCompleted: completed,
    });
  }

  const welcomeResult = await fetchUserWelcomeByUserId(supabase, userId);
  if (!welcomeResult.success) {
    return "/welcome";
  }

  return resolvePostAuthLandingFromFlags({
    hasProfile: false,
    welcomeRecordPresent: welcomeResult.data !== null,
    startConceptCompleted: false,
  });
}
