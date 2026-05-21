/**
 * `dashboard-store` から純粋な型ガード・小ヘルパーを切り出した。
 *
 * - 楽観的更新で扱う `DashboardTransaction` の型と、API レスポンスからの安全な復元
 * - 論理日キーから JST 開始 `Date` への変換
 *
 * I/O やストア状態を持たないため、`lib/logic/` 同様に Vitest でカバーしやすい。
 */

import { getLogicalDate, parseJstDateKeyToDate } from "@/lib/logic/budget-logic";
import { isRecord } from "@/lib/types/object-parsing";
import { UTILITY_TYPE_VALUES, type UtilityType } from "@/lib/types/domain";

export type DashboardTransaction = {
  readonly id: string;
  readonly amount: number;
  readonly memo: string | null;
  readonly type: "NORMAL" | "SPECIAL";
  readonly utility_type: UtilityType | null;
  readonly logical_date: string;
  readonly created_at: string;
  readonly isOptimistic: boolean;
};

/** POST /api/transactions の `transaction` プロパティを安全に復元する。 */
export function isDashboardTransaction(value: unknown): value is DashboardTransaction {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== "string") return false;
  if (typeof value.amount !== "number") return false;
  if (!(typeof value.memo === "string" || value.memo === null)) return false;
  if (!(value.type === "NORMAL" || value.type === "SPECIAL")) return false;

  const utilityType = value.utility_type;
  const isValidUtilityType =
    utilityType === null ||
    (typeof utilityType === "string" && (UTILITY_TYPE_VALUES as readonly string[]).includes(utilityType));
  if (!isValidUtilityType) return false;

  if (typeof value.logical_date !== "string") return false;
  if (typeof value.created_at !== "string") return false;
  return true;
}

/**
 * `YYYY-MM-DD` を JST 開始の `Date` として解釈する。
 * 不正な文字列は `Error` を投げる（呼び出し側は try/catch で握る前提）。
 */
export function parseLogicalDateString(logicalDate: string): Date {
  const date = parseJstDateKeyToDate(logicalDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`論理日付の形式が不正です: ${logicalDate}`);
  }
  return date;
}

/**
 * `logicalToday` 文字列が空または不正なら、現在時刻の論理日にフォールバックする。
 * 設定 PATCH 後など、ハイドレーション前後で UI を壊さないための保険。
 */
export function resolveLogicalTodayDate(logicalToday: string): Date {
  if (logicalToday.length === 0) {
    return getLogicalDate(new Date());
  }

  try {
    return parseLogicalDateString(logicalToday);
  } catch {
    return getLogicalDate(new Date());
  }
}
