import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { test as setup, expect } from "@playwright/test";

import { createSupabaseAdminClient, ensureTestUser, getTestCredentials } from "./helpers/supabase-admin";

export const AUTH_STATE_PATH = path.join(__dirname, ".auth/user.json");

/**
 * テストユーザーを認証し、ストレージ状態を保存する。
 * 他のテストはこのセットアップで得たセッションを再利用する。
 *
 * 認証フロー:
 * 1. Admin API でテストユーザーを作成（または既存ユーザーのパスワード更新）
 * 2. signInWithPassword でセッション取得
 * 3. コールバック URL 経由でセッションクッキーを Next.js に設定する
 */
setup("テストユーザーを認証する", async ({ page }) => {
  const { email, password } = getTestCredentials();
  const adminClient = createSupabaseAdminClient();

  await ensureTestUser(adminClient, email, password);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "E2E 環境変数が不足しています: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  // Supabase クライアントでサインイン
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`テストサインインに失敗しました: ${error?.message ?? "セッションが空"}`);
  }

  // Next.js の Supabase SSR ミドルウェアが認識するクッキーを設定するため
  // auth/callback エンドポイントにアクセスしてセッションを確立する
  const { access_token, refresh_token } = data.session;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  await page.goto(`${baseUrl}/auth/callback?access_token=${access_token}&refresh_token=${refresh_token}&type=magiclink`);

  // ログイン後のリダイレクト先（ルートまたはダッシュボード）を待つ
  await expect(page).toHaveURL(/\/(dashboard|onboarding|welcome|start)?/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log(`[auth.setup] 認証成功: ${email} → ${page.url()}`);
});
