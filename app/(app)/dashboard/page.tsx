import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardClient } from "@/components/features/DashboardClient";
import { calculateDashboardCycleMetrics } from "@/lib/logic/dashboard-cycle-metrics";
import {
  calculateCycleWindow,
  calculateFirstCycleDailyProrationDayCounts,
  calculateNormalCycleDailyProrationDayCounts,
  parseJstDateKeyToDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { resolvePostAuthLandingPath } from "@/lib/routing/post-auth-landing";
import { resolveDashboardCycle } from "@/lib/supabase/dashboard-cycle-resolve";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { listTransactionsByLogicalDate } from "@/lib/supabase/transactions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

type Profile = Tables<"profiles">;

async function logoutAction() {
  "use server";
  const actionSupabase = await createSupabaseServerClient();
  await actionSupabase.auth.signOut();
  redirect("/login");
}

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
    redirect(await resolvePostAuthLandingPath(supabase, user.id));
  }

  const cycleResolution = await resolveDashboardCycle({
    supabase,
    userId: user.id,
    profile: profileResult.data,
  });

  if (!cycleResolution.success) {
    return (
      <DashboardErrorLayout errorMessage={cycleResolution.errorMessage}>
        <DashboardNavigationLinks />
      </DashboardErrorLayout>
    );
  }

  const resolvedCycle = cycleResolution.data;
  const profile: Profile = resolvedCycle.profile;
  const logicalTodayString = resolvedCycle.logicalTodayString;
  const logicalToday = resolvedCycle.logicalToday;

  const anchorLogicalDate = parseJstDateKeyToDate(profile.target_anchor_logical_date);
  const prorationDayCounts = resolvedCycle.isFirstCycle
    ? calculateFirstCycleDailyProrationDayCounts({
        logicalToday,
        anchorLogicalDate,
        payday: profile.payday,
        paydayRule: profile.payday_rule,
      })
    : calculateNormalCycleDailyProrationDayCounts({
        logicalToday,
        nextPaydayDate: resolvedCycle.nextPayday,
      });
  const daysUntilNextPaydayIncludingToday = prorationDayCounts.daysIncludingToday;
  const daysUntilNextPaydayExcludingToday = prorationDayCounts.daysExcludingToday;
  const transactionsResult = await listTransactionsByLogicalDate(supabase, logicalToday);
  const transactions = transactionsResult.success ? transactionsResult.data : [];
  const initialTransactionsErrorMessage = transactionsResult.success
    ? null
    : "当日の支出一覧を読み込めませんでした。画面を再読み込みするか、しばらく時間をおいてから再度お試しください。";

  const dashboardTransactions = transactions.map((transaction) => ({ ...transaction, isOptimistic: false }));
  const initialMetrics = calculateDashboardCycleMetrics({
    remainingCycleBudget: resolvedCycle.remainingCycleBudget,
    daysUntilNextPaydayIncludingToday,
    daysUntilNextPaydayExcludingToday,
    utilityEstimates: {
      ELECTRICITY: profile.estimated_electricity,
      GAS: profile.estimated_gas,
      WATER: profile.estimated_water,
    },
    transactions: dashboardTransactions,
    isFirstCycle: resolvedCycle.isFirstCycle,
  });

  const paydayPromptCycleWindow = calculateCycleWindow({
    referenceDate: logicalToday,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });
  const paydayCycleStartKey = toJstDateString(paydayPromptCycleWindow.cycleStartDate);
  const isLogicalCycleStartPayday = logicalTodayString === paydayCycleStartKey;
  const salaryPrompt =
    isLogicalCycleStartPayday && profile.last_salary_cycle_logical_date !== paydayCycleStartKey
      ? {
          cycleStartLogicalDate: paydayCycleStartKey,
          currentMonthlyIncome: profile.monthly_income,
        }
      : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 text-nokori-text">
      <DashboardClient
        salaryPrompt={salaryPrompt}
        initialIsOverBudget={initialMetrics.isOverBudget}
        initialState={{
          logicalToday: logicalTodayString,
          anchorLogicalDate: profile.target_anchor_logical_date,
          isFirstCycle: resolvedCycle.isFirstCycle,
          remainingCycleBudget: resolvedCycle.remainingCycleBudget,
          daysUntilNextPaydayIncludingToday,
          daysUntilNextPaydayExcludingToday,
          utilityEstimates: {
            ELECTRICITY: profile.estimated_electricity,
            GAS: profile.estimated_gas,
            WATER: profile.estimated_water,
          },
          transactions: dashboardTransactions,
          initialTransactionsErrorMessage,
        }}
        topSlot={<h1 className="text-2xl font-semibold tracking-tight text-nokori-navy">ダッシュボード</h1>}
        bottomSlot={<DashboardNavigationLinks />}
      />
    </main>
  );
}

type DashboardErrorLayoutProps = {
  readonly errorMessage: string;
  readonly children: React.ReactNode;
};

function DashboardErrorLayout({ errorMessage, children }: DashboardErrorLayoutProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 text-nokori-text">
      <h1 className="text-2xl font-semibold tracking-tight text-nokori-navy">ダッシュボード</h1>
      <section
        role="alert"
        data-testid="dashboard-cycle-error"
        className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-6 text-red-900"
      >
        <p className="text-base font-semibold">{errorMessage}</p>
        <p className="text-sm text-red-800">
          ページを再読み込みしても解消しない場合は、しばらく時間をおいてからお試しください。
          数値の整合性を保つため、今回の予算サマリーは表示していません。
        </p>
      </section>
      {children}
    </main>
  );
}

function DashboardNavigationLinks() {
  return (
    <>
      <Link
        href="/history"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-navy shadow-sm transition hover:bg-nokori-subtle sm:w-auto"
      >
        履歴を見る
      </Link>
      <Link
        href="/settings"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-navy shadow-sm transition hover:bg-nokori-subtle sm:w-auto"
      >
        設定を開く
      </Link>
      <form action={logoutAction} className="sm:ml-auto">
        <button
          type="submit"
          className="min-h-11 w-full rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-muted transition hover:bg-nokori-subtle sm:w-auto"
        >
          ログアウト
        </button>
      </form>
    </>
  );
}
