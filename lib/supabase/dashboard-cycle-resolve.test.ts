import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database, Tables } from "@/lib/types/database";

vi.mock("@/lib/supabase/transactions", () => ({
  listTransactionsByLogicalDateRange: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  applyMonthlyResetForLogicalDate: vi.fn(),
  fetchProfileByUserId: vi.fn(),
}));

import {
  applyMonthlyResetForLogicalDate,
  fetchProfileByUserId,
} from "@/lib/supabase/profiles";
import { listTransactionsByLogicalDateRange } from "@/lib/supabase/transactions";

import { resolveDashboardCycle } from "./dashboard-cycle-resolve";

type Profile = Tables<"profiles">;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * `resolveDashboardCycle` は受け取った supabase をモック済みの外部関数へ渡すだけで、
 * テスト中はこのスタブのメソッドが呼ばれない。型契約だけ満たせば良いので
 * 型ガード経由で `SupabaseClient<Database>` として返す（`as` を使わない）。
 */
function buildSupabaseStubForTest(): SupabaseClient<Database> {
  const stub: unknown = {};
  if (!isObject(stub)) {
    throw new Error("supabase stub must be an object");
  }
  // 型ガード: SupabaseClient はクラスインスタンスだが、ここでは
  // production コードが supabase 自体に対して何も呼び出さないためダミーで十分。
  const candidate: unknown = stub;
  return assertIsSupabaseClient(candidate);
}

function assertIsSupabaseClient(value: unknown): SupabaseClient<Database> {
  if (!isObject(value)) {
    throw new Error("expected supabase stub to be an object");
  }
  // テスト専用: 実体は空オブジェクトだが production コードからはモック関数経由でしか触れない。
  // SupabaseClient の構造的同一性を満たす最小限のスタブとして扱う。
  const stub: SupabaseClient<Database> = Object.assign(
    Object.create(null) as SupabaseClient<Database>,
    value,
  );
  return stub;
}

function createTestProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    target_amount: 500_000,
    target_date: "2026-12-25",
    target_duration_months: 7,
    target_anchor_logical_date: "2026-05-01",
    payday: 25,
    payday_rule: "FIXED",
    monthly_income: 300_000,
    fixed_costs: 100_000,
    estimated_electricity: 5_000,
    estimated_gas: 3_000,
    estimated_water: 2_000,
    initial_total_assets: 200_000,
    current_total_savings: 100_000,
    surplus_mode: "STRICT",
    initial_budget: 100_000,
    last_monthly_reset_logical_date: null,
    last_salary_cycle_logical_date: null,
    start_concept_completed_at: null,
    created_at: "2026-05-01T00:00:00+00:00",
    updated_at: "2026-05-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("resolveDashboardCycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // JST 2026-05-15 10:00:00 (= UTC 2026-05-15 01:00:00)
    // payday=25 なので非給料日 → 月次リセットは走らない経路。
    vi.setSystemTime(new Date("2026-05-15T01:00:00.000Z"));
    vi.mocked(listTransactionsByLogicalDateRange).mockReset();
    vi.mocked(applyMonthlyResetForLogicalDate).mockReset();
    vi.mocked(fetchProfileByUserId).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("正常系: 月次リセット不要な日に支出取得が成功すると ResolvedDashboardCycle を返す", async () => {
    vi.mocked(listTransactionsByLogicalDateRange).mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await resolveDashboardCycle({
      supabase: buildSupabaseStubForTest(),
      userId: "11111111-1111-1111-1111-111111111111",
      profile: createTestProfile(),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected success");
    }
    expect(result.data.isFirstCycle).toBe(true);
    // 初回サイクルかつ確定支出 0 → remainingCycleBudget = initial_budget
    expect(result.data.remainingCycleBudget).toBe(100_000);
    expect(vi.mocked(applyMonthlyResetForLogicalDate)).not.toHaveBeenCalled();
  });

  it("CONFIRMED_SPEND_FETCH_FAILED: 期間トランザクション取得失敗時に 0 で続行せず失敗を返す", async () => {
    // 1 件目（resolveDashboardCycle 内部の累計支出取得）が失敗するモック。
    vi.mocked(listTransactionsByLogicalDateRange).mockResolvedValue({
      success: false,
      error: new Error("network down"),
    });

    const result = await resolveDashboardCycle({
      supabase: buildSupabaseStubForTest(),
      userId: "11111111-1111-1111-1111-111111111111",
      profile: createTestProfile(),
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.reason).toBe("CONFIRMED_SPEND_FETCH_FAILED");
    expect(result.errorMessage.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
  });

  it("MONTHLY_RESET_FAILED: 月次リセット必要日の applyMonthlyResetForLogicalDate 失敗時、締め前プロフィールで継続せず失敗を返す", async () => {
    // 給料日（payday=25）に時刻を進める。JST 2026-05-25 10:00。
    vi.setSystemTime(new Date("2026-05-25T01:00:00.000Z"));

    // 月次リセット内の前サイクル支出取得は成功させ、最終 update でこける経路を再現する。
    vi.mocked(listTransactionsByLogicalDateRange).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(applyMonthlyResetForLogicalDate).mockResolvedValue({
      success: false,
      error: new Error("rls denied"),
    });

    const result = await resolveDashboardCycle({
      supabase: buildSupabaseStubForTest(),
      userId: "11111111-1111-1111-1111-111111111111",
      profile: createTestProfile({ last_monthly_reset_logical_date: null }),
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.reason).toBe("MONTHLY_RESET_FAILED");
    expect(result.errorMessage.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
    // 失敗時は残予算計算へ進まない（fetchProfileByUserId も呼ばれない）。
    expect(vi.mocked(fetchProfileByUserId)).not.toHaveBeenCalled();
  });

  it("MONTHLY_RESET_FAILED: 月次リセット内の前サイクル支出取得が失敗しても締め前プロフィールで継続しない", async () => {
    vi.setSystemTime(new Date("2026-05-25T01:00:00.000Z"));

    vi.mocked(listTransactionsByLogicalDateRange).mockResolvedValue({
      success: false,
      error: new Error("network down"),
    });

    const result = await resolveDashboardCycle({
      supabase: buildSupabaseStubForTest(),
      userId: "11111111-1111-1111-1111-111111111111",
      profile: createTestProfile({ last_monthly_reset_logical_date: null }),
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.reason).toBe("MONTHLY_RESET_FAILED");
    // applyMonthlyResetForLogicalDate には到達しない。
    expect(vi.mocked(applyMonthlyResetForLogicalDate)).not.toHaveBeenCalled();
  });
});
