/**
 * ダッシュボード ハッピーパステスト
 *
 * 支出登録フローのコアパスをガードする。
 * 具体的な金額や UI テキストには依存せず、「操作の結果として状態が変わる」
 * という構造的な変化だけを確認することでフラキーにならないようにしている。
 *
 * テストがスキップされる場合:
 *   - テストユーザーがオンボーディング未完了でダッシュボードに到達できない場合
 *   - 月次リセットに失敗してエラー画面が表示されている場合
 */

import { expect, test } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────────────────────────

/**
 * テストユーザーがダッシュボードにいることを確認する。
 * いない場合はテストをスキップする。
 */
async function requireDashboard(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  if (!page.url().includes("/dashboard")) {
    test.skip(true, "テストユーザーがダッシュボードに到達できない（オンボーディング未完了など）");
    return false;
  }
  if (await page.getByTestId("dashboard-cycle-error").isVisible()) {
    test.skip(true, "ダッシュボードにエラーが表示されているためスキップ");
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 普通支出の登録ハッピーパス
// ─────────────────────────────────────────────────────────────────────────────

test("普通支出を登録するとフォームがリセットされる", async ({ page }) => {
  if (!(await requireDashboard(page))) return;

  // テンキー経由で入力（hidden input に直接 fill）
  await page.getByTestId("expense-amount-input").fill("1000");
  await page.getByTestId("submit-expense-button").click();

  // 登録完了後: 送信ボタンが再び使えるようになる（isSubmitting=false に戻る）
  await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({
    timeout: 10_000,
  });

  // フォームがリセットされ、入力値がクリアされている
  await expect(page.getByTestId("expense-amount-input")).toHaveValue("");
});

test("普通支出を登録すると「今日の残り予算」が変化する", async ({ page }) => {
  if (!(await requireDashboard(page))) return;

  const remainingBefore = await page.getByTestId("remaining-today").textContent();

  await page.getByTestId("expense-amount-input").fill("1000");
  await page.getByTestId("submit-expense-button").click();
  await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({ timeout: 10_000 });

  const remainingAfter = await page.getByTestId("remaining-today").textContent();
  expect(remainingAfter).not.toBe(remainingBefore);
});

// ─────────────────────────────────────────────────────────────────────────────
// 初回サイクルの制限
// ─────────────────────────────────────────────────────────────────────────────

test("初回サイクル中は種別選択が「普通支出（読み取り専用）」のみ表示される", async ({ page }) => {
  if (!(await requireDashboard(page))) return;

  const isFirstCycle = await page.getByTestId("kind-readonly-first-cycle").isVisible();
  if (!isFirstCycle) {
    test.skip(true, "通常サイクルのため初回サイクル制限テストはスキップ");
    return;
  }

  // 切替ボタン3つが表示されていないことを確認
  await expect(page.getByTestId("kind-option-normal")).not.toBeVisible();
  await expect(page.getByTestId("kind-option-special")).not.toBeVisible();
  await expect(page.getByTestId("kind-option-utility")).not.toBeVisible();
});

test("初回サイクル中に特別支出を API から登録すると 400 が返る", async ({ page }) => {
  if (!(await requireDashboard(page))) return;

  const isFirstCycle = await page.getByTestId("kind-readonly-first-cycle").isVisible();
  if (!isFirstCycle) {
    test.skip(true, "通常サイクルのため初回制限の API テストはスキップ");
    return;
  }

  const response = await page.request.post("/api/transactions", {
    data: { amount: 10_000, kind: "SPECIAL" },
  });
  expect(response.status()).toBe(400);
});

test("初回サイクル中に光熱費を API から登録すると 400 が返る", async ({ page }) => {
  if (!(await requireDashboard(page))) return;

  const isFirstCycle = await page.getByTestId("kind-readonly-first-cycle").isVisible();
  if (!isFirstCycle) {
    test.skip(true, "通常サイクルのため初回制限の API テストはスキップ");
    return;
  }

  const response = await page.request.post("/api/transactions", {
    data: { amount: 8_000, kind: "UTILITY", utilityType: "ELECTRICITY" },
  });
  expect(response.status()).toBe(400);
});

// ─────────────────────────────────────────────────────────────────────────────
// 通常サイクルの種別分離
// ─────────────────────────────────────────────────────────────────────────────

test("通常サイクルでは普通支出・特別支出・光熱費の切替ボタンが表示される", async ({ page }) => {
  if (!(await requireDashboard(page))) return;

  const isFirstCycle = await page.getByTestId("kind-readonly-first-cycle").isVisible();
  if (isFirstCycle) {
    test.skip(true, "初回サイクルのためスキップ");
    return;
  }

  await expect(page.getByTestId("kind-option-normal")).toBeVisible();
  await expect(page.getByTestId("kind-option-special")).toBeVisible();
  await expect(page.getByTestId("kind-option-utility")).toBeVisible();
});

test("特別支出を登録しても「今日の残り予算」が変化しない", async ({ page }) => {
  if (!(await requireDashboard(page))) return;

  const isFirstCycle = await page.getByTestId("kind-readonly-first-cycle").isVisible();
  if (isFirstCycle) {
    test.skip(true, "初回サイクルのためスキップ");
    return;
  }

  const remainingBefore = await page.getByTestId("remaining-today").textContent();

  await page.getByTestId("kind-option-special").click();
  await page.getByTestId("expense-amount-input").fill("5000");
  await page.getByTestId("submit-expense-button").click();
  await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({ timeout: 10_000 });

  const remainingAfter = await page.getByTestId("remaining-today").textContent();
  // 特別支出は今日の残り予算に影響しない（仕様上の核心）
  expect(remainingAfter).toBe(remainingBefore);
});
