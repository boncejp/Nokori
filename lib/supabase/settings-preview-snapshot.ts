import type { SupabaseClient } from "@supabase/supabase-js";
import { subDays } from "date-fns";

import {
  calculateConfirmedNormalSpentWithUtilityAdjustment,
  calculateCycleWindow,
  calculateDaysUntilNextPayday,
  parseJstDateKeyToDate,
  sumPlainNormalExpenseAmounts,
  toJstDateString,
  type UtilityEstimateMap,
} from "@/lib/logic/budget-logic";
import type { DashboardPreviewTransaction } from "@/lib/logic/dashboard-cycle-metrics";
import { listTransactionsByLogicalDate, listTransactionsByLogicalDateRange } from "@/lib/supabase/transactions";
import type { Database, Tables } from "@/lib/types/database";

type Profile = Tables<"profiles">;

type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export type SettingsPreviewSnapshot = {
  readonly logicalTodayKey: string;
  readonly currentTotalSavingsDb: number;
  readonly initialBudgetDb: number;
  readonly confirmedNormalSpentBeforeToday: number;
  readonly todayTransactions: readonly DashboardPreviewTransaction[];
  readonly utilityEstimatesDb: UtilityEstimateMap;
  readonly firstCycleCalendar: {
    readonly daysUntilNextPaydayIncludingToday: number;
    readonly daysUntilNextPaydayExcludingToday: number;
  } | null;
};

export async function fetchSettingsPreviewSnapshot(params: {
  readonly supabase: SupabaseClient<Database>;
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly isFirstCycle: boolean;
  readonly nextPayday: Date;
}): Promise<Result<SettingsPreviewSnapshot>> {
  const anchorLogicalDate = parseJstDateKeyToDate(params.profile.target_anchor_logical_date);
  const cycleWindow = calculateCycleWindow({
    referenceDate: params.logicalToday,
    payday: params.profile.payday,
    paydayRule: params.profile.payday_rule,
  });

  const previousDay = subDays(params.logicalToday, 1);
  const cycleStartForRange = params.isFirstCycle ? anchorLogicalDate : cycleWindow.cycleStartDate;
  const cycleStartString = toJstDateString(cycleStartForRange);
  const previousDayString = toJstDateString(previousDay);

  let confirmedNormalSpentBeforeToday = 0;
  if (cycleStartString <= previousDayString) {
    const transactionsResult = await listTransactionsByLogicalDateRange(params.supabase, {
      fromLogicalDate: cycleStartForRange,
      toLogicalDate: previousDay,
    });
    if (!transactionsResult.success) {
      return { success: false, error: transactionsResult.error };
    }

    if (params.isFirstCycle) {
      confirmedNormalSpentBeforeToday = sumPlainNormalExpenseAmounts(transactionsResult.data);
    } else {
      confirmedNormalSpentBeforeToday = calculateConfirmedNormalSpentWithUtilityAdjustment(transactionsResult.data, {
        ELECTRICITY: params.profile.estimated_electricity,
        GAS: params.profile.estimated_gas,
        WATER: params.profile.estimated_water,
      });
    }
  }

  const todayResult = await listTransactionsByLogicalDate(params.supabase, params.logicalToday);
  if (!todayResult.success) {
    return { success: false, error: todayResult.error };
  }

  const todayTransactions: DashboardPreviewTransaction[] = todayResult.data.map((transaction) => ({
    amount: transaction.amount,
    type: transaction.type,
    utility_type: transaction.utility_type,
  }));

  let firstCycleCalendar: SettingsPreviewSnapshot["firstCycleCalendar"] = null;
  if (params.isFirstCycle) {
    firstCycleCalendar = {
      daysUntilNextPaydayIncludingToday: calculateDaysUntilNextPayday({
        fromDate: params.logicalToday,
        nextPayday: params.nextPayday,
        includeToday: true,
      }),
      daysUntilNextPaydayExcludingToday: calculateDaysUntilNextPayday({
        fromDate: params.logicalToday,
        nextPayday: params.nextPayday,
        includeToday: false,
      }),
    };
  }

  return {
    success: true,
    data: {
      logicalTodayKey: toJstDateString(params.logicalToday),
      currentTotalSavingsDb: params.profile.current_total_savings,
      initialBudgetDb: params.profile.initial_budget,
      confirmedNormalSpentBeforeToday,
      todayTransactions,
      utilityEstimatesDb: {
        ELECTRICITY: params.profile.estimated_electricity,
        GAS: params.profile.estimated_gas,
        WATER: params.profile.estimated_water,
      },
      firstCycleCalendar,
    },
  };
}
