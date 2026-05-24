import { requireAuthenticatedUser } from "@/lib/api/auth";
import {
  apiServerErrorResponse,
  apiSuccessResponse,
  apiValidationErrorResponse,
} from "@/lib/api/responses";
import { HISTORY_CYCLE_LIST_PAGE_SIZE } from "@/lib/constants/history";
import { getHistoryListingLogicalDateRange, parseJstDateKeyToDate } from "@/lib/logic/budget-logic";
import { parseHistoryCycleListOffset } from "@/lib/logic/history-cycle-list-validation";
import { resolveDashboardCycle } from "@/lib/supabase/dashboard-cycle-resolve";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import {
  countTransactionsByLogicalDateRange,
  listTransactionsByLogicalDateRange,
} from "@/lib/supabase/transactions";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.success) {
    return authResult.response;
  }
  const { supabase, user } = authResult.data;

  const url = new URL(request.url);
  const offsetResult = parseHistoryCycleListOffset(url.searchParams.get("offset"));
  if (!offsetResult.success) {
    return apiValidationErrorResponse(offsetResult.errorMessage);
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    return apiValidationErrorResponse(
      "プロフィールが見つかりません。オンボーディングを完了してください。",
    );
  }

  const cycleResolution = await resolveDashboardCycle({
    supabase,
    userId: user.id,
    profile: profileResult.data,
  });
  if (!cycleResolution.success) {
    return apiServerErrorResponse(cycleResolution.errorMessage);
  }

  const profile = cycleResolution.data.profile;
  const historyLogicalRange = getHistoryListingLogicalDateRange({
    logicalToday: cycleResolution.data.logicalToday,
    anchorLogicalDate: parseJstDateKeyToDate(profile.target_anchor_logical_date),
    payday: profile.payday,
    paydayRule: profile.payday_rule,
    isFirstCycle: cycleResolution.data.isFirstCycle,
  });

  const rangeParams = {
    fromLogicalDate: historyLogicalRange.from,
    toLogicalDate: historyLogicalRange.to,
  };

  const [listResult, countResult] = await Promise.all([
    listTransactionsByLogicalDateRange(supabase, {
      ...rangeParams,
      limit: HISTORY_CYCLE_LIST_PAGE_SIZE,
      offset: offsetResult.offset,
    }),
    countTransactionsByLogicalDateRange(supabase, rangeParams),
  ]);

  if (!listResult.success) {
    return apiServerErrorResponse(
      "支出一覧の取得に失敗しました。時間をおいて再試行してください。",
    );
  }
  if (!countResult.success) {
    return apiServerErrorResponse(
      "支出件数の取得に失敗しました。時間をおいて再試行してください。",
    );
  }

  const totalCount = countResult.data;
  const nextOffset = offsetResult.offset + listResult.data.length;

  return apiSuccessResponse({
    transactions: listResult.data,
    totalCount,
    offset: offsetResult.offset,
    pageSize: HISTORY_CYCLE_LIST_PAGE_SIZE,
    hasMore: nextOffset < totalCount,
  });
}
