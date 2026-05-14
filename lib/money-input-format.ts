/** 金額入力用: 数字以外を除去し、状態には桁のみを保持する */
export function toNumericOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/** 桁のみの文字列を千区切り表示用に整形する（先頭ゼロは数値化で正規化される） */
export function formatDigitsWithCommas(value: string): string {
  if (value.length === 0) {
    return "";
  }
  return String(Number(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
