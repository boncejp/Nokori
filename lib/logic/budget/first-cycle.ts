/**
 * 初回サイクル（オンボ〜最初の給料日前日）の境界・日数・判定。
 */

import { addDays, differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { TIMEZONE } from "@/lib/constants/time";
import type { PaydayRule } from "@/lib/types/domain";

import { toJstDateString, toJstStartOfDay } from "./jst-dates";
import { calculateNextPayday } from "./payday";

/**
 * 初回サイクル終了論理日 = オンボ後「最初の給料日」の前日。
 */
export function getFirstCycleEndLogicalDate(params: {
  readonly anchorLogicalDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): Date {
  const { anchorLogicalDate, payday, paydayRule } = params;
  const anchorString = toJstDateString(anchorLogicalDate);
  const firstCandidatePayday = calculateNextPayday({
    fromDate: anchorLogicalDate,
    payday,
    paydayRule,
  });
  const firstCandidatePaydayString = toJstDateString(firstCandidatePayday);
  const firstPaydayAfterOnboarding =
    anchorString === firstCandidatePaydayString
      ? calculateNextPayday({
          fromDate: addDays(firstCandidatePayday, 1),
          payday,
          paydayRule,
        })
      : firstCandidatePayday;
  return toJstStartOfDay(subDays(firstPaydayAfterOnboarding, 1));
}

export function calculateFirstCycleDailyProrationDayCounts(params: {
  readonly logicalToday: Date;
  readonly anchorLogicalDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): {
  readonly daysIncludingToday: number;
  readonly daysExcludingToday: number;
} {
  const firstCycleEnd = getFirstCycleEndLogicalDate({
    anchorLogicalDate: params.anchorLogicalDate,
    payday: params.payday,
    paydayRule: params.paydayRule,
  });
  const todayJstStart = startOfDay(toZonedTime(params.logicalToday, TIMEZONE));
  const endJstStart = startOfDay(toZonedTime(firstCycleEnd, TIMEZONE));
  const diff = differenceInCalendarDays(endJstStart, todayJstStart);
  if (diff < 0) {
    throw new Error("logicalToday must not be after first cycle end");
  }
  return {
    daysIncludingToday: diff + 1,
    daysExcludingToday: diff,
  };
}

/** 初回サイクル中か（アンカー論理日〜初回終了日の両端含む） */
export function isWithinFirstCycle(params: {
  readonly anchorLogicalDate: Date;
  readonly referenceDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): boolean {
  const { anchorLogicalDate, referenceDate, payday, paydayRule } = params;
  const anchorString = toJstDateString(anchorLogicalDate);
  const firstCycleEndDate = getFirstCycleEndLogicalDate({ anchorLogicalDate, payday, paydayRule });
  const referenceDateString = toJstDateString(referenceDate);
  const firstCycleEndDateString = toJstDateString(firstCycleEndDate);

  return referenceDateString >= anchorString && referenceDateString <= firstCycleEndDateString;
}
