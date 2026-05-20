import { redirect } from "next/navigation";

import { SettingsClient } from "@/components/features/SettingsClient";
import { addDays } from "date-fns";

import {
  calculateCycleWindow,
  calculateMonthlySavingsQuota,
  calculateYutoriCarryoverDisplay,
  getFirstCycleEndLogicalDate,
  getLogicalDate,
  isWithinFirstCycle,
  parseJstDateKeyToDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { resolvePostAuthLandingPath } from "@/lib/routing/post-auth-landing";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { resolveDashboardCycle } from "@/lib/supabase/dashboard-cycle-resolve";
import { fetchSettingsPreviewSnapshot } from "@/lib/supabase/settings-preview-snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
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

  const profile = cycleResolution.success ? cycleResolution.data.profile : profileResult.data;
  const logicalNow = getLogicalDate(new Date());
  const anchorLogicalDate = parseJstDateKeyToDate(profile.target_anchor_logical_date);
  const isFirstCycle = cycleResolution.success
    ? cycleResolution.data.isFirstCycle
    : isWithinFirstCycle({
        anchorLogicalDate,
        referenceDate: logicalNow,
        payday: profile.payday,
        paydayRule: profile.payday_rule,
      });

  let previewSnapshot = null;
  if (cycleResolution.success) {
    const snapshotResult = await fetchSettingsPreviewSnapshot({
      supabase,
      profile: cycleResolution.data.profile,
      logicalToday: cycleResolution.data.logicalToday,
      isFirstCycle: cycleResolution.data.isFirstCycle,
    });
    if (snapshotResult.success) {
      previewSnapshot = snapshotResult.data;
    }
  }

  const targetYears = Math.floor(profile.target_duration_months / 12);
  const targetMonths = profile.target_duration_months % 12;

  const monthlySavingsQuota = !isFirstCycle
    ? calculateMonthlySavingsQuota({
        targetAmount: profile.target_amount,
        currentTotalSavings: profile.current_total_savings,
        targetDate: new Date(`${profile.target_date}T00:00:00+09:00`),
        referenceDate: logicalNow,
      })
    : null;

  // 「前月からの繰り越し（参考）」は通常サイクル 2 回目以降かつ YUTORI のみ表示する。
  // 初回通常サイクル（最初の給料日〜2回目の給料日前日）では YUTORI でも表示しない。
  const firstNormalCycleStartDate = addDays(
    getFirstCycleEndLogicalDate({
      anchorLogicalDate,
      payday: profile.payday,
      paydayRule: profile.payday_rule,
    }),
    1,
  );
  const currentCycleWindow = calculateCycleWindow({
    referenceDate: logicalNow,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });
  const isSecondOrLaterNormalCycle =
    !isFirstCycle &&
    toJstDateString(currentCycleWindow.cycleStartDate) > toJstDateString(firstNormalCycleStartDate);

  const yutoriCarryoverDisplayYen = isSecondOrLaterNormalCycle
    ? calculateYutoriCarryoverDisplay({
        surplusMode: profile.surplus_mode,
        yutoriCarryover: profile.yutori_carryover,
      })
    : null;

  const logicalTodayKey = previewSnapshot?.logicalTodayKey ?? toJstDateString(logicalNow);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 text-nokori-text">
      <SettingsClient
        initialValues={{
          target_amount: String(profile.target_amount),
          target_years: String(targetYears),
          target_months: String(targetMonths),
          target_date_display: profile.target_date,
          current_total_savings_display: String(profile.current_total_savings),
          monthly_income: String(profile.monthly_income),
          payday: String(profile.payday),
          payday_rule: profile.payday_rule,
          fixed_costs: String(profile.fixed_costs),
          estimated_electricity: String(profile.estimated_electricity),
          estimated_gas: String(profile.estimated_gas),
          estimated_water: String(profile.estimated_water),
          surplus_mode: profile.surplus_mode,
          initial_budget: String(profile.initial_budget),
        }}
        monthlySavingsQuota={monthlySavingsQuota}
        showMonthlySavingsQuota={!isFirstCycle}
        yutoriCarryoverDisplayYen={yutoriCarryoverDisplayYen}
        previewContext={{
          anchorLogicalDateKey: profile.target_anchor_logical_date,
          logicalTodayKey,
          isFirstCycle,
          initialBudgetDb: profile.initial_budget,
          monthlyIncomeDb: profile.monthly_income,
          previewSnapshot,
        }}
      />
    </main>
  );
}
