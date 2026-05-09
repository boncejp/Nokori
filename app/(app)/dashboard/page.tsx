import { redirect } from "next/navigation";
import Link from "next/link";
import { subDays } from "date-fns";

import { DashboardClient } from "@/components/features/DashboardClient";
import {
  calculateBaseCycleBudget,
  calculateCycleWindow,
  calculateDaysUntilNextPayday,
  calculateMonthlySavingsQuota,
  calculateNextRemainingCycleBudget,
  getLogicalDate,
  isWithinFirstCycle,
  processMonthlyReset,
  shouldExecuteMonthlyReset,
  toJstDateString,
  type UtilityType,
} from "@/lib/logic/budget-logic";
import {
  applyMonthlyResetForLogicalDate,
  fetchProfileByUserId,
} from "@/lib/supabase/profiles";
import {
  listTransactionsByLogicalDate,
  listTransactionsByLogicalDateRange,
} from "@/lib/supabase/transactions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

type Profile = Tables<"profiles">;
type Transaction = Tables<"transactions">;

type ResolvedDashboardCycle = {
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly logicalTodayString: string;
  readonly nextPayday: Date;
  readonly remainingCycleBudget: number;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    redirect("/onboarding");
  }

  const resolvedCycle = await resolveDashboardCycle({
    supabase,
    userId: user.id,
    profile: profileResult.data,
  });
  const daysUntilNextPaydayIncludingToday = calculateDaysUntilNextPayday({
    fromDate: resolvedCycle.logicalToday,
    nextPayday: resolvedCycle.nextPayday,
    includeToday: true,
  });
  const daysUntilNextPaydayExcludingToday = calculateDaysUntilNextPayday({
    fromDate: resolvedCycle.logicalToday,
    nextPayday: resolvedCycle.nextPayday,
    includeToday: false,
  });
  const transactionsResult = await listTransactionsByLogicalDate(supabase, resolvedCycle.logicalToday);
  const transactions = transactionsResult.success ? transactionsResult.data : [];
  const initialTransactionsErrorMessage = transactionsResult.success
    ? null
    : "当日の支出データ取得に失敗しました。表示内容が最新ではない可能性があります。";

  const paydayPromptCycleWindow = calculateCycleWindow({
    referenceDate: resolvedCycle.logicalToday,
    payday: resolvedCycle.profile.payday,
    paydayRule: resolvedCycle.profile.payday_rule,
  });
  const paydayCycleStartKey = toJstDateString(paydayPromptCycleWindow.cycleStartDate);
  const isLogicalCycleStartPayday = resolvedCycle.logicalTodayString === paydayCycleStartKey;
  const salaryPrompt =
    isLogicalCycleStartPayday && resolvedCycle.profile.last_salary_cycle_logical_date !== paydayCycleStartKey
      ? {
          cycleStartLogicalDate: paydayCycleStartKey,
          currentMonthlyIncome: resolvedCycle.profile.monthly_income,
        }
      : null;

  async function logoutAction() {
    "use server";
    const actionSupabase = await createSupabaseServerClient();
    await actionSupabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardClient
        salaryPrompt={salaryPrompt}
        initialState={{
          logicalToday: resolvedCycle.logicalTodayString,
          remainingCycleBudget: resolvedCycle.remainingCycleBudget,
          daysUntilNextPaydayIncludingToday,
          daysUntilNextPaydayExcludingToday,
          utilityEstimates: {
            ELECTRICITY: resolvedCycle.profile.estimated_electricity,
            GAS: resolvedCycle.profile.estimated_gas,
            WATER: resolvedCycle.profile.estimated_water,
          },
          transactions: transactions.map((transaction) => ({ ...transaction, isOptimistic: false })),
          initialTransactionsErrorMessage,
        }}
      />
      <Link
        href="/history"
        className="inline-flex w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
      >
        履歴を見る
      </Link>
      <Link
        href="/settings"
        className="inline-flex w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
      >
        設定を開く
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
        >
          ログアウト
        </button>
      </form>
    </main>
  );
}

async function resolveDashboardCycle(params: {
  readonly supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
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
  const confirmedSpendResult = await calculateConfirmedNormalSpendBeforeToday({
    supabase: params.supabase,
    profile,
    logicalToday,
    cycleStartDate: refreshedCycleWindow.cycleStartDate,
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
    isFirstCycle: isWithinFirstCycle({
      onboardingCompletedAt: new Date(profile.created_at),
      referenceDate: logicalToday,
      payday: profile.payday,
      paydayRule: profile.payday_rule,
    }),
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
  };
}

async function executeMonthlyReset(params: {
  readonly supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  readonly userId: string;
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly logicalTodayString: string;
}): Promise<{ success: true; data: Profile } | { success: false }> {
  const previousCycleEndDate = subDays(params.logicalToday, 1);
  const previousCycleStartDate = calculateCycleWindow({
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

  const previousCycleConfirmedSpend = calculateConfirmedNormalSpent(previousCycleTransactionsResult.data, {
    ELECTRICITY: params.profile.estimated_electricity,
    GAS: params.profile.estimated_gas,
    WATER: params.profile.estimated_water,
  });
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
  const surplus = params.profile.initial_budget - previousCycleConfirmedSpend;
  const monthlyResetResult = processMonthlyReset({
    surplusMode: params.profile.surplus_mode,
    currentTotalSavings: params.profile.current_total_savings,
    baseBudget: baseCycleBudget,
    surplus,
  });
  const updatedProfileResult = await applyMonthlyResetForLogicalDate(params.supabase, {
    userId: params.userId,
    logicalDate: params.logicalTodayString,
    nextTotalSavings: monthlyResetResult.nextTotalSavings,
    nextInitialBudget: monthlyResetResult.nextInitialBudget,
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

async function calculateConfirmedNormalSpendBeforeToday(params: {
  readonly supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  readonly profile: Profile;
  readonly logicalToday: Date;
  readonly cycleStartDate: Date;
}): Promise<number> {
  const previousDay = subDays(params.logicalToday, 1);
  const cycleStartString = toJstDateString(params.cycleStartDate);
  const previousDayString = toJstDateString(previousDay);
  if (cycleStartString > previousDayString) {
    return 0;
  }

  const transactionsResult = await listTransactionsByLogicalDateRange(params.supabase, {
    fromLogicalDate: params.cycleStartDate,
    toLogicalDate: previousDay,
  });
  if (!transactionsResult.success) {
    return 0;
  }

  return calculateConfirmedNormalSpent(transactionsResult.data, {
    ELECTRICITY: params.profile.estimated_electricity,
    GAS: params.profile.estimated_gas,
    WATER: params.profile.estimated_water,
  });
}

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

