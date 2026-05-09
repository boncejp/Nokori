import { NextResponse } from "next/server";

import {
  calculateBaseCycleBudget,
  calculateMonthlySavingsQuota,
  calculateTargetDateFromDuration,
  getLogicalDate,
  isWithinFirstCycle,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { validateOnboardingPayload } from "@/lib/logic/onboarding-validation";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { upsertOwnProfile } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
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

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    return NextResponse.json(
      { errorMessage: "プロフィールが見つかりません。オンボーディングを完了してください。" },
      { status: 400 },
    );
  }
  const anchorLogicalDateKey =
    profileResult.data.target_anchor_logical_date ??
    toJstDateString(getLogicalDate(new Date(profileResult.data.created_at)));
  const anchorLogicalDate = new Date(`${anchorLogicalDateKey}T00:00:00+09:00`);
  const logicalNow = getLogicalDate(new Date());
  const recalculatedTargetDate = calculateTargetDateFromDuration({
    anchorLogicalDate,
    durationMonths: validationResult.data.target_duration_months,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  const firstCycle = isWithinFirstCycle({
    onboardingCompletedAt: new Date(profileResult.data.created_at),
    referenceDate: logicalNow,
    payday: validationResult.data.payday,
    paydayRule: validationResult.data.payday_rule,
  });
  const monthlySavingsQuota = calculateMonthlySavingsQuota({
    targetAmount: validationResult.data.target_amount,
    currentTotalSavings: validationResult.data.current_total_savings,
    targetDate: recalculatedTargetDate,
    referenceDate: logicalNow,
  });
  const recalculatedBaseCycleBudget = calculateBaseCycleBudget({
    monthlyIncome: validationResult.data.monthly_income,
    fixedCosts: validationResult.data.fixed_costs,
    estimatedElectricity: validationResult.data.estimated_electricity,
    estimatedGas: validationResult.data.estimated_gas,
    estimatedWater: validationResult.data.estimated_water,
    monthlySavingsQuota,
  });

  const profileColumns = {
    target_amount: validationResult.data.target_amount,
    target_duration_months: validationResult.data.target_duration_months,
    current_total_savings: validationResult.data.current_total_savings,
    monthly_income: validationResult.data.monthly_income,
    payday: validationResult.data.payday,
    payday_rule: validationResult.data.payday_rule,
    fixed_costs: validationResult.data.fixed_costs,
    estimated_electricity: validationResult.data.estimated_electricity,
    estimated_gas: validationResult.data.estimated_gas,
    estimated_water: validationResult.data.estimated_water,
    surplus_mode: validationResult.data.surplus_mode,
    initial_budget: firstCycle ? recalculatedBaseCycleBudget : validationResult.data.initial_budget,
  };

  const updateResult = await upsertOwnProfile(supabase, {
    id: user.id,
    ...profileColumns,
    target_date: toJstDateString(recalculatedTargetDate),
    target_anchor_logical_date: anchorLogicalDateKey,
  });
  if (!updateResult.success) {
    console.error("[api/profile] profile upsert failed", {
      userId: user.id,
      message: updateResult.error.message,
    });
    return NextResponse.json(
      { errorMessage: "プロフィールの更新に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    profile: updateResult.data,
  });
}
