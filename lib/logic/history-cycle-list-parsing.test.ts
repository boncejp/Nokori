import { describe, expect, it } from "vitest";

import { parseHistoryCycleListPage } from "./history-cycle-list-parsing";

describe("parseHistoryCycleListPage", () => {
  it("正しいページ応答を復元する", () => {
    const result = parseHistoryCycleListPage({
      transactions: [
        {
          id: "tx-1",
          amount: 1000,
          memo: null,
          type: "NORMAL",
          utility_type: null,
          logical_date: "2026-05-01",
          created_at: "2026-05-01T00:00:00.000Z",
        },
      ],
      totalCount: 120,
      offset: 50,
      pageSize: 50,
      hasMore: true,
    });

    expect(result).not.toBeNull();
    expect(result?.transactions).toHaveLength(1);
    expect(result?.transactions[0]?.isOptimistic).toBe(false);
    expect(result?.totalCount).toBe(120);
    expect(result?.hasMore).toBe(true);
  });

  it("不正な応答は null", () => {
    expect(parseHistoryCycleListPage(null)).toBeNull();
    expect(parseHistoryCycleListPage({ transactions: [] })).toBeNull();
    expect(
      parseHistoryCycleListPage({
        transactions: [{ id: "x" }],
        totalCount: 1,
        offset: 0,
        pageSize: 50,
        hasMore: false,
      }),
    ).toBeNull();
  });
});
