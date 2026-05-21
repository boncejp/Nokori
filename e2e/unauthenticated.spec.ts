/**
 * 未認証ガードテスト
 *
 * 認証が必要なページへ未ログイン状態でアクセスしたとき、
 * ログインページへリダイレクトされることを確認する。
 *
 * このテストは認証セットアップ不要で常に実行できる。
 */

import { expect, test } from "@playwright/test";

const PROTECTED_PATHS = ["/dashboard", "/history", "/settings"] as const;

for (const protectedPath of PROTECTED_PATHS) {
  test(`未認証で ${protectedPath} にアクセスすると /login にリダイレクトされる`, async ({ page }) => {
    await page.goto(protectedPath);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
}

test("ログインページは未認証でも表示される", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
  // ページが正常に描画されていることを確認（エラー UI が出ていない）
  await expect(page.locator("body")).not.toBeEmpty();
});
