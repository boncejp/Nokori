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
  await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
});

test("ログインページにメールログイン用の入力欄は表示されない", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /メール/ })).toHaveCount(0);
});
