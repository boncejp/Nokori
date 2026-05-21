/**
 * API Route 共通の認証ヘルパー。
 *
 * 401 を返す共通レスポンスとペアで使い、Route ハンドラから boilerplate を削減する。
 * Service Role は使わず、`createSupabaseServerClient` 経由でユーザーセッションを読む。
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

import { apiUnauthorizedResponse } from "./responses";

export type AuthenticatedContext = {
  readonly supabase: SupabaseClient<Database>;
  readonly user: User;
};

export type AuthenticationResult =
  | { readonly success: true; readonly data: AuthenticatedContext }
  | { readonly success: false; readonly response: NextResponse };

/**
 * Cookie からセッションを読み、未認証なら 401 レスポンスを返す。
 *
 * 呼び出し側の典型形:
 *   const authResult = await requireAuthenticatedUser();
 *   if (!authResult.success) return authResult.response;
 *   const { supabase, user } = authResult.data;
 */
export async function requireAuthenticatedUser(): Promise<AuthenticationResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, response: apiUnauthorizedResponse() };
  }

  return { success: true, data: { supabase, user } };
}
