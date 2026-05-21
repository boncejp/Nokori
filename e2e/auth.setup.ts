import path from "node:path";

import { test as setup, expect } from "@playwright/test";

import { signInAndCaptureCookies } from "./helpers/supabase-admin";

export const AUTH_STATE_PATH = path.join(__dirname, ".auth/user.json");

/**
 * テストユーザーを認証し、Playwright のストレージ状態に保存する。
 *
 * 認証フロー:
 * 1. Admin API でテストユーザーを作成（または既存ユーザーのパスワードを一時更新）
 * 2. Node.js 側で createServerClient + signInWithPassword を実行
 * 3. @supabase/ssr がモッククッキーストアに書き込んだセッションクッキーを取得
 * 4. Playwright のブラウザコンテキストに注入
 * 5. アプリのページを開いてミドルウェアがセッションを認識することを確認
 * 6. storageState に保存
 *
 * 認証方式:
 *   本番ログインは Google OAuth のみ。E2E は Admin API + signInWithPassword でセッションを作る
 *   （マジックリンクの #access_token はサーバーに届かず /auth/callback で処理できないため）。
 */
setup("テストユーザーを認証する", async ({ context }) => {
  const email = process.env.E2E_TEST_EMAIL;
  if (!email) {
    throw new Error("E2E_TEST_EMAIL が設定されていません");
  }

  const cookies = await signInAndCaptureCookies({ email });

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const domain = new URL(baseUrl).hostname;

  await context.addCookies(
    cookies.map(({ name, value }) => ({
      name,
      value,
      domain,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );

  // ミドルウェアがセッションを認識しアプリ内ページに到達できることを確認する
  const page = await context.newPage();
  await page.goto(baseUrl);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await page.close();

  await context.storageState({ path: AUTH_STATE_PATH });
});
