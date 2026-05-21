import { createClient } from "@supabase/supabase-js";

type AdminClient = ReturnType<typeof createClient>;

/**
 * サービスロールキーを使った Supabase 管理クライアントを生成する。
 * Node.js 環境（globalSetup）専用。ブラウザで呼ばない。
 */
export function createSupabaseAdminClient(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "E2E 環境変数が不足しています: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * テストユーザーのメールアドレスとパスワードを環境変数から取得する。
 */
export function getTestCredentials(): { email: string; password: string } {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E テスト認証情報が不足しています: E2E_TEST_EMAIL, E2E_TEST_PASSWORD",
    );
  }

  return { email, password };
}

/**
 * テストユーザーが存在しない場合に作成し、パスワードを設定する。
 * 既存ユーザーがいる場合はパスワードを更新する。
 */
export async function ensureTestUser(
  adminClient: AdminClient,
  email: string,
  password: string,
): Promise<string> {
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    throw new Error(`ユーザー一覧の取得に失敗しました: ${listError.message}`);
  }

  const existingUser = listData.users.find((u) => u.email === email);

  if (existingUser) {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      password,
    });
    if (updateError) {
      throw new Error(`テストユーザーのパスワード更新に失敗しました: ${updateError.message}`);
    }
    return existingUser.id;
  }

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !createData.user) {
    throw new Error(`テストユーザーの作成に失敗しました: ${createError?.message ?? "unknown"}`);
  }

  return createData.user.id;
}
