import { NextResponse } from "next/server";

import {
  calculateCycleWindow,
  calculateTargetDateFromDuration,
  getLogicalDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { validateOnboardingPayload } from "@/lib/logic/onboarding-validation";
import { upsertOwnProfile } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { errorMessage: "ログインが必要です。再度ログインしてください。" },
      { status: 401 },
    );
  }

  const rawBody: unknown = await request.json();
  const validationResult = validateOnboardingPayload(rawBody);
  if (!validationResult.success) {
    return NextResponse.json({ errorMessage: validationResult.errorMessage }, { status: 400 });
  }

  const logicalNow = getLogicalDate(new Date());
  const targetDate = calculateTargetDateFromDuration({
    anchorLogicalDate: logicalNow,
    durationMonths: validationResult.data.target_duration_months,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  const cycleWindow = calculateCycleWindow({
    referenceDate: logicalNow,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  const cycleStartKey = toJstDateString(cycleWindow.cycleStartDate);
  const logicalTodayKey = toJstDateString(logicalNow);
  const targetDateKey = toJstDateString(targetDate);
  const lastSalaryCycleLogicalDate = logicalTodayKey === cycleStartKey ? cycleStartKey : null;
  const initialTotalAssets = validationResult.data.initial_total_assets;
  const initialBudget = validationResult.data.initial_budget;
  const currentTotalSavingsFromOnboarding = initialTotalAssets - initialBudget;

  const profileColumns = {
    target_amount: validationResult.data.target_amount,
    target_duration_months: validationResult.data.target_duration_months,
    initial_total_assets: initialTotalAssets,
    current_total_savings: currentTotalSavingsFromOnboarding,
    monthly_income: validationResult.data.monthly_income,
    payday: validationResult.data.payday,
    payday_rule: validationResult.data.payday_rule,
    fixed_costs: validationResult.data.fixed_costs,
    estimated_electricity: validationResult.data.estimated_electricity,
    estimated_gas: validationResult.data.estimated_gas,
    estimated_water: validationResult.data.estimated_water,
    surplus_mode: validationResult.data.surplus_mode,
    initial_budget: initialBudget,
  };

  const upsertResult = await upsertOwnProfile(supabase, {
    id: user.id,
    ...profileColumns,
    target_date: targetDateKey,
    target_anchor_logical_date: logicalTodayKey,
    last_salary_cycle_logical_date: lastSalaryCycleLogicalDate,
  });

  if (!upsertResult.success) {
    console.error("[api/onboarding] profile upsert failed", {
      userId: user.id,
      message: upsertResult.error.message,
    });
    return NextResponse.json(
      { errorMessage: "設定の保存に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
