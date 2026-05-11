import type { SupabaseClient } from "@supabase/supabase-js";
import { subDays } from "date-fns";

import {
  calculateBaseCycleBudget,
  calculateCycleWindow,
  calculateMonthlySavingsQuota,
  calculateNextRemainingCycleBudget,
  getLogicalDate,
  isWithinFirstCycle,
  parseJstDateKeyToDate,
  processFirstCycleClose,
  processMonthlyReset,
  shouldExecuteMonthlyReset,
  sumPlainNormalExpenseAmounts,
  toJstDateString,
  type UtilityType,
} from "@/lib/logic/budget-logic";
import { applyMonthlyResetForLogicalDate, fetchProfileByUserId } from "@/lib/supabase/profiles";
import { listTransactionsByLogicalDateRange } from "@/lib/supabase/transactions";
import type { Database, Tables } from "@/lib/types/database";

type Profile = Tables<"profiles">;
type Transaction = Tables<"transactions">;

export type ResolvedDashboardCycle = {
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly logicalTodayString: string;
  readonly nextPayday: Date;
  readonly remainingCycleBudget: number;
  readonly isFirstCycle: boolean;
};

function calculateConfirmedNormalSpent(
  transactions: readonly Transaction[],
  utilityEstimates: Readonly<Record<UtilityType, number>>,
): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.type !== "NORMAL") {
      return sum;
    }
    if (transaction.utility_type === null) {
      return sum + transaction.amount;
    }
    const estimate = utilityEstimates[transaction.utility_type];
    return sum - (estimate - transaction.amount);
  }, 0);
}

async function calculateConfirmedNormalSpendBeforeToday(params: {
  readonly supabase: SupabaseClient<Database>;
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly cycleStartDate: Date;
  readonly isFirstCycle: boolean;
  readonly anchorLogicalDate: Date;
}): Promise<number> {
  const previousDay = subDays(params.logicalToday, 1);
  const cycleStartForRange = params.isFirstCycle ? params.anchorLogicalDate : params.cycleStartDate;
  const cycleStartString = toJstDateString(cycleStartForRange);
  const previousDayString = toJstDateString(previousDay);
  if (cycleStartString > previousDayString) {
    return 0;
  }

  const transactionsResult = await listTransactionsByLogicalDateRange(params.supabase, {
    fromLogicalDate: cycleStartForRange,
    toLogicalDate: previousDay,
  });
  if (!transactionsResult.success) {
    return 0;
  }

  if (params.isFirstCycle) {
    return sumPlainNormalExpenseAmounts(transactionsResult.data);
  }

  return calculateConfirmedNormalSpent(transactionsResult.data, {
    ELECTRICITY: params.profile.estimated_electricity,
    GAS: params.profile.estimated_gas,
    WATER: params.profile.estimated_water,
  });
}

async function executeMonthlyReset(params: {
  readonly supabase: SupabaseClient<Database>;
  readonly userId: string;
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly logicalTodayString: string;
}): Promise<{ success: true; data: Profile } | { success: false }> {
  const previousCycleEndDate = subDays(params.logicalToday, 1);
  const anchorLogicalDate = parseJstDateKeyToDate(params.profile.target_anchor_logical_date);
  const closingFirstCycle = isWithinFirstCycle({
    anchorLogicalDate,
    referenceDate: previousCycleEndDate,
    payday: params.profile.payday,
    paydayRule: params.profile.payday_rule,
  });
  const previousCycleStartDate = closingFirstCycle
    ? anchorLogicalDate
    : calculateCycleWindow({
        referenceDate: previousCycleEndDate,
        payday: params.profile.payday,
        paydayRule: params.profile.payday_rule,
      }).cycleStartDate;
  const previousCycleTransactionsResult = await listTransactionsByLogicalDateRange(params.supabase, {
    fromLogicalDate: previousCycleStartDate,
    toLogicalDate: previousCycleEndDate,
  });

  if (!previousCycleTransactionsResult.success) {
    return { success: false };
  }

  const monthlySavingsQuota = calculateMonthlySavingsQuota({
    targetAmount: params.profile.target_amount,
    currentTotalSavings: params.profile.current_total_savings,
    targetDate: new Date(`${params.profile.target_date}T00:00:00+09:00`),
    referenceDate: params.logicalToday,
  });
  const baseCycleBudget = calculateBaseCycleBudget({
    monthlyIncome: params.profile.monthly_income,
    fixedCosts: params.profile.fixed_costs,
    estimatedElectricity: params.profile.estimated_electricity,
    estimatedGas: params.profile.estimated_gas,
    estimatedWater: params.profile.estimated_water,
    monthlySavingsQuota,
  });

  let nextTotalSavings: number;
  let nextInitialBudget: number;

  if (closingFirstCycle) {
    const sumPlainNormal = sumPlainNormalExpenseAmounts(previousCycleTransactionsResult.data);
    const firstClose = processFirstCycleClose({
      currentTotalSavings: params.profile.current_total_savings,
      initialBudget: params.profile.initial_budget,
      sumPlainNormalSpentInFirstCycle: sumPlainNormal,
      baseCycleBudget,
    });
    nextTotalSavings = firstClose.nextTotalSavings;
    nextInitialBudget = firstClose.nextInitialBudget;
  } else {
    const previousCycleConfirmedSpend = calculateConfirmedNormalSpent(previousCycleTransactionsResult.data, {
      ELECTRICITY: params.profile.estimated_electricity,
      GAS: params.profile.estimated_gas,
      WATER: params.profile.estimated_water,
    });
    const surplus = params.profile.initial_budget - previousCycleConfirmedSpend;
    const monthlyResetResult = processMonthlyReset({
      surplusMode: params.profile.surplus_mode,
      currentTotalSavings: params.profile.current_total_savings,
      baseBudget: baseCycleBudget,
      surplus,
    });
    nextTotalSavings = monthlyResetResult.nextTotalSavings;
    nextInitialBudget = monthlyResetResult.nextInitialBudget;
  }

  const updatedProfileResult = await applyMonthlyResetForLogicalDate(params.supabase, {
    userId: params.userId,
    logicalDate: params.logicalTodayString,
    nextTotalSavings,
    nextInitialBudget,
  });

  if (!updatedProfileResult.success) {
    return { success: false };
  }

  if (!updatedProfileResult.data.applied || updatedProfileResult.data.profile === null) {
    const latestProfileResult = await fetchProfileByUserId(params.supabase, params.userId);
    if (!latestProfileResult.success) {
      return { success: false };
    }
    return { success: true, data: latestProfileResult.data };
  }

  return { success: true, data: updatedProfileResult.data.profile };
}

export async function resolveDashboardCycle(params: {
  readonly supabase: SupabaseClient<Database>;
  readonly userId: string;
  readonly profile: Profile;
}): Promise<ResolvedDashboardCycle> {
  const logicalToday = getLogicalDate(new Date());
  const logicalTodayString = toJstDateString(logicalToday);
  const cycleWindow = calculateCycleWindow({
    referenceDate: logicalToday,
    payday: params.profile.payday,
    paydayRule: params.profile.payday_rule,
  });
  const isPayday = toJstDateString(logicalToday) === toJstDateString(cycleWindow.cycleStartDate);
  const shouldRunMonthlyReset = shouldExecuteMonthlyReset({
    isPayday,
    logicalTodayString,
    lastMonthlyResetLogicalDate: params.profile.last_monthly_reset_logical_date,
  });

  let profile = params.profile;
  if (shouldRunMonthlyReset) {
    const monthlyResetProfileResult = await executeMonthlyReset({
      supabase: params.supabase,
      userId: params.userId,
      profile,
      logicalToday,
      logicalTodayString,
    });
    if (monthlyResetProfileResult.success) {
      profile = monthlyResetProfileResult.data;
    }
  }

  const refreshedCycleWindow = calculateCycleWindow({
    referenceDate: logicalToday,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });
  const anchorLogicalDate = parseJstDateKeyToDate(profile.target_anchor_logical_date);
  const isFirstCycleToday = isWithinFirstCycle({
    anchorLogicalDate,
    referenceDate: logicalToday,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });
  const confirmedSpendResult = await calculateConfirmedNormalSpendBeforeToday({
    supabase: params.supabase,
    profile,
    logicalToday,
    cycleStartDate: refreshedCycleWindow.cycleStartDate,
    isFirstCycle: isFirstCycleToday,
    anchorLogicalDate,
  });
  const monthlySavingsQuota = calculateMonthlySavingsQuota({
    targetAmount: profile.target_amount,
    currentTotalSavings: profile.current_total_savings,
    targetDate: new Date(`${profile.target_date}T00:00:00+09:00`),
    referenceDate: logicalToday,
  });
  const baseCycleBudget = calculateBaseCycleBudget({
    monthlyIncome: profile.monthly_income,
    fixedCosts: profile.fixed_costs,
    estimatedElectricity: profile.estimated_electricity,
    estimatedGas: profile.estimated_gas,
    estimatedWater: profile.estimated_water,
    monthlySavingsQuota,
  });
  const remainingCycleBudget = calculateNextRemainingCycleBudget({
    isFirstCycle: isFirstCycleToday,
    initialBudget: profile.initial_budget,
    baseCycleBudget,
    confirmedNormalSpentBeforeToday: confirmedSpendResult,
  });

  return {
    profile,
    logicalToday,
    logicalTodayString,
    nextPayday: refreshedCycleWindow.nextPaydayDate,
    remainingCycleBudget,
    isFirstCycle: isFirstCycleToday,
  };
}
