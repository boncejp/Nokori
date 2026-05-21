/**
 * 日時・論理日の基準定数（要件定義書 §2.1 / 設計書 §4）。
 * サーバーが UTC でも、すべての暦日・27:00 判定は JST で行う。
 */

/** アプリ全体の論理日・サイクル計算の基準タイムゾーン */
export const TIMEZONE = "Asia/Tokyo" as const;

/**
 * 27:00 リセット境界（JST の時）。
 * この時刻未満の入力は「前日」の論理日として扱う。
 */
export const RESET_HOUR = 3 as const;
