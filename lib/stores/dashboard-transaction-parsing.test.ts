import { describe, expect, it } from "vitest";

import {
  isDashboardTransaction,
  parseLogicalDateString,
  resolveLogicalTodayDate,
} from "./dashboard-transaction-parsing";

describe("isDashboardTransaction", () => {
  it("整合の取れた transaction を受け入れる（普通支出）", () => {
    const candidate = {
      id: "11111111-1111-4111-8111-111111111111",
      amount: 1500,
      memo: null,
      type: "NORMAL",
      utility_type: null,
      logical_date: "2025-05-01",
      created_at: "2025-05-01T10:00:00Z",
      isOptimistic: false,
    };
    expect(isDashboardTransaction(candidate)).toBe(true);
  });

  it("光熱費（GAS）を受け入れる", () => {
    const candidate = {
      id: "11111111-1111-4111-8111-111111111111",
      amount: 4_500,
      memo: "5月分",
      type: "NORMAL",
      utility_type: "GAS",
      logical_date: "2025-05-01",
      created_at: "2025-05-01T10:00:00Z",
      isOptimistic: false,
    };
    expect(isDashboardTransaction(candidate)).toBe(true);
  });

  it("未知の utility_type を弾く", () => {
    const candidate = {
      id: "11111111-1111-4111-8111-111111111111",
      amount: 1_000,
      memo: null,
      type: "NORMAL",
      utility_type: "INTERNET",
      logical_date: "2025-05-01",
      created_at: "2025-05-01T10:00:00Z",
    };
    expect(isDashboardTransaction(candidate)).toBe(false);
  });

  it("type が不正なら弾く", () => {
    const candidate = {
      id: "11111111-1111-4111-8111-111111111111",
      amount: 1_000,
      memo: null,
      type: "UNKNOWN",
      utility_type: null,
      logical_date: "2025-05-01",
      created_at: "2025-05-01T10:00:00Z",
    };
    expect(isDashboardTransaction(candidate)).toBe(false);
  });

  it("null / 非オブジェクトを弾く", () => {
    expect(isDashboardTransaction(null)).toBe(false);
    expect(isDashboardTransaction("text")).toBe(false);
    expect(isDashboardTransaction(undefined)).toBe(false);
  });
});

describe("parseLogicalDateString", () => {
  it("YYYY-MM-DD を JST 00:00 の Date として返す", () => {
    const result = parseLogicalDateString("2025-05-01");
    expect(result.toISOString()).toBe("2025-04-30T15:00:00.000Z");
  });

  it("不正な日付なら Error を投げる", () => {
    expect(() => parseLogicalDateString("not-a-date")).toThrow();
  });
});

describe("resolveLogicalTodayDate", () => {
  it("空文字列なら現在時刻ベースの論理日を返す（NaN にならない）", () => {
    const result = resolveLogicalTodayDate("");
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it("正常な論理日キーは parseLogicalDateString と同じ結果を返す", () => {
    const result = resolveLogicalTodayDate("2025-05-01");
    expect(result.toISOString()).toBe(parseLogicalDateString("2025-05-01").toISOString());
  });

  it("不正な文字列が来てもクラッシュせずに現在時刻ベースへフォールバック", () => {
    const result = resolveLogicalTodayDate("garbage");
    expect(Number.isNaN(result.getTime())).toBe(false);
  });
});
