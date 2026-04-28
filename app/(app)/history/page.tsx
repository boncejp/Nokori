import { redirect } from "next/navigation";
import { toZonedTime } from "date-fns-tz";

import { HistoryClient } from "@/components/features/HistoryClient";
import { calculateDaysUntilNextPayday, calculateNextPayday, getLogicalDate } from "@/lib/logic/budget-logic";
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
  const profile = profileResult.data;

  const logicalToday = getLogicalDate(new Date());
  const logicalTodayString = toJstDateString(logicalToday);
  const nextPayday = calculateNextPayday({
    fromDate: logicalToday,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });
  const daysUntilNextPaydayIncludingToday = calculateDaysUntilNextPayday({
    fromDate: logicalToday,
    nextPayday,
    includeToday: true,
  });
  const daysUntilNextPaydayExcludingToday = calculateDaysUntilNextPayday({
    fromDate: logicalToday,
    nextPayday,
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
          remainingCycleBudget: profile.initial_budget,
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

function toJstDateString(date: Date): string {
  const jstDate = toZonedTime(date, "Asia/Tokyo");
  const year = String(jstDate.getFullYear());
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
