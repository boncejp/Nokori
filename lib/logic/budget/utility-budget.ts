/**
 * 光熱費の実額と概算の差額を当月残り予算へ反映するロジック（通常サイクルのみ）。
 */

import type { UtilityEstimateMap, UtilityType } from "@/lib/types/domain";

/** 光熱費実額と概算の差額（正: 予算増 / 負: 予算減） */
export function calculateUtilityBudgetDelta(params: {
  readonly utilityType: UtilityType;
  readonly actualAmount: number;
  readonly estimatedByType: UtilityEstimateMap;
}): number {
  const { utilityType, actualAmount, estimatedByType } = params;
  const estimatedAmount = estimatedByType[utilityType];
  return estimatedAmount - actualAmount;
}

export function applyUtilityDeltaToRemainingBudget(params: {
  readonly remainingBudget: number;
  readonly utilityDelta: number;
}): number {
  const { remainingBudget, utilityDelta } = params;
  return remainingBudget + utilityDelta;
}
