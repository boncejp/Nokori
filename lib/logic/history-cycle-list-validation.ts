import { HISTORY_CYCLE_LIST_PAGE_SIZE } from "@/lib/constants/history";

export function parseHistoryCycleListOffset(rawOffset: string | null): {
  readonly success: true;
  readonly offset: number;
} | {
  readonly success: false;
  readonly errorMessage: string;
} {
  if (rawOffset === null || rawOffset.trim() === "") {
    return { success: true, offset: 0 };
  }

  const parsed = Number(rawOffset);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      success: false,
      errorMessage: "offset は0以上の整数で指定してください。",
    };
  }

  if (parsed % HISTORY_CYCLE_LIST_PAGE_SIZE !== 0) {
    return {
      success: false,
      errorMessage: `offset は ${HISTORY_CYCLE_LIST_PAGE_SIZE} 件単位で指定してください。`,
    };
  }

  return { success: true, offset: parsed };
}
