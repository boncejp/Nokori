import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/types/database";

import { getPublicSupabaseConfig } from "./public-env";

/**
 * App Router の Server Components / Route Handlers / Server Actions 用。
 * Cookie 経由でセッションをやり取りする公式推奨パターン。
 *
 * サービスロールキーは RLS を迂回するため、管理用・バッチ等に限定し、通常 CRUD には使わない。
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component 等でクッキーが読み取り専用のときに失敗し得る（公式の握りつぶし）
        }
      },
    },
  });
}
