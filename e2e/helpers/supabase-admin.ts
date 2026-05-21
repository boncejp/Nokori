import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

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
 * E2E 用テストユーザーを確保する（存在しなければ Admin API で作成）。
 */
async function ensureTestUser(adminClient: SupabaseClient, email: string): Promise<void> {
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    throw new Error(`ユーザー一覧の取得に失敗しました: ${listError.message}`);
  }

  const existingUser = listData.users.find((u) => u.email === email);
  if (existingUser) {
    return;
  }

  const { error } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`テストユーザーの作成に失敗しました: ${error.message}`);
  }
}

function createCookieCapturingSupabaseClient(
  url: string,
  anonKey: string,
): {
  readonly client: ReturnType<typeof createServerClient>;
  readonly getCapturedCookies: () => ReadonlyArray<{ readonly name: string; readonly value: string }>;
} {
  const capturedCookies: Array<{ name: string; value: string }> = [];

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => capturedCookies,
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          const existingIndex = capturedCookies.findIndex((c) => c.name === name);
          if (existingIndex >= 0) {
            capturedCookies[existingIndex] = { name, value };
          } else {
            capturedCookies.push({ name, value });
          }
        }
      },
    },
  });

  return {
    client,
    getCapturedCookies: () => capturedCookies,
  };
}

/**
 * Admin API でマジックリンク用トークンを発行し、verifyOtp でセッションを確立する。
 *
 * 本番は Google OAuth のみ（Email プロバイダ無効）。signInWithPassword は
 * 「Email logins are disabled」で失敗するため、メール送信なしの Admin generateLink + verifyOtp を使う。
 */
export async function signInAndCaptureCookies(params: {
  readonly email: string;
}): Promise<ReadonlyArray<{ readonly name: string; readonly value: string }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "E2E 必須環境変数が未設定: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const adminClient = createSupabaseAdminClient();
  await ensureTestUser(adminClient, params.email);

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: params.email,
  });

  if (linkError) {
    throw new Error(`認証リンクの生成に失敗しました: ${linkError.message}`);
  }

  const hashedToken = linkData?.properties?.hashed_token;
  if (typeof hashedToken !== "string" || hashedToken.length === 0) {
    throw new Error("認証リンクの生成結果に hashed_token がありません");
  }

  const { client, getCapturedCookies } = createCookieCapturingSupabaseClient(url, anonKey);

  const { error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: hashedToken,
  });

  if (verifyError) {
    throw new Error(`サインインに失敗しました: ${verifyError.message}`);
  }

  const capturedCookies = getCapturedCookies();
  if (capturedCookies.length === 0) {
    throw new Error("サインイン後にクッキーが設定されませんでした");
  }

  return capturedCookies;
}
