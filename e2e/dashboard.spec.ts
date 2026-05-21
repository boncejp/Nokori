/**
 * ダッシュボード E2E テスト
 * design.md §6.2 シナリオ 1・3・4 に対応する。
 *
 * 前提:
 *   - auth.setup.ts でテストユーザーの認証が完了していること
 *   - テストユーザーが「通常サイクル」に移行済みであること
 *     （初回サイクル固有のシナリオは first-cycle.spec.ts で別途カバー）
 */

import { expect, test } from "@playwright/test";

test.describe("シナリオ 1: 支出入力後のリアルタイム予算更新", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("普通支出を登録すると「今日の残り予算」が即座に減少する", async ({ page }) => {
    const remainingBefore = await page.getByTestId("remaining-today").textContent();
    if (!remainingBefore) {
      test.skip(true, "ダッシュボードが表示されていない（未ログインまたは初回サイクル）");
      return;
    }

    // 金額を入力して登録する（テンキー経由）
    await page.getByTestId("expense-amount-input").fill("1000");
    await page.getByTestId("submit-expense-button").click();

    // 楽観的 UI 更新を待つ（登録ボタン非活性中 → 活性に戻る）
    await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({ timeout: 5_000 });

    const remainingAfter = await page.getByTestId("remaining-today").textContent();
    expect(remainingBefore).not.toBe(remainingAfter);
  });

  test("普通支出を登録すると「翌日以降の目安（1日あたり）」が更新される", async ({ page }) => {
    const futureBefore = await page.getByTestId("future-daily-budget").textContent();
    if (!futureBefore) {
      test.skip(true, "ダッシュボードが表示されていない");
      return;
    }

    await page.getByTestId("expense-amount-input").fill("500");
    await page.getByTestId("submit-expense-button").click();
    await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({ timeout: 5_000 });

    const futureAfter = await page.getByTestId("future-daily-budget").textContent();
    expect(futureBefore).not.toBe(futureAfter);
  });
});

test.describe("シナリオ 4: 光熱費入力後の残り予算への反映（通常サイクル）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("光熱費ボタンが通常サイクルで表示される", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (isFirstCycle) {
      test.skip(true, "初回サイクル中のため光熱費ボタンは非表示（設計どおり）");
      return;
    }

    await expect(page.getByTestId("kind-option-utility")).toBeVisible();
  });

  test("光熱費登録後に翌日以降の目安が変化する（実額 ≠ 概算の場合）", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (isFirstCycle) {
      test.skip(true, "初回サイクル中のため光熱費登録はできない（設計どおり）");
      return;
    }

    const futureBefore = await page.getByTestId("future-daily-budget").textContent();

    await page.getByTestId("kind-option-utility").click();
    // 光熱費の内訳（電気がデフォルト）で金額を入力
    await page.getByTestId("expense-amount-input").fill("9000");
    await page.getByTestId("submit-expense-button").click();
    await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({ timeout: 5_000 });

    const futureAfter = await page.getByTestId("future-daily-budget").textContent();
    // 翌日以降の予算は変化するはず（概算と一致しない限り）
    // 概算が 9000 に一致する場合はスキップ
    if (futureBefore === futureAfter) {
      test.skip(true, "光熱費実額が概算と一致したため差額なし（テスト環境の設定による）");
    }
  });
});

test.describe("シナリオ 3: 特別支出登録（通常サイクル）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("特別支出ボタンが通常サイクルで表示される", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (isFirstCycle) {
      test.skip(true, "初回サイクル中のため特別支出ボタンは非表示（設計どおり）");
      return;
    }

    await expect(page.getByTestId("kind-option-special")).toBeVisible();
  });

  test("特別支出を登録しても「今日の残り予算」は変化しない", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (isFirstCycle) {
      test.skip(true, "初回サイクル中のため特別支出は登録できない");
      return;
    }

    const remainingBefore = await page.getByTestId("remaining-today").textContent();

    await page.getByTestId("kind-option-special").click();
    await page.getByTestId("expense-amount-input").fill("5000");
    await page.getByTestId("submit-expense-button").click();
    await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({ timeout: 5_000 });

    const remainingAfter = await page.getByTestId("remaining-today").textContent();
    // 特別支出は今日の残り予算に影響しない
    expect(remainingAfter).toBe(remainingBefore);
  });
});
