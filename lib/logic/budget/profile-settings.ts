/**
 * 設定 PATCH 時の initial_budget / current_total_savings の保存値決定。
 * オンボ時の内訳式で貯金を上書きしない不変条件を守る（要件 §2.2）。
 */

import type { SurplusMode } from "@/lib/types/domain";

export function resolveInitialBudgetForSettingsUpdate(params: {
  readonly isWithinFirstCycle: boolean;
  readonly existingInitialBudget: number;
  readonly submittedInitialBudget: number;
}): number {
  const { isWithinFirstCycle, existingInitialBudget, submittedInitialBudget } = params;

  if (!isWithinFirstCycle) {
    return existingInitialBudget;
  }

  if (submittedInitialBudget !== existingInitialBudget) {
    return submittedInitialBudget;
  }

  return existingInitialBudget;
}

/** YUTORI 時の前サイクル繰越表示（STRICT では null） */
export function calculateYutoriCarryoverDisplay(params: {
  readonly surplusMode: SurplusMode;
  readonly yutoriCarryover: number;
}): number | null {
  if (params.surplusMode !== "YUTORI") {
    return null;
  }
  return params.yutoriCarryover;
}

export function resolveCurrentTotalSavingsForProfileSettingsUpdate(params: {
  readonly isWithinFirstCycle: boolean;
  readonly initialTotalAssets: number;
  readonly existingInitialBudget: number;
  readonly submittedInitialBudget: number;
  readonly existingCurrentTotalSavings: number;
}): number {
  const {
    isWithinFirstCycle,
    initialTotalAssets,
    existingInitialBudget,
    submittedInitialBudget,
    existingCurrentTotalSavings,
  } = params;

  if (!isWithinFirstCycle) {
    return existingCurrentTotalSavings;
  }

  if (submittedInitialBudget === existingInitialBudget) {
    return existingCurrentTotalSavings;
  }

  const impliedSavingsFromExistingBudget = initialTotalAssets - existingInitialBudget;
  if (existingCurrentTotalSavings !== impliedSavingsFromExistingBudget) {
    return existingCurrentTotalSavings;
  }

  return initialTotalAssets - submittedInitialBudget;
}

export function isFirstCycleInitialBudgetExceedingTotalAssets(params: {
  readonly isWithinFirstCycle: boolean;
  readonly submittedInitialBudget: number;
  readonly initialTotalAssets: number;
}): boolean {
  return (
    params.isWithinFirstCycle && params.submittedInitialBudget > params.initialTotalAssets
  );
}
