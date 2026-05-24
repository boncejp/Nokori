import { describe, expect, it } from "vitest";

import { parseHistoryCycleListOffset } from "./history-cycle-list-validation";

describe("parseHistoryCycleListOffset", () => {
  it("未指定のときは 0", () => {
    expect(parseHistoryCycleListOffset(null)).toEqual({ success: true, offset: 0 });
    expect(parseHistoryCycleListOffset("")).toEqual({ success: true, offset: 0 });
  });

  it("50 件単位の非負整数を受け付ける", () => {
    expect(parseHistoryCycleListOffset("0")).toEqual({ success: true, offset: 0 });
    expect(parseHistoryCycleListOffset("50")).toEqual({ success: true, offset: 50 });
    expect(parseHistoryCycleListOffset("100")).toEqual({ success: true, offset: 100 });
  });

  it("負数・小数・50 の倍数でない offset は拒否する", () => {
    expect(parseHistoryCycleListOffset("-1").success).toBe(false);
    expect(parseHistoryCycleListOffset("1.5").success).toBe(false);
    expect(parseHistoryCycleListOffset("25").success).toBe(false);
    expect(parseHistoryCycleListOffset("abc").success).toBe(false);
  });
});
