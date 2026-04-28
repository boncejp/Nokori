"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";

import { getPublicSupabaseConfig } from "./public-env";

/**
 * ブラウザ用クライアント（Client Component から呼び出し）。
 *
 * サービスロールキーはバイパス用のためクライアントでは使わない。
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
