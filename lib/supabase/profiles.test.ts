import { describe, expect, it, vi } from "vitest";

import { resetOwnDataAtomically } from "./profiles";

describe("resetOwnDataAtomically", () => {
  it("reset用RPCを呼び出して削除件数を返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 5,
      error: null,
    });
    const supabase = { rpc };

    const result = await resetOwnDataAtomically(supabase);

    expect(rpc).toHaveBeenCalledWith("reset_own_data_atomic");
    expect(result).toEqual({
      success: true,
      data: {
        deletedTransactionCount: 5,
      },
    });
  });

  it("RPC失敗時はエラーを返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "rollback" },
    });
    const supabase = { rpc };

    const result = await resetOwnDataAtomically(supabase);

    expect(result.success).toBe(false);
  });
});
