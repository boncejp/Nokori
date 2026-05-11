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

  const resolvedCycle = await resolveDashboardCycle({
    supabase,
    userId: user.id,
    profile: profileResult.data,
  });
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
