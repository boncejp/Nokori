import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/features/DashboardClient";
import { calculateDaysUntilNextPayday, calculateNextPayday, getLogicalDate } from "@/lib/logic/budget-logic";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { listTransactionsByLogicalDate } from "@/lib/supabase/transactions";

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
  const profile = profileResult.data;

  const logicalToday = getLogicalDate(new Date());
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
  const transactionsResult = await listTransactionsByLogicalDate(supabase, logicalToday);
  const transactions = transactionsResult.success ? transactionsResult.data : [];
  const initialTransactionsErrorMessage = transactionsResult.success
    ? null
    : "当日の支出データ取得に失敗しました。表示内容が最新ではない可能性があります。";

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
        initialState={{
          remainingCycleBudget: profile.initial_budget,
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
