/**
 * 月次貯金ノルマ・基準サイクル予算（可処分予算）の算出。
 */

import { toZonedTime } from "date-fns-tz";

import { TIMEZONE } from "@/lib/constants/time";
import type { SurplusMode } from "@/lib/types/domain";

/** 目標日までの残り月数（最小 1） */
export function calculateRemainingMonthsToTarget(params: {
  readonly targetDate: Date;
  readonly referenceDate: Date;
}): number {
  const { targetDate, referenceDate } = params;
  const jstTarget = toZonedTime(targetDate, TIMEZONE);
  const jstReference = toZonedTime(referenceDate, TIMEZONE);
  const monthDiff =
    (jstTarget.getFullYear() - jstReference.getFullYear()) * 12 +
    (jstTarget.getMonth() - jstReference.getMonth());

  return Math.max(monthDiff + 1, 1);
}

/** 貯金目標に対する月次貯金ノルマ = (目標 − 現在貯金) ÷ 残り月数 */
export function calculateMonthlySavingsQuota(params: {
  readonly targetAmount: number;
  readonly currentTotalSavings: number;
  readonly targetDate: Date;
  readonly referenceDate: Date;
}): number {
  const { targetAmount, currentTotalSavings, targetDate, referenceDate } = params;
  const remainingMonths = calculateRemainingMonthsToTarget({ targetDate, referenceDate });
  const remainingSavings = targetAmount - currentTotalSavings;
  const monthlySavingsQuota = remainingSavings / remainingMonths;

  return Math.max(0, monthlySavingsQuota);
}

/**
 * 設計 §4.2 の基準サイクル予算 =
 * 月収 − 固定費 − 光熱費概算合計 − 月次貯金ノルマ
 */
export function calculateBaseCycleBudget(params: {
  readonly monthlyIncome: number;
  readonly fixedCosts: number;
  readonly estimatedElectricity: number;
  readonly estimatedGas: number;
  readonly estimatedWater: number;
  readonly monthlySavingsQuota: number;
}): number {
  const {
    monthlyIncome,
    fixedCosts,
    estimatedElectricity,
    estimatedGas,
    estimatedWater,
    monthlySavingsQuota,
  } = params;
  const estimatedUtilitiesTotal = estimatedElectricity + estimatedGas + estimatedWater;

  const rawBaseCycleBudget =
    monthlyIncome - fixedCosts - estimatedUtilitiesTotal - monthlySavingsQuota;
  return Math.max(0, rawBaseCycleBudget);
}

/**
 * 日次予算の分子「残りサイクル予算」。
 * 初回: initial_budget − 確定普通支出。通常: base + YUTORI繰越 − 確定支出。
 */
export function calculateNextRemainingCycleBudget(params: {
  readonly isFirstCycle: boolean;
  readonly surplusMode: SurplusMode;
  readonly initialBudget: number;
  readonly yutoriCarryover: number;
  readonly baseCycleBudget: number;
  readonly confirmedNormalSpentBeforeToday: number;
}): number {
  const {
    isFirstCycle,
    surplusMode,
    initialBudget,
    yutoriCarryover,
    baseCycleBudget,
    confirmedNormalSpentBeforeToday,
  } = params;
  if (isFirstCycle) {
    return initialBudget - confirmedNormalSpentBeforeToday;
  }
  const effectiveBudget =
    surplusMode === "YUTORI" ? baseCycleBudget + yutoriCarryover : baseCycleBudget;
  return effectiveBudget - confirmedNormalSpentBeforeToday;
}
