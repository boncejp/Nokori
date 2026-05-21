/**
 * 日次予算の配分（当日 D_today / 今日の残り / 翌日以降 D_future）。
 * 要件 §2.3（初回）・§2.4（通常）の式をそのままコード化する。
 */

import { differenceInCalendarDays, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { TIMEZONE } from "@/lib/constants/time";

/**
 * 次回給料日までの日数を返す。
 */
export function calculateDaysUntilNextPayday(params: {
  readonly fromDate: Date;
  readonly nextPayday: Date;
  readonly includeToday: boolean;
}): number {
  const { fromDate, nextPayday, includeToday } = params;
  const fromJstStart = startOfDay(toZonedTime(fromDate, TIMEZONE));
  const paydayJstStart = startOfDay(toZonedTime(nextPayday, TIMEZONE));
  const days = differenceInCalendarDays(paydayJstStart, fromJstStart);

  if (days < 0) {
    throw new Error("nextPayday must be on or after fromDate");
  }

  return includeToday ? days + 1 : days;
}

/** 当日予算 D_today = 残りサイクル予算 ÷ 残り日数（当日含む） */
export function calculateDailyBudgetToday(params: {
  readonly remainingCycleBudget: number;
  readonly daysUntilNextPaydayIncludingToday: number;
}): number {
  const { remainingCycleBudget, daysUntilNextPaydayIncludingToday } = params;
  if (daysUntilNextPaydayIncludingToday <= 0) {
    throw new Error("daysUntilNextPaydayIncludingToday must be greater than 0");
  }
  return remainingCycleBudget / daysUntilNextPaydayIncludingToday;
}

/** 今日の残り = 当日予算 − 当日の普通支出合計 */
export function calculateRemainingToday(params: {
  readonly dailyBudgetToday: number;
  readonly todaySpent: number;
}): number {
  const { dailyBudgetToday, todaySpent } = params;
  return dailyBudgetToday - todaySpent;
}

/** 翌日以降予算プレビュー（当日普通支出を差し引いたうえで残日数で割る） */
export function calculateDailyBudgetFuture(params: {
  readonly remainingCycleBudget: number;
  readonly todaySpent: number;
  readonly daysUntilNextPaydayExcludingToday: number;
}): number {
  const { remainingCycleBudget, todaySpent, daysUntilNextPaydayExcludingToday } = params;
  const budgetAfterTodaySpending = remainingCycleBudget - todaySpent;

  if (daysUntilNextPaydayExcludingToday < 0) {
    throw new Error("daysUntilNextPaydayExcludingToday must not be negative");
  }
  if (daysUntilNextPaydayExcludingToday === 0) {
    return budgetAfterTodaySpending;
  }

  return budgetAfterTodaySpending / daysUntilNextPaydayExcludingToday;
}
