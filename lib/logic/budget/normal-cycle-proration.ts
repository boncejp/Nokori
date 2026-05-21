/**
 * 通常サイクルの日次予算分母（残り日数）。
 * Vercel UTC でもずれないよう JST 暦日キーで差分を取る。
 */

import { subDays } from "date-fns";

import { differenceJstCalendarDaysBetweenKeys, toJstDateString, toJstStartOfDay } from "./jst-dates";

/**
 * 通常サイクル履歴・日次分母の終端 = 次の給料日の前日（論理日）。
 */
export function getNormalCycleListingEndLogicalDate(nextPaydayDate: Date): Date {
  return toJstStartOfDay(subDays(nextPaydayDate, 1));
}

export function calculateNormalCycleDailyProrationDayCounts(params: {
  readonly logicalToday: Date;
  readonly nextPaydayDate: Date;
}): {
  readonly daysIncludingToday: number;
  readonly daysExcludingToday: number;
} {
  const cycleEndLogicalDate = getNormalCycleListingEndLogicalDate(params.nextPaydayDate);
  const todayKey = toJstDateString(params.logicalToday);
  const cycleEndKey = toJstDateString(cycleEndLogicalDate);
  let diff = differenceJstCalendarDaysBetweenKeys(todayKey, cycleEndKey);
  if (diff < 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[calculateNormalCycleDailyProrationDayCounts] logical today is after cycle end JST key; clamping denominators",
        {
          todayKey,
          cycleEndKey,
          nextPaydayKey: toJstDateString(params.nextPaydayDate),
        },
      );
    }
    diff = 0;
  }
  return {
    daysIncludingToday: diff + 1,
    daysExcludingToday: diff,
  };
}
