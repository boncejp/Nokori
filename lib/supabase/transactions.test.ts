import { describe, expect, it, vi } from "vitest";

import { deleteOwnTransactionById } from "./transactions";

describe("deleteOwnTransactionById", () => {
  it("SPECIAL削除は貯金復元込みRPCを呼び出す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "2d00a6f1-c869-4cc5-aa76-c95ea5dab76e",
        user_id: "f46d97f8-6ef4-4456-ad94-3d130954f542",
        amount: 12_000,
        memo: "臨時費用",
        type: "SPECIAL",
        utility_type: null,
        logical_date: "2026-05-09",
        created_at: "2026-05-09T09:00:00+00:00",
      },
      error: null,
    });
    const supabase = { rpc };

    const result = await deleteOwnTransactionById(
      supabase,
      "2d00a6f1-c869-4cc5-aa76-c95ea5dab76e",
    );

    expect(rpc).toHaveBeenCalledWith("delete_own_transaction_and_restore_savings", {
      p_transaction_id: "2d00a6f1-c869-4cc5-aa76-c95ea5dab76e",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.type).toBe("SPECIAL");
    }
  });

  it("RPCエラー時は失敗として返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "failed" },
    });
    const supabase = { rpc };

    const result = await deleteOwnTransactionById(
      supabase,
      "2d00a6f1-c869-4cc5-aa76-c95ea5dab76e",
    );

    expect(result.success).toBe(false);
  });
});
