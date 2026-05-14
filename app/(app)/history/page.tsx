import Link from "next/link";
import { redirect } from "next/navigation";

import { HistoryClient } from "@/components/features/HistoryClient";
import {
  calculateDaysUntilNextPayday,
  getHistoryListingLogicalDateRange,
  parseJstDateKeyToDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { resolveDashboardCycle } from "@/lib/supabase/dashboard-cycle-resolve";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTransactionsByLogicalDate, listTransactionsByLogicalDateRange } from "@/lib/supabase/transactions";

function formatJapaneseLogicalDateLabel(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) {
    return dateKey;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateKey;
  }
  return `${year}年${month}月${day}日`;
}

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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 text-nokori-text">
        <section
          role="alert"
          data-testid="history-cycle-error"
          className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-6 text-red-900"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-red-950">履歴</h1>
          <p className="text-base font-semibold">{cycleResolution.errorMessage}</p>
          <p className="text-sm text-red-800">
            ページを再読み込みしても解消しない場合は、しばらく時間をおいてからお試しください。
            数値の整合性を保つため、履歴の集計表示は省略しています。
          </p>
        </section>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-navy shadow-sm transition hover:bg-nokori-subtle"
          >
            ダッシュボードへ戻る
          </Link>
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-navy shadow-sm transition hover:bg-nokori-subtle"
          >
            設定を開く
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
  const historyLogicalRange = getHistoryListingLogicalDateRange({
    logicalToday,
    anchorLogicalDate: parseJstDateKeyToDate(profile.target_anchor_logical_date),
    payday: profile.payday,
    paydayRule: profile.payday_rule,
    isFirstCycle: resolvedCycle.isFirstCycle,
  });
  const cycleTransactionsResult = await listTransactionsByLogicalDateRange(supabase, {
    fromLogicalDate: historyLogicalRange.from,
    toLogicalDate: historyLogicalRange.to,
  });

  const dashboardTransactions = todayTransactionsResult.success ? todayTransactionsResult.data : [];
  const cycleTransactions = cycleTransactionsResult.success ? cycleTransactionsResult.data : [];
  const initialHistoryErrorMessage = cycleTransactionsResult.success
    ? null
    : "このサイクルの支出一覧を読み込めませんでした。画面を再読み込みするか、しばらく時間をおいてから再度お試しください。";

  const rangeFromKey = toJstDateString(historyLogicalRange.from);
  const rangeToKey = toJstDateString(historyLogicalRange.to);
  const cycleListingDescription = resolvedCycle.isFirstCycle
    ? `この一覧は、論理日「${formatJapaneseLogicalDateLabel(rangeFromKey)}」から「${formatJapaneseLogicalDateLabel(rangeToKey)}」まで（初回サイクル）に計上された支出です。次の給料日を迎えると通常サイクルに切り替わり、集計の始まりは給料日（論理日）になります。表示する日付は論理日で、日本時間では毎日午前3:00を境に前日と当日が切り替わります（午前0:00〜2:59に登録した支出は、まだ前日の内訳として集計されます）。`
    : `この一覧は、今回のサイクル（論理日「${formatJapaneseLogicalDateLabel(rangeFromKey)}」（給料日）から「${formatJapaneseLogicalDateLabel(rangeToKey)}」（次の給料日の前日）まで）の支出です。表示する日付は論理日で、日本時間では毎日午前3:00を境に前日と当日が切り替わります（午前0:00〜2:59は前日扱い）。`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 text-nokori-text">
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
        cycleTransactions={cycleTransactions.map((transaction) => ({ ...transaction, isOptimistic: false }))}
        cycleListingDescription={cycleListingDescription}
        initialHistoryErrorMessage={initialHistoryErrorMessage}
      />
    </main>
  );
}
