import type { SupabaseClient } from "@supabase/supabase-js";
import { subDays } from "date-fns";

import {
  calculateBaseCycleBudget,
  calculateCycleWindow,
  calculateConfirmedNormalSpentWithUtilityAdjustment,
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
} from "@/lib/logic/budget-logic";
import { applyMonthlyResetForLogicalDate, fetchProfileByUserId } from "@/lib/supabase/profiles";
import { listTransactionsByLogicalDateRange } from "@/lib/supabase/transactions";
import type { Database, Tables } from "@/lib/types/database";

type Profile = Tables<"profiles">;

type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export type ResolvedDashboardCycle = {
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly logicalTodayString: string;
  readonly nextPayday: Date;
  readonly remainingCycleBudget: number;
  readonly isFirstCycle: boolean;
};

export type DashboardCycleResolutionFailureReason =
  | "MONTHLY_RESET_FAILED"
  | "CONFIRMED_SPEND_FETCH_FAILED";

export type DashboardCycleResolution =
  | { readonly success: true; readonly data: ResolvedDashboardCycle }
  | {
      readonly success: false;
      readonly reason: DashboardCycleResolutionFailureReason;
      readonly errorMessage: string;
    };

const FAILURE_MESSAGE_BY_REASON: Readonly<Record<DashboardCycleResolutionFailureReason, string>> = {
  MONTHLY_RESET_FAILED:
    "データの更新に失敗しました。しばらく待ってから再読み込みしてください。",
  CONFIRMED_SPEND_FETCH_FAILED:
    "支出データの取得に失敗したため、最新の予算を表示できません。時間をおいて再読み込みしてください。",
};

async function calculateConfirmedNormalSpendBeforeToday(params: {
  readonly supabase: SupabaseClient<Database>;
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly cycleStartDate: Date;
  readonly isFirstCycle: boolean;
  readonly anchorLogicalDate: Date;
}): Promise<Result<number>> {
  const previousDay = subDays(params.logicalToday, 1);
  const cycleStartForRange = params.isFirstCycle ? params.anchorLogicalDate : params.cycleStartDate;
  const cycleStartString = toJstDateString(cycleStartForRange);
  const previousDayString = toJstDateString(previousDay);
  if (cycleStartString > previousDayString) {
    return { success: true, data: 0 };
  }

  const transactionsResult = await listTransactionsByLogicalDateRange(params.supabase, {
    fromLogicalDate: cycleStartForRange,
    toLogicalDate: previousDay,
  });
  if (!transactionsResult.success) {
    return { success: false, error: transactionsResult.error };
  }

  if (params.isFirstCycle) {
    return {
      success: true,
      data: sumPlainNormalExpenseAmounts(transactionsResult.data),
    };
  }

  return {
    success: true,
    data: calculateConfirmedNormalSpentWithUtilityAdjustment(transactionsResult.data, {
      ELECTRICITY: params.profile.estimated_electricity,
      GAS: params.profile.estimated_gas,
      WATER: params.profile.estimated_water,
    }),
  };
}

async function executeMonthlyReset(params: {
  readonly supabase: SupabaseClient<Database>;
  readonly userId: string;
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly logicalTodayString: string;
}): Promise<Result<Profile>> {
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
    return { success: false, error: previousCycleTransactionsResult.error };
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
    const previousCycleConfirmedSpend = calculateConfirmedNormalSpentWithUtilityAdjustment(
      previousCycleTransactionsResult.data,
      {
        ELECTRICITY: params.profile.estimated_electricity,
        GAS: params.profile.estimated_gas,
        WATER: params.profile.estimated_water,
      },
    );
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
    return { success: false, error: updatedProfileResult.error };
  }

  if (!updatedProfileResult.data.applied || updatedProfileResult.data.profile === null) {
    const latestProfileResult = await fetchProfileByUserId(params.supabase, params.userId);
    if (!latestProfileResult.success) {
      return { success: false, error: latestProfileResult.error };
    }
    return { success: true, data: latestProfileResult.data };
  }

  return { success: true, data: updatedProfileResult.data.profile };
}

function buildFailure(
  reason: DashboardCycleResolutionFailureReason,
  underlyingError: Error,
): DashboardCycleResolution {
  // 失敗理由はサーバーログに残し、UI には固定の日本語メッセージを返す。
  // ユーザーに技術的な内部メッセージをそのまま見せないため。
  console.error(`[resolveDashboardCycle] ${reason}:`, underlyingError.message);
  return {
    success: false,
    reason,
    errorMessage: FAILURE_MESSAGE_BY_REASON[reason],
  };
}

export async function resolveDashboardCycle(params: {
  readonly supabase: SupabaseClient<Database>;
  readonly userId: string;
  readonly profile: Profile;
}): Promise<DashboardCycleResolution> {
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
    if (!monthlyResetProfileResult.success) {
      // 月次リセットが必要な日にリセットを完遂できない場合、
      // 締め前のプロフィールで「通常どおりの予算」をそのまま表示するとユーザーを誤認させるため、
      // ここで失敗を伝播し、呼び出し元で予算 UI を出さない判断をしてもらう。
      return buildFailure("MONTHLY_RESET_FAILED", monthlyResetProfileResult.error);
    }
    profile = monthlyResetProfileResult.data;
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
  if (!confirmedSpendResult.success) {
    // 累計支出を 0 として続行すると remainingCycleBudget が過大になり、
    // 「あといくら使えるか」を誤って大きく見せてしまう。失敗をそのまま伝播する。
    return buildFailure("CONFIRMED_SPEND_FETCH_FAILED", confirmedSpendResult.error);
  }

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
    surplusMode: profile.surplus_mode,
    initialBudget: profile.initial_budget,
    baseCycleBudget,
    confirmedNormalSpentBeforeToday: confirmedSpendResult.data,
  });

  return {
    success: true,
    data: {
      profile,
      logicalToday,
      logicalTodayString,
      nextPayday: refreshedCycleWindow.nextPaydayDate,
      remainingCycleBudget,
      isFirstCycle: isFirstCycleToday,
    },
  };
}
