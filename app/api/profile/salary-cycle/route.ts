import { NextResponse } from "next/server";

import {
  calculateCycleWindow,
  getLogicalDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { validateSalaryCyclePayload } from "@/lib/logic/salary-cycle-validation";
import { fetchProfileByUserId, updateOwnProfileByUserId } from "@/lib/supabase/profiles";
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
    return NextResponse.json(
      { errorMessage: "サイクル開始日が一致しません。画面を再読み込みしてください。" },
      { status: 400 },
    );
  }

  const updateResult = await updateOwnProfileByUserId(supabase, user.id, {
    monthly_income: validationResult.data.monthlyIncome,
    last_salary_cycle_logical_date: validationResult.data.cycleStartLogicalDate,
  });

  if (!updateResult.success) {
    return NextResponse.json(
      { errorMessage: "保存に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, profile: updateResult.data });
}
