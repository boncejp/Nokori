import Link from "next/link";
import { redirect } from "next/navigation";

import { HistoryClient } from "@/components/features/HistoryClient";
import { calculateDaysUntilNextPayday } from "@/lib/logic/budget-logic";
import { resolveDashboardCycle } from "@/lib/supabase/dashboard-cycle-resolve";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTransactionsByLogicalDate, listTransactionsByLogicalMonth } from "@/lib/supabase/transactions";

export default async function HistoryPage() {
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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <section
          role="alert"
          data-testid="history-cycle-error"
          className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-6 text-red-900"
        >
          <h1 className="text-2xl font-semibold text-red-950">History</h1>
          <p className="text-base font-semibold">{cycleResolution.errorMessage}</p>
          <p className="text-sm text-red-800">
            ページを再読み込みしても解消しない場合は、しばらく時間をおいてからお試しください。
            数値の整合性を保つため、履歴の集計表示は省略しています。
          </p>
        </section>
        <div className="flex gap-2">
          <Link href="/dashboard" className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
            Dashboardへ戻る
          </Link>
          <Link href="/settings" className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
            Settings
          </Link>
        </div>
      </main>
    );
  }

  const resolvedCycle = cycleResolution.data;
  const profile = resolvedCycle.profile;
  const logicalToday = resolvedCycle.logicalToday;
  const logicalTodayString = resolvedCycle.logicalTodayString;

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

  const todayTransactionsResult = await listTransactionsByLogicalDate(supabase, logicalToday);
  const monthTransactionsResult = await listTransactionsByLogicalMonth(supabase, logicalToday);

  const dashboardTransactions = todayTransactionsResult.success ? todayTransactionsResult.data : [];
  const monthlyTransactions = monthTransactionsResult.success ? monthTransactionsResult.data : [];
  const initialHistoryErrorMessage = monthTransactionsResult.success
    ? null
    : "履歴の取得に失敗しました。表示内容が最新ではない可能性があります。";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <HistoryClient
        dashboardHydration={{
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
          transactions: dashboardTransactions.map((transaction) => ({
            ...transaction,
            isOptimistic: false,
          })),
        }}
        monthlyTransactions={monthlyTransactions.map((transaction) => ({ ...transaction, isOptimistic: false }))}
        initialHistoryErrorMessage={initialHistoryErrorMessage}
      />
    </main>
  );
}
