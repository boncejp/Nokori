/**
 * サイクル内の確定支出集計（普通支出・光熱費差額の織り込み）。
 */

import type { TransactionAmountRow, UtilityEstimateMap } from "@/lib/types/domain";

/** 光熱費を除く普通支出の合計（初回サイクル締め・初回残予算用） */
export function sumPlainNormalExpenseAmounts(
  transactions: readonly TransactionAmountRow[],
): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.type !== "NORMAL") {
      return sum;
    }
    if (transaction.utility_type !== null) {
      return sum;
    }
    return sum + transaction.amount;
  }, 0);
}

/**
 * 通常サイクル: サイクル開始〜前日までの確定支出。
 * 光熱費は「実額 − 概算」の符号を反転して予算消費として加算する。
 */
export function calculateConfirmedNormalSpentWithUtilityAdjustment(
  transactions: readonly TransactionAmountRow[],
  utilityEstimates: UtilityEstimateMap,
): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.type !== "NORMAL") {
      return sum;
    }
    if (transaction.utility_type === null) {
      return sum + transaction.amount;
    }
    const estimate = utilityEstimates[transaction.utility_type];
    return sum - (estimate - transaction.amount);
  }, 0);
}
