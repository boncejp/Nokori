import { NextResponse } from "next/server";

import {
  calculateBaseCycleBudget,
  calculateCycleWindow,
  calculateMonthlySavingsQuota,
  getLogicalDate,
  isWithinFirstCycle,
  parseJstDateKeyToDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { fetchProfileByUserId, updateOwnProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SalaryCyclePayload = {
  readonly monthlyIncome: number;
  readonly cycleStartLogicalDate: string;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errorMessage: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function validateSalaryCyclePayload(payload: unknown): ValidationResult<SalaryCyclePayload> {
  if (typeof payload !== "object" || payload === null) {
    return { success: false, errorMessage: "送信データの形式が不正です。" };
  }
  const record = payload as Record<string, unknown>;

  if (typeof record.monthlyIncome !== "number" || !Number.isFinite(record.monthlyIncome)) {
    return { success: false, errorMessage: "手取り給料を数値で入力してください。" };
  }
  const monthlyIncome = Math.floor(record.monthlyIncome);
  if (monthlyIncome < 1) {
    return { success: false, errorMessage: "手取り給料は1円以上で入力してください。" };
  }

  const rawCycle = record.cycleStartLogicalDate;
  if (typeof rawCycle !== "string" || !DATE_KEY.test(rawCycle)) {
    return { success: false, errorMessage: "サイクル開始日の形式が不正です。" };
  }

  return { success: true, data: { monthlyIncome, cycleStartLogicalDate: rawCycle } };
}

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
  const validationResult = validateSalaryCyclePayload(rawBody);
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

  const profile = profileResult.data;
  const logicalNow = getLogicalDate(new Date());
  const logicalTodayKey = toJstDateString(logicalNow);

  const cycleWindow = calculateCycleWindow({
    referenceDate: logicalNow,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });
  const expectedCycleStartKey = toJstDateString(cycleWindow.cycleStartDate);

  if (logicalTodayKey !== expectedCycleStartKey) {
    return NextResponse.json({ errorMessage: "今日は給料サイクル開始日ではありません。" }, { status: 400 });
  }

  if (validationResult.data.cycleStartLogicalDate !== expectedCycleStartKey) {
    return NextResponse.json({ errorMessage: "サイクル開始日が一致しません。画面を再読み込みしてください。" }, { status: 400 });
  }

  const targetDate = new Date(`${profile.target_date}T00:00:00+09:00`);
  const quotaParams = {
    targetAmount: profile.target_amount,
    currentTotalSavings: profile.current_total_savings,
    targetDate,
    referenceDate: logicalNow,
  };

  const monthlySavingsQuota = calculateMonthlySavingsQuota(quotaParams);
  const oldBase = calculateBaseCycleBudget({
    monthlyIncome: profile.monthly_income,
    fixedCosts: profile.fixed_costs,
    estimatedElectricity: profile.estimated_electricity,
    estimatedGas: profile.estimated_gas,
    estimatedWater: profile.estimated_water,
    monthlySavingsQuota,
  });
  const newBase = calculateBaseCycleBudget({
    monthlyIncome: validationResult.data.monthlyIncome,
    fixedCosts: profile.fixed_costs,
    estimatedElectricity: profile.estimated_electricity,
    estimatedGas: profile.estimated_gas,
    estimatedWater: profile.estimated_water,
    monthlySavingsQuota,
  });
  const deltaBase = newBase - oldBase;

  const firstCycle = isWithinFirstCycle({
    anchorLogicalDate: parseJstDateKeyToDate(profile.target_anchor_logical_date),
    referenceDate: logicalNow,
    payday: profile.payday,
    paydayRule: profile.payday_rule,
  });

  const updateResult = await updateOwnProfileByUserId(supabase, user.id, {
    monthly_income: validationResult.data.monthlyIncome,
    last_salary_cycle_logical_date: validationResult.data.cycleStartLogicalDate,
    ...(firstCycle ? {} : { initial_budget: profile.initial_budget + deltaBase }),
  });

  if (!updateResult.success) {
    return NextResponse.json(
      { errorMessage: "保存に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, profile: updateResult.data });
}
