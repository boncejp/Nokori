/**
 * 履歴一覧に含める論理日の範囲（初回 / 通常で窓が異なる）。
 */

import type { PaydayRule } from "@/lib/types/domain";

import { toJstStartOfDay } from "./jst-dates";
import { getFirstCycleEndLogicalDate } from "./first-cycle";
import { getNormalCycleListingEndLogicalDate } from "./normal-cycle-proration";
import { calculateCycleWindow } from "./payday";

export function getHistoryListingLogicalDateRange(params: {
  readonly logicalToday: Date;
  readonly anchorLogicalDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
  readonly isFirstCycle: boolean;
}): { readonly from: Date; readonly to: Date } {
  if (params.isFirstCycle) {
    return {
      from: toJstStartOfDay(params.anchorLogicalDate),
      to: getFirstCycleEndLogicalDate({
        anchorLogicalDate: params.anchorLogicalDate,
        payday: params.payday,
        paydayRule: params.paydayRule,
      }),
    };
  }

  const window = calculateCycleWindow({
    referenceDate: params.logicalToday,
    payday: params.payday,
    paydayRule: params.paydayRule,
  });
  return {
    from: window.cycleStartDate,
    to: getNormalCycleListingEndLogicalDate(window.nextPaydayDate),
  };
}
