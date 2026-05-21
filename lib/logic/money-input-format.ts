/**
 * 金額入力 UI 用の文字列正規化（純粋関数）。
 *
 * 状態には「数字のみ」を保持し、表示時に千区切りへ整形する分離設計。
 * 入力中の千区切り削除を避けるため、桁数 1 つの真実は `toNumericOnly` の出力にする。
 */

export function toNumericOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function formatDigitsWithCommas(value: string): string {
  if (value.length === 0) {
    return "";
  }
  return String(Number(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
