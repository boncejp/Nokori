/**
 * JST 暦日・論理日（27:00 ルール）の純粋関数。
 * サーバー TZ に依存しないよう、暦日キー（YYYY-MM-DD）比較を優先する。
 */

import { startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { RESET_HOUR, TIMEZONE } from "@/lib/constants/time";

/** JST の暦日の開始（00:00）を表す `Date` に正規化する。論理日キーとの比較・範囲クエリに使う。 */
export function toJstStartOfDay(date: Date): Date {
  const jstDate = toZonedTime(date, TIMEZONE);
  const jstStart = startOfDay(jstDate);
  return fromZonedTime(jstStart, TIMEZONE);
}

export function toJstDateString(date: Date): string {
  const jstDate = toZonedTime(date, TIMEZONE);
  const year = String(jstDate.getFullYear());
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** profiles の論理日キー（YYYY-MM-DD）を、その日の JST 開始の瞬間として解釈する Date を返す。 */
export function parseJstDateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

/** 暦日キー同士の差（to − from）を日単位で返す。日本は DST なしのため ms/日 で十分。 */
export function differenceJstCalendarDaysBetweenKeys(fromKey: string, toKey: string): number {
  const fromMs = parseJstDateKeyToDate(fromKey).getTime();
  const toMs = parseJstDateKeyToDate(toKey).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function createJstDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  const month = String(monthIndex + 1).padStart(2, "0");
  const day = String(dayOfMonth).padStart(2, "0");
  return fromZonedTime(`${year}-${month}-${day}T00:00:00`, TIMEZONE);
}

/**
 * 27:00 (JST 03:00) ルールに基づき論理日付を返す。
 * 00:00〜02:59 の入力は前日の論理日に属する。
 */
export function getLogicalDate(now: Date): Date {
  const jstNow = toZonedTime(now, TIMEZONE);
  const jstStart = startOfDay(jstNow);
  if (jstNow.getHours() < RESET_HOUR) {
    return subDays(jstStart, 1);
  }
  return jstStart;
}
