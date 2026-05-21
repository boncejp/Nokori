import { describe, expect, it } from "vitest";
import { formatDigitsWithCommas, toNumericOnly } from "./money-input-format";

describe("toNumericOnly", () => {
  it("数字のみの文字列をそのまま返す", () => {
    expect(toNumericOnly("12345")).toBe("12345");
  });

  it("空文字を返す", () => {
    expect(toNumericOnly("")).toBe("");
  });

  it("アルファベットを除去する", () => {
    expect(toNumericOnly("abc123")).toBe("123");
  });

  it("カンマを除去する", () => {
    expect(toNumericOnly("1,000")).toBe("1000");
  });

  it("円記号を除去する", () => {
    expect(toNumericOnly("¥1000")).toBe("1000");
  });

  it("スペースを除去する", () => {
    expect(toNumericOnly("1 000")).toBe("1000");
  });

  it("小数点を除去する", () => {
    expect(toNumericOnly("1.5")).toBe("15");
  });

  it("マイナス記号を除去する", () => {
    expect(toNumericOnly("-500")).toBe("500");
  });

  it("全角数字は除去される（非 ASCII）", () => {
    expect(toNumericOnly("１２３")).toBe("");
  });

  it("数字以外のみの文字列は空文字を返す", () => {
    expect(toNumericOnly("abc")).toBe("");
  });
});

describe("formatDigitsWithCommas", () => {
  it("空文字は空文字を返す", () => {
    expect(formatDigitsWithCommas("")).toBe("");
  });

  it("3桁以下はカンマなしで返す", () => {
    expect(formatDigitsWithCommas("100")).toBe("100");
  });

  it("4桁は千区切りにする", () => {
    expect(formatDigitsWithCommas("1000")).toBe("1,000");
  });

  it("7桁は百万・千区切りにする", () => {
    expect(formatDigitsWithCommas("1000000")).toBe("1,000,000");
  });

  it("先頭ゼロ付きは数値に正規化してからフォーマットする", () => {
    expect(formatDigitsWithCommas("0100")).toBe("100");
  });

  it("'0' 単体はそのまま '0' を返す", () => {
    expect(formatDigitsWithCommas("0")).toBe("0");
  });

  it("'000' は '0' に正規化する", () => {
    expect(formatDigitsWithCommas("000")).toBe("0");
  });

  it("999 はカンマなし", () => {
    expect(formatDigitsWithCommas("999")).toBe("999");
  });

  it("1234 は 1,234 になる", () => {
    expect(formatDigitsWithCommas("1234")).toBe("1,234");
  });

  it("9 桁は正しく区切られる", () => {
    expect(formatDigitsWithCommas("123456789")).toBe("123,456,789");
  });
});
