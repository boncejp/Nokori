import type { UtilityType } from "@/lib/types/domain";
import type { TransactionKind } from "@/lib/logic/transaction-validation";

type TransactionPersistencePlan = {
  readonly transactionType: "NORMAL" | "SPECIAL";
  readonly utilityType: UtilityType | null;
  readonly shouldUseSpecialAtomicMutation: boolean;
};

export function createTransactionPersistencePlan(params: {
  readonly kind: TransactionKind;
  readonly utilityType: UtilityType | null;
}): TransactionPersistencePlan {
  const { kind, utilityType } = params;

  if (kind === "SPECIAL") {
    return {
      transactionType: "SPECIAL",
      utilityType: null,
      shouldUseSpecialAtomicMutation: true,
    };
  }

  return {
    transactionType: "NORMAL",
    utilityType: kind === "UTILITY" ? utilityType : null,
    shouldUseSpecialAtomicMutation: false,
  };
}
