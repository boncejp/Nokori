/**
 * スモークテスト（認証後）
 *
 * 認証済みユーザーがアプリの主要ページに到達でき、
 * エラー画面が表示されないことを確認する。
 *
 * UI の具体的な構造には依存しない。リファクタリング後も
 * 「アプリが壊れていないこと」を保証するガードとして機能する。
 */

import { expect, test } from "@playwright/test";

test("認証済みユーザーはルートにアクセスするとアプリ内に留まる（ログインページに戻らない）", async ({ page }) => {
  await page.goto("/");
  // ログインページに戻っていないこと = 認証セッションが有効
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
});

test("ダッシュボードは認証済みで到達できるか、オンボーディングにリダイレクトされる", async ({ page }) => {
  await page.goto("/dashboard");
  // ダッシュボードそのものか、または onboarding/welcome/start への遷移が許容される
  // ログインページにはリダイレクトされない
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
});

test("ダッシュボードにエラー UI が表示されていない（月次リセット/支出取得が失敗していない）", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // ダッシュボードにいる場合のみ確認（オンボーディング途中はスキップ）
  const url = page.url();
  if (!url.includes("/dashboard")) {
    test.skip(true, "ユーザーがダッシュボード以外にいるためスキップ");
    return;
  }

  // data-testid="dashboard-cycle-error" のエラーパネルが表示されていないこと
  await expect(page.getByTestId("dashboard-cycle-error")).not.toBeVisible();
});

test("履歴ページはダッシュボードと同じ認証状態で到達できる", async ({ page }) => {
  await page.goto("/history");
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
});

test("設定ページはダッシュボードと同じ認証状態で到達できる", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
});
