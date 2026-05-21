import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E テスト設定
 *
 * 実行前の準備:
 * 1. アプリを起動しておく（`npm run dev` または `npm run build && npm run start`）
 * 2. 以下の環境変数を `.env` に設定する
 *
 * 必須環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL       - Supabase プロジェクトの API URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  - Supabase 公開 anon キー
 *   SUPABASE_SERVICE_ROLE_KEY      - テストユーザー管理用（admin API）
 *   E2E_TEST_EMAIL                 - テストユーザーのメールアドレス
 *
 * Supabase ダッシュボードの設定:
 *   Authentication → URL Configuration → Redirect URLs に
 *   `http://localhost:3000/**` を追加しておく（magiclink リダイレクト用）
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    timezoneId: "Asia/Tokyo",
    locale: "ja-JP",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    {
      name: "unauthenticated",
      testMatch: "**/unauthenticated.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testMatch: ["**/smoke.spec.ts", "**/dashboard.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
