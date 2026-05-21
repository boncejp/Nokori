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
 * テストユーザーを確保し、その場限りの一時パスワードを設定して返す。
 * ユーザーが存在しない場合は新規作成する。
 */
async function ensureTestUserWithEphemeralPassword(
  adminClient: SupabaseClient,
  email: string,
): Promise<string> {
  const ephemeralPassword = `nokori-e2e-${crypto.randomUUID()}`;

  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    throw new Error(`ユーザー一覧の取得に失敗しました: ${listError.message}`);
  }

  const existingUser = listData.users.find((u) => u.email === email);

  if (existingUser) {
    const { error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      password: ephemeralPassword,
    });
    if (error) {
      throw new Error(`テストユーザーのパスワード更新に失敗しました: ${error.message}`);
    }
  } else {
    const { error } = await adminClient.auth.admin.createUser({
      email,
      password: ephemeralPassword,
      email_confirm: true,
    });
    if (error) {
      throw new Error(`テストユーザーの作成に失敗しました: ${error.message}`);
    }
  }

  return ephemeralPassword;
}

/**
 * signInWithPassword を Node.js 側で実行し、@supabase/ssr が設定するクッキーを返す。
 *
 * 本番は Google OAuth のみ。E2E 用に Admin API でパスワードを設定し、
 * createServerClient + モッククッキーストアで signInWithPassword を完結させる。
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
  const ephemeralPassword = await ensureTestUserWithEphemeralPassword(adminClient, params.email);

  const capturedCookies: Array<{ name: string; value: string }> = [];

  const supabase = createServerClient(url, anonKey, {
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

  const { error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: ephemeralPassword,
  });

  if (error) {
    throw new Error(`サインインに失敗しました: ${error.message}`);
  }

  if (capturedCookies.length === 0) {
    throw new Error("サインイン後にクッキーが設定されませんでした");
  }

  return capturedCookies;
}
