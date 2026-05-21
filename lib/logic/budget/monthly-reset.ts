/**
 * 給料日リセット時の余剰金処理（STRICT / YUTORI）と初回サイクル締め。
 */

import type { SurplusMode } from "@/lib/types/domain";

/** 通常サイクル: 余剰金を貯金へ載せるか yutori_carryover へ載せるか */
export function processMonthlyReset(params: {
  readonly surplusMode: SurplusMode;
  readonly currentTotalSavings: number;
  readonly surplus: number;
}): {
  readonly nextTotalSavings: number;
  readonly nextYutoriCarryover: number;
} {
  const { surplusMode, currentTotalSavings, surplus } = params;
  if (surplus <= 0) {
    return {
      nextTotalSavings: currentTotalSavings,
      nextYutoriCarryover: 0,
    };
  }

  if (surplusMode === "STRICT") {
    return {
      nextTotalSavings: currentTotalSavings + surplus,
      nextYutoriCarryover: 0,
    };
  }

  return {
    nextTotalSavings: currentTotalSavings,
    nextYutoriCarryover: surplus,
  };
}

/**
 * 初回サイクル締め: 初回差額のみ貯金総額へ。YUTORI 繰越は発生しない。
 */
export function processFirstCycleClose(params: {
  readonly currentTotalSavings: number;
  readonly initialBudget: number;
  readonly sumPlainNormalSpentInFirstCycle: number;
}): {
  readonly nextTotalSavings: number;
  readonly nextYutoriCarryover: number;
} {
  const firstCycleDelta = params.initialBudget - params.sumPlainNormalSpentInFirstCycle;
  return {
    nextTotalSavings: params.currentTotalSavings + firstCycleDelta,
    nextYutoriCarryover: 0,
  };
}

/** 給料日かつ、同日のリセット未実行なら true（冪等性） */
export function shouldExecuteMonthlyReset(params: {
  readonly isPayday: boolean;
  readonly logicalTodayString: string;
  readonly lastMonthlyResetLogicalDate: string | null;
}): boolean {
  const { isPayday, logicalTodayString, lastMonthlyResetLogicalDate } = params;
  if (!isPayday) {
    return false;
  }
  return lastMonthlyResetLogicalDate !== logicalTodayString;
}
