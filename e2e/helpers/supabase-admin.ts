import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * サービスロールキーを使った Supabase 管理クライアントを生成する。
 * Node.js 環境（auth.setup.ts）専用。ブラウザコンテキストでは使わない。
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "E2E 必須環境変数が未設定: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * テストユーザーのマジックリンクを生成して返す。
 * メールを送らずリンク URL だけを返す Supabase admin API を使用する。
 * Playwright は返された URL を直接踏んで認証を完了させる。
 *
 * Supabase ダッシュボードの Redirect URLs に `redirectTo` のオリジンが
 * 許可されている必要がある。
 */
export async function generateMagicLink(params: {
  readonly email: string;
  readonly redirectTo: string;
}): Promise<string> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: params.email,
    options: { redirectTo: params.redirectTo },
  });

  if (error ?? !data.properties.action_link) {
    throw new Error(
      `マジックリンクの生成に失敗しました: ${error?.message ?? "action_link が空"}`,
    );
  }

  return data.properties.action_link;
}
