import { describe, expect, it } from "vitest";
import { validateTransactionPayload } from "./transaction-validation";

describe("validateTransactionPayload", () => {
  describe("正常系", () => {
    it("普通支出の最小ペイロード（メモなし）を受け付ける", () => {
      const result = validateTransactionPayload({ amount: 1_000, kind: "NORMAL" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual({ amount: 1_000, kind: "NORMAL", utilityType: null, memo: null });
    });

    it("特別支出を受け付ける", () => {
      const result = validateTransactionPayload({ amount: 50_000, kind: "SPECIAL" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual({ amount: 50_000, kind: "SPECIAL", utilityType: null, memo: null });
    });

    it("光熱費（電気）を utilityType 付きで受け付ける", () => {
      const result = validateTransactionPayload({ amount: 8_500, kind: "UTILITY", utilityType: "ELECTRICITY" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual({ amount: 8_500, kind: "UTILITY", utilityType: "ELECTRICITY", memo: null });
    });

    it("光熱費（ガス）を受け付ける", () => {
      const result = validateTransactionPayload({ amount: 4_200, kind: "UTILITY", utilityType: "GAS" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.utilityType).toBe("GAS");
    });

    it("光熱費（水道）を受け付ける", () => {
      const result = validateTransactionPayload({ amount: 3_000, kind: "UTILITY", utilityType: "WATER" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.utilityType).toBe("WATER");
    });

    it("メモあり（200文字以内）を受け付ける", () => {
      const result = validateTransactionPayload({ amount: 500, kind: "NORMAL", memo: "ランチ代" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.memo).toBe("ランチ代");
    });

    it("メモが空文字のとき null に正規化する", () => {
      const result = validateTransactionPayload({ amount: 500, kind: "NORMAL", memo: "" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.memo).toBeNull();
    });

    it("メモが空白のみのとき null に正規化する", () => {
      const result = validateTransactionPayload({ amount: 500, kind: "NORMAL", memo: "   " });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.memo).toBeNull();
    });

    it("メモが null のとき null のまま受け付ける", () => {
      const result = validateTransactionPayload({ amount: 500, kind: "NORMAL", memo: null });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.memo).toBeNull();
    });

    it("utilityType が undefined のとき null として受け付ける", () => {
      const result = validateTransactionPayload({ amount: 300, kind: "NORMAL" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.utilityType).toBeNull();
    });

    it("小数点付き金額は切り捨てて受け付ける", () => {
      const result = validateTransactionPayload({ amount: 1_234.9, kind: "NORMAL" });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.amount).toBe(1_234);
    });
  });

  describe("金額のバリデーション", () => {
    it("金額が文字列のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: "1000", kind: "NORMAL" });
      expect(result.success).toBe(false);
    });

    it("金額が 0 のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 0, kind: "NORMAL" });
      expect(result.success).toBe(false);
    });

    it("金額が負数のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: -100, kind: "NORMAL" });
      expect(result.success).toBe(false);
    });

    it("金額が 0.9（切り捨て後 0）のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 0.9, kind: "NORMAL" });
      expect(result.success).toBe(false);
    });

    it("金額が NaN のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: NaN, kind: "NORMAL" });
      expect(result.success).toBe(false);
    });

    it("金額が Infinity のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: Infinity, kind: "NORMAL" });
      expect(result.success).toBe(false);
    });

    it("金額が欠落しているとき失敗する", () => {
      const result = validateTransactionPayload({ kind: "NORMAL" });
      expect(result.success).toBe(false);
    });
  });

  describe("種別（kind）のバリデーション", () => {
    it("kind が欠落しているとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 1_000 });
      expect(result.success).toBe(false);
    });

    it("kind が不正な文字列のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 1_000, kind: "INVALID" });
      expect(result.success).toBe(false);
    });

    it("kind が数値のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 1_000, kind: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe("utilityType のバリデーション", () => {
    it("不正な utilityType 文字列のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 1_000, kind: "UTILITY", utilityType: "HEAT" });
      expect(result.success).toBe(false);
    });
  });

  describe("メモのバリデーション", () => {
    it("メモが 201 文字のとき失敗する", () => {
      const tooLong = "あ".repeat(201);
      const result = validateTransactionPayload({ amount: 500, kind: "NORMAL", memo: tooLong });
      expect(result.success).toBe(false);
    });

    it("メモがちょうど 200 文字のとき成功する", () => {
      const maxLength = "あ".repeat(200);
      const result = validateTransactionPayload({ amount: 500, kind: "NORMAL", memo: maxLength });
      expect(result.success).toBe(true);
    });

    it("メモが数値のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 500, kind: "NORMAL", memo: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe("種別と utilityType の組み合わせ制約", () => {
    it("SPECIAL かつ utilityType が指定されているとき失敗する", () => {
      const result = validateTransactionPayload({
        amount: 10_000,
        kind: "SPECIAL",
        utilityType: "ELECTRICITY",
      });
      expect(result.success).toBe(false);
    });

    it("UTILITY かつ utilityType が null のとき失敗する", () => {
      const result = validateTransactionPayload({ amount: 8_000, kind: "UTILITY", utilityType: null });
      expect(result.success).toBe(false);
    });

    it("NORMAL かつ utilityType が指定されているとき失敗する", () => {
      const result = validateTransactionPayload({
        amount: 5_000,
        kind: "NORMAL",
        utilityType: "GAS",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ペイロード形式のバリデーション", () => {
    it("null を受け取ったとき失敗する", () => {
      const result = validateTransactionPayload(null);
      expect(result.success).toBe(false);
    });

    it("文字列を受け取ったとき失敗する", () => {
      const result = validateTransactionPayload("invalid");
      expect(result.success).toBe(false);
    });

    it("数値を受け取ったとき失敗する", () => {
      const result = validateTransactionPayload(42);
      expect(result.success).toBe(false);
    });
  });
});
