/**
 * 初回サイクル制限 E2E テスト
 * design.md §6.2 シナリオ 6・7 に対応する。
 *
 * シナリオ 6: 初回サイクル中は光熱費・特別支出が登録できない（UI および API）
 * シナリオ 7: 初回サイクル終了リセット後、通常サイクルのトグル・ノルマ表示が有効になる
 *
 * 前提:
 *   - auth.setup.ts でテストユーザーの認証が完了していること
 *   - テストユーザーが「初回サイクル」に属していること
 *     通常サイクルのユーザーを対象に実行した場合、該当テストは自動スキップする
 */

import { expect, test } from "@playwright/test";

test.describe("シナリオ 6: 初回サイクル中の登録制限", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("初回サイクル中は支出種別が「普通支出（読み取り専用）」のみ表示される", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (!isFirstCycle) {
      test.skip(true, "テストユーザーは通常サイクルのためスキップ");
      return;
    }

    // 通常サイクルのトグルボタンが表示されていないことを確認
    await expect(page.getByTestId("kind-option-normal")).not.toBeVisible();
    await expect(page.getByTestId("kind-option-special")).not.toBeVisible();
    await expect(page.getByTestId("kind-option-utility")).not.toBeVisible();

    // 読み取り専用フィールドに「普通支出」と表示されていることを確認
    await expect(kindReadonly).toHaveValue("普通支出");
  });

  test("初回サイクル中に光熱費を API から登録しようとすると 400 を返す", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (!isFirstCycle) {
      test.skip(true, "テストユーザーは通常サイクルのためスキップ");
      return;
    }

    const response = await page.request.post("/api/transactions", {
      data: { amount: 8_000, kind: "UTILITY", utilityType: "ELECTRICITY" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(typeof body.errorMessage).toBe("string");
    expect((body.errorMessage as string).length).toBeGreaterThan(0);
  });

  test("初回サイクル中に特別支出を API から登録しようとすると 400 を返す", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (!isFirstCycle) {
      test.skip(true, "テストユーザーは通常サイクルのためスキップ");
      return;
    }

    const response = await page.request.post("/api/transactions", {
      data: { amount: 50_000, kind: "SPECIAL" },
    });

    expect(response.status()).toBe(400);
  });

  test("初回サイクル中は普通支出を正常に登録できる", async ({ page }) => {
    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (!isFirstCycle) {
      test.skip(true, "テストユーザーは通常サイクルのためスキップ");
      return;
    }

    const remainingBefore = await page.getByTestId("remaining-today").textContent();

    await page.getByTestId("expense-amount-input").fill("1000");
    await page.getByTestId("submit-expense-button").click();
    await expect(page.getByTestId("submit-expense-button")).not.toBeDisabled({ timeout: 5_000 });

    const remainingAfter = await page.getByTestId("remaining-today").textContent();
    expect(remainingAfter).not.toBe(remainingBefore);
  });
});

test.describe("シナリオ 7: 初回サイクル終了後の通常サイクル移行", () => {
  test("通常サイクル移行後は全種別トグルが有効になる", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (isFirstCycle) {
      test.skip(true, "テストユーザーはまだ初回サイクル中のためスキップ");
      return;
    }

    // 通常サイクルでは全種別ボタンが有効に表示されていること
    await expect(page.getByTestId("kind-option-normal")).toBeVisible();
    await expect(page.getByTestId("kind-option-special")).toBeVisible();
    await expect(page.getByTestId("kind-option-utility")).toBeVisible();
  });

  test("通常サイクルでは設定画面に月次貯金ノルマが表示される", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const kindReadonly = page.getByTestId("kind-readonly-first-cycle");
    const isFirstCycle = await kindReadonly.isVisible().catch(() => false);
    if (isFirstCycle) {
      test.skip(true, "テストユーザーはまだ初回サイクル中のためスキップ");
      return;
    }

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // 通常サイクルでは月次貯金ノルマが表示されていること（要設定画面のtestid追加が前提）
    const monthlySavingsQuotaSection = page.getByText("月次貯金ノルマ");
    await expect(monthlySavingsQuotaSection).toBeVisible();
  });
});
