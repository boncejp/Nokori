import type { UtilityType } from "@/lib/types/domain";
import type { ValidationResult } from "@/lib/types/result";
import { isRecord } from "@/lib/types/object-parsing";

export const TRANSACTION_KIND_VALUES = ["NORMAL", "SPECIAL", "UTILITY"] as const;
export type TransactionKind = (typeof TRANSACTION_KIND_VALUES)[number];

type ValidTransactionPayload = {
  readonly amount: number;
  readonly memo: string | null;
  readonly kind: TransactionKind;
  readonly utilityType: UtilityType | null;
};

function parseKind(rawKind: unknown): ValidationResult<TransactionKind> {
  if (typeof rawKind !== "string") {
    return { success: false, errorMessage: "種別を選択してください。" };
  }
  const matchedKind = TRANSACTION_KIND_VALUES.find((value) => value === rawKind);
  if (typeof matchedKind === "undefined") {
    return { success: false, errorMessage: "種別が不正です。" };
  }
  return { success: true, data: matchedKind };
}

function parseUtilityType(rawUtilityType: unknown): ValidationResult<UtilityType | null> {
  if (typeof rawUtilityType === "undefined" || rawUtilityType === null || rawUtilityType === "") {
    return { success: true, data: null };
  }
  if (rawUtilityType === "ELECTRICITY" || rawUtilityType === "GAS" || rawUtilityType === "WATER") {
    return { success: true, data: rawUtilityType };
  }
  return { success: false, errorMessage: "光熱費種別が不正です。" };
}

function parseAmount(rawAmount: unknown): ValidationResult<number> {
  if (typeof rawAmount !== "number" || !Number.isFinite(rawAmount)) {
    return { success: false, errorMessage: "金額は数値で入力してください。" };
  }
  const normalizedAmount = Math.floor(rawAmount);
  if (normalizedAmount <= 0) {
    return { success: false, errorMessage: "金額は1円以上で入力してください。" };
  }
  return { success: true, data: normalizedAmount };
}

function parseMemo(rawMemo: unknown): ValidationResult<string | null> {
  if (typeof rawMemo === "undefined" || rawMemo === null) {
    return { success: true, data: null };
  }
  if (typeof rawMemo !== "string") {
    return { success: false, errorMessage: "メモの形式が不正です。" };
  }
  const trimmedMemo = rawMemo.trim();
  if (trimmedMemo.length === 0) {
    return { success: true, data: null };
  }
  if (trimmedMemo.length > 200) {
    return { success: false, errorMessage: "メモは200文字以内で入力してください。" };
  }
  return { success: true, data: trimmedMemo };
}

export function validateTransactionPayload(rawPayload: unknown): ValidationResult<ValidTransactionPayload> {
  if (!isRecord(rawPayload)) {
    return { success: false, errorMessage: "送信データの形式が不正です。" };
  }

  const amountResult = parseAmount(rawPayload.amount);
  if (!amountResult.success) {
    return amountResult;
  }

  const kindResult = parseKind(rawPayload.kind);
  if (!kindResult.success) {
    return kindResult;
  }

  const utilityTypeResult = parseUtilityType(rawPayload.utilityType);
  if (!utilityTypeResult.success) {
    return utilityTypeResult;
  }

  const memoResult = parseMemo(rawPayload.memo);
  if (!memoResult.success) {
    return memoResult;
  }

  if (kindResult.data === "SPECIAL" && utilityTypeResult.data !== null) {
    return { success: false, errorMessage: "特別支出に光熱費種別は指定できません。" };
  }
  if (kindResult.data === "UTILITY" && utilityTypeResult.data === null) {
    return { success: false, errorMessage: "光熱費種別を選択してください。" };
  }
  if (kindResult.data !== "UTILITY" && utilityTypeResult.data !== null) {
    return { success: false, errorMessage: "光熱費種別はUTILITYでのみ指定できます。" };
  }

  return {
    success: true,
    data: {
      amount: amountResult.data,
      kind: kindResult.data,
      utilityType: utilityTypeResult.data,
      memo: memoResult.data,
    },
  };
}
