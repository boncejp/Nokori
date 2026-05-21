/**
 * `unknown` の JSON ボディを型安全に読むための小さなヘルパー（`as` 禁止ルール対応）。
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** YYYY-MM-DD（論理日キー） */
export const LOGICAL_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isLogicalDateKey(value: unknown): value is string {
  return typeof value === "string" && LOGICAL_DATE_KEY_PATTERN.test(value);
}
