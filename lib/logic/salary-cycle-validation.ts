/**
 * 給料日モーダル POST（/api/profile/salary-cycle）のリクエスト検証。
 */

import { isLogicalDateKey, isRecord } from "@/lib/types/object-parsing";
import type { ValidationResult } from "@/lib/types/result";

export type SalaryCyclePayload = {
  readonly monthlyIncome: number;
  readonly cycleStartLogicalDate: string;
};

export function validateSalaryCyclePayload(payload: unknown): ValidationResult<SalaryCyclePayload> {
  if (!isRecord(payload)) {
    return { success: false, errorMessage: "送信データの形式が不正です。" };
  }

  if (typeof payload.monthlyIncome !== "number" || !Number.isFinite(payload.monthlyIncome)) {
    return { success: false, errorMessage: "手取り額を数値で入力してください。" };
  }
  const monthlyIncome = Math.floor(payload.monthlyIncome);
  if (monthlyIncome < 1) {
    return { success: false, errorMessage: "手取り額は1円以上で入力してください。" };
  }

  if (!isLogicalDateKey(payload.cycleStartLogicalDate)) {
    return { success: false, errorMessage: "サイクル開始日の形式が不正です。" };
  }

  return {
    success: true,
    data: { monthlyIncome, cycleStartLogicalDate: payload.cycleStartLogicalDate },
  };
}
