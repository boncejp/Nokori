import { describe, expect, it } from "vitest";

import { createTransactionPersistencePlan } from "./transaction-persistence";

describe("createTransactionPersistencePlan", () => {
  it("SPECIALは原子的ミューテーションを使う", () => {
    const result = createTransactionPersistencePlan({
      kind: "SPECIAL",
      utilityType: null,
    });

    expect(result.transactionType).toBe("SPECIAL");
    expect(result.utilityType).toBeNull();
    expect(result.shouldUseSpecialAtomicMutation).toBe(true);
  });

  it("NORMALは既存の通常登録経路を使う", () => {
    const result = createTransactionPersistencePlan({
      kind: "NORMAL",
      utilityType: null,
    });

    expect(result.transactionType).toBe("NORMAL");
    expect(result.utilityType).toBeNull();
    expect(result.shouldUseSpecialAtomicMutation).toBe(false);
  });

  it("UTILITYは通常登録でutility_typeを維持する", () => {
    const result = createTransactionPersistencePlan({
      kind: "UTILITY",
      utilityType: "ELECTRICITY",
    });

    expect(result.transactionType).toBe("NORMAL");
    expect(result.utilityType).toBe("ELECTRICITY");
    expect(result.shouldUseSpecialAtomicMutation).toBe(false);
  });
});
