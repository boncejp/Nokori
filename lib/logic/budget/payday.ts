/**
 * 給料日・土日祝ルール・サイクル窓の算出。
 * date-fns の addMonths/endOfMonth はサーバー TZ 依存のため、JST 年月の手計算を使う。
 */

import * as holidayJp from "@holiday-jp/holiday_jp";
import { addDays, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { TIMEZONE } from "@/lib/constants/time";
import type { PaydayRule } from "@/lib/types/domain";

import { createJstDate, toJstDateString, toJstStartOfDay } from "./jst-dates";

function isHolidayInJapan(date: Date): boolean {
  // toZonedTime で JST の年月日を取り出し、Date.UTC で再構築する。
  // createJstDate は fromZonedTime により UTC 値が「前日 15:00Z」になるため、
  // @holiday-jp/holiday_jp が UTC 値を読み取ると 1 日ずれる。
  const jstDate = toZonedTime(date, TIMEZONE);
  const normalizedDate = new Date(
    Date.UTC(jstDate.getFullYear(), jstDate.getMonth(), jstDate.getDate()),
  );
  return holidayJp.between(normalizedDate, normalizedDate).length > 0;
}

function isWeekendOrHoliday(date: Date): boolean {
  const jstDate = toZonedTime(date, TIMEZONE);
  const day = jstDate.getDay();
  const isWeekend = day === 0 || day === 6;
  return isWeekend || isHolidayInJapan(date);
}

function adjustPaydayByRule(basePayday: Date, paydayRule: PaydayRule): Date {
  if (paydayRule === "FIXED") {
    return basePayday;
  }

  let adjusted = basePayday;
  while (isWeekendOrHoliday(adjusted)) {
    adjusted = paydayRule === "BEFORE" ? subDays(adjusted, 1) : addDays(adjusted, 1);
  }
  return adjusted;
}

function calculatePaydayInMonth(params: {
  readonly referenceDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
  readonly monthOffset: number;
}): Date {
  const { referenceDate, payday, paydayRule, monthOffset } = params;
  const jstReferenceDate = toZonedTime(referenceDate, TIMEZONE);

  let targetYear = jstReferenceDate.getFullYear();
  let targetMonthIdx = jstReferenceDate.getMonth() + monthOffset;
  while (targetMonthIdx < 0) {
    targetMonthIdx += 12;
    targetYear -= 1;
  }
  while (targetMonthIdx > 11) {
    targetMonthIdx -= 12;
    targetYear += 1;
  }

  const monthLastDay = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 0)).getUTCDate();
  const resolvedPayday = Math.min(payday, monthLastDay);
  const basePayday = createJstDate(targetYear, targetMonthIdx, resolvedPayday);

  return adjustPaydayByRule(basePayday, paydayRule);
}

/**
 * 次回の給料日を算出する（給料日ルール、土日祝、月末補正を適用）。
 */
export function calculateNextPayday(params: {
  readonly fromDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): Date {
  const { fromDate, payday, paydayRule } = params;
  if (payday < 1 || payday > 31) {
    throw new Error(`payday must be between 1 and 31: ${payday}`);
  }

  const jstNow = toZonedTime(fromDate, TIMEZONE);
  const year = jstNow.getFullYear();
  const month = jstNow.getMonth();

  const currentMonthLastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const currentMonthDay = Math.min(payday, currentMonthLastDay);
  const currentMonthBase = createJstDate(year, month, currentMonthDay);
  const currentMonthPayday = adjustPaydayByRule(currentMonthBase, paydayRule);

  const todayString = toJstDateString(fromDate);
  const currentPaydayString = toJstDateString(currentMonthPayday);
  if (todayString <= currentPaydayString) {
    return toJstStartOfDay(currentMonthPayday);
  }

  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthLastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const nextMonthDay = Math.min(payday, nextMonthLastDay);
  const nextMonthBase = createJstDate(nextYear, nextMonth, nextMonthDay);
  const nextMonthPayday = adjustPaydayByRule(nextMonthBase, paydayRule);
  return toJstStartOfDay(nextMonthPayday);
}

/**
 * 参照日が属するサイクル開始日と次回給料日を返す。
 */
export function calculateCycleWindow(params: {
  readonly referenceDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): {
  readonly cycleStartDate: Date;
  readonly nextPaydayDate: Date;
} {
  const { referenceDate, payday, paydayRule } = params;
  const currentMonthPayday = calculatePaydayInMonth({
    referenceDate,
    payday,
    paydayRule,
    monthOffset: 0,
  });
  const previousMonthPayday = calculatePaydayInMonth({
    referenceDate,
    payday,
    paydayRule,
    monthOffset: -1,
  });
  const nextMonthPayday = calculatePaydayInMonth({
    referenceDate,
    payday,
    paydayRule,
    monthOffset: 1,
  });

  const referenceDateString = toJstDateString(referenceDate);
  const currentMonthPaydayString = toJstDateString(currentMonthPayday);
  if (referenceDateString >= currentMonthPaydayString) {
    return {
      cycleStartDate: toJstStartOfDay(currentMonthPayday),
      nextPaydayDate: toJstStartOfDay(nextMonthPayday),
    };
  }

  return {
    cycleStartDate: toJstStartOfDay(previousMonthPayday),
    nextPaydayDate: toJstStartOfDay(currentMonthPayday),
  };
}

/**
 * 達成期間（か月）に基づき、目標日（給料日）を算出する。
 */
export function calculateTargetDateFromDuration(params: {
  readonly anchorLogicalDate: Date;
  readonly durationMonths: number;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): Date {
  const { anchorLogicalDate, durationMonths, payday, paydayRule } = params;
  if (durationMonths < 1) {
    throw new Error(`durationMonths must be at least 1: ${durationMonths}`);
  }

  const anchorJst = toZonedTime(anchorLogicalDate, TIMEZONE);
  let targetYear = anchorJst.getFullYear();
  let targetMonthIdx = anchorJst.getMonth() + durationMonths;
  while (targetMonthIdx > 11) {
    targetMonthIdx -= 12;
    targetYear += 1;
  }

  return calculatePaydayInMonth({
    referenceDate: new Date(Date.UTC(targetYear, targetMonthIdx, 15)),
    payday,
    paydayRule,
    monthOffset: 0,
  });
}
