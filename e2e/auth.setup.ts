import path from "node:path";

import { test as setup, expect } from "@playwright/test";

import { generateMagicLink } from "./helpers/supabase-admin";

export const AUTH_STATE_PATH = path.join(__dirname, ".auth/user.json");

/**
 * テストユーザーを認証し、Playwright のストレージ状態に保存する。
 *
 * 認証フロー:
 * 1. Admin API でテストユーザーのマジックリンクを生成（メール送信なし）
 * 2. Playwright がそのリンクを踏む → Supabase で検証 → /auth/callback?code=... にリダイレクト
 * 3. /auth/callback が code を exchangeCodeForSession で交換し、SSR セッションクッキーを設定
 * 4. アプリ内の遷移先に到達したことを確認してストレージ状態を保存
 *
 * 前提条件:
 * - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_TEST_EMAIL が設定されていること
 * - Supabase ダッシュボード > Authentication > URL Configuration > Redirect URLs に
 *   `{PLAYWRIGHT_BASE_URL}/**`（デフォルト: http://localhost:3000/**）が登録されていること
 */
setup("テストユーザーを認証する", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  if (!email) {
    throw new Error("E2E_TEST_EMAIL が設定されていません");
  }

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const callbackUrl = `${baseUrl}/auth/callback`;

  const actionLink = await generateMagicLink({ email, redirectTo: callbackUrl });

  // マジックリンクを踏む → Supabase → /auth/callback → アプリ内ページ
  await page.goto(actionLink);

  // 認証後はオンボーディング・ウェルカム・ダッシュボードいずれかに遷移する
  await expect(page).toHaveURL(
    /\/(dashboard|onboarding|welcome|start|legal)?$/,
    { timeout: 20_000 },
  );

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
