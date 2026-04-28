import { redirect } from "next/navigation";
import Link from "next/link";
import { toZonedTime } from "date-fns-tz";

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
          logicalToday: logicalTodayString,
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

function toJstDateString(date: Date): string {
  const jstDate = toZonedTime(date, "Asia/Tokyo");
  const year = String(jstDate.getFullYear());
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
