import { defineConfig, devices } from "@playwright/test";

/**
 * E2E テスト設定
 *
 * 実行には以下の環境変数が必要:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  — アプリの起動に必要
 *   E2E_TEST_EMAIL, E2E_TEST_PASSWORD                        — テスト用アカウントの認証
 *   SUPABASE_SERVICE_ROLE_KEY                                — globalSetup でのテストユーザー管理
 *
 * CI では `.github/workflows/ci.yml` の `e2e` ジョブが上記シークレットを注入する。
 * ローカルでは `.env` に設定したうえで `npm run test:e2e` を実行する。
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
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.CI
    ? {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          PORT: "3000",
        },
      }
    : undefined,
});
