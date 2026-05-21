import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/lib/types/database";

import { getPublicSupabaseConfig } from "@/lib/supabase/public-env";

/** 全リクエストで Supabase セッション Cookie を同期（App Router 推奨パターン）。 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const { url, anonKey } = getPublicSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*workbox.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
