import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardClient } from "@/components/features/DashboardClient";
import {
  calculateCycleWindow,
  calculateDaysUntilNextPayday,
  toJstDateString,
} from "@/lib/logic/budget-logic";
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
    redirect("/onboarding");
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

  const daysUntilNextPaydayIncludingToday = calculateDaysUntilNextPayday({
    fromDate: logicalToday,
    nextPayday: resolvedCycle.nextPayday,
    includeToday: true,
  });
  const daysUntilNextPaydayExcludingToday = calculateDaysUntilNextPayday({
    fromDate: logicalToday,
    nextPayday: resolvedCycle.nextPayday,
    includeToday: false,
  });
  const transactionsResult = await listTransactionsByLogicalDate(supabase, logicalToday);
  const transactions = transactionsResult.success ? transactionsResult.data : [];
  const initialTransactionsErrorMessage = transactionsResult.success
    ? null
    : "当日の支出データ取得に失敗しました。表示内容が最新ではない可能性があります。";

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardClient
        salaryPrompt={salaryPrompt}
        initialState={{
          logicalToday: logicalTodayString,
          isFirstCycle: resolvedCycle.isFirstCycle,
          remainingCycleBudget: resolvedCycle.remainingCycleBudget,
          daysUntilNextPaydayIncludingToday,
          daysUntilNextPaydayExcludingToday,
          utilityEstimates: {
            ELECTRICITY: profile.estimated_electricity,
            GAS: profile.estimated_gas,
            WATER: profile.estimated_water,
          },
          transactions: transactions.map((transaction) => ({ ...transaction, isOptimistic: false })),
          initialTransactionsErrorMessage,
        }}
      />
      <DashboardNavigationLinks />
    </main>
  );
}

type DashboardErrorLayoutProps = {
  readonly errorMessage: string;
  readonly children: React.ReactNode;
};

function DashboardErrorLayout({ errorMessage, children }: DashboardErrorLayoutProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
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
    </>
  );
}
