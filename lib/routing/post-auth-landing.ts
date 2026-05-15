import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { fetchUserWelcomeByUserId } from "@/lib/supabase/user-welcome";
import type { Database } from "@/lib/types/database";

export type PostAuthLandingPath = "/dashboard" | "/welcome" | "/onboarding";

/**
 * テスト用: DB 取得結果が既に分かっているときの純粋な遷移先（フラグの組み合わせのみ）。
 */
export function resolvePostAuthLandingFromFlags(flags: {
  readonly hasProfile: boolean;
  readonly welcomeRecordPresent: boolean;
}): PostAuthLandingPath {
  if (flags.hasProfile) {
    return "/dashboard";
  }
  if (flags.welcomeRecordPresent) {
    return "/onboarding";
  }
  return "/welcome";
}

/**
 * ログイン後のホーム相当で、プロフィール有無とウェルカム完了で遷移先を決める。
 * `user_welcome` の読み取りに失敗した場合はウェルカムへ寄せる（初回導線を優先）。
 */
export async function resolvePostAuthLandingPath(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PostAuthLandingPath> {
  const profileResult = await fetchProfileByUserId(supabase, userId);
  if (profileResult.success) {
    return "/dashboard";
  }

  const welcomeResult = await fetchUserWelcomeByUserId(supabase, userId);
  if (!welcomeResult.success) {
    return "/welcome";
  }

  return resolvePostAuthLandingFromFlags({
    hasProfile: false,
    welcomeRecordPresent: welcomeResult.data !== null,
  });
}
