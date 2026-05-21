/**
 * ダッシュボードのクライアント状態（Zustand）。
 *
 * - サーバーが算出した `remainingCycleBudget` 等を hydrate する
 * - 支出の楽観的追加・ロールバック・削除後のメトリクス再計算
 * - 表示用の数値は `calculateDashboardCycleMetrics`（純粋関数）に委譲
 */
"use client";

import { create } from "zustand";

import { getErrorMessageFromResponseBody } from "@/lib/logic/api-response-parsing";
import { calculateDashboardCycleMetrics } from "@/lib/logic/dashboard-cycle-metrics";
import {
  calculateCycleWindow,
  calculateFirstCycleDailyProrationDayCounts,
  calculateNormalCycleDailyProrationDayCounts,
  parseJstDateKeyToDate,
} from "@/lib/logic/budget-logic";
import { isRecord } from "@/lib/types/object-parsing";
import type { UtilityEstimateMap, UtilityType } from "@/lib/types/domain";

import {
  isDashboardTransaction,
  resolveLogicalTodayDate,
  type DashboardTransaction,
} from "./dashboard-transaction-parsing";

export type { DashboardTransaction } from "./dashboard-transaction-parsing";

type TransactionKind = "NORMAL" | "SPECIAL" | "UTILITY";

type SubmitTransactionInput = {
  readonly amount: number;
  readonly memo: string | null;
  readonly kind: TransactionKind;
  readonly utilityType: UtilityType | null;
};

type SubmitTransactionResult =
  | { success: true }
  | { success: false; errorMessage: string };

type DashboardHydration = {
  readonly logicalToday: string;
  readonly anchorLogicalDate: string;
  readonly isFirstCycle: boolean;
  readonly remainingCycleBudget: number;
  readonly daysUntilNextPaydayIncludingToday: number;
  readonly daysUntilNextPaydayExcludingToday: number;
  readonly utilityEstimates: UtilityEstimateMap;
  readonly transactions: readonly DashboardTransaction[];
};

type DashboardComputedMetrics = {
  readonly dailyBudgetToday: number;
  readonly remainingToday: number;
  readonly futureDailyBudget: number;
  readonly todaySpentTotal: number;
  readonly todayNormalSpent: number;
  readonly utilityDeltaTotal: number;
  readonly isOverBudget: boolean;
};

type DashboardStoreState = {
  readonly logicalToday: string;
  readonly anchorLogicalDate: string;
  readonly isFirstCycle: boolean;
  readonly remainingCycleBudget: number;
  readonly daysUntilNextPaydayIncludingToday: number;
  readonly daysUntilNextPaydayExcludingToday: number;
  readonly utilityEstimates: UtilityEstimateMap;
  readonly transactions: readonly DashboardTransaction[];
  readonly dailyBudgetToday: number;
  readonly remainingToday: number;
  readonly futureDailyBudget: number;
  readonly todaySpentTotal: number;
  readonly todayNormalSpent: number;
  readonly utilityDeltaTotal: number;
  readonly isOverBudget: boolean;
  readonly isSubmitting: boolean;
  readonly submitErrorMessage: string;
  hydrate: (payload: DashboardHydration) => void;
  applyProfileSettings: (payload: {
    readonly remainingCycleBudget: number;
    readonly payday: number;
    readonly paydayRule: "BEFORE" | "AFTER" | "FIXED";
    readonly utilityEstimates: UtilityEstimateMap;
  }) => void;
  submitTransaction: (input: SubmitTransactionInput) => Promise<SubmitTransactionResult>;
  deleteCommittedTransaction: (transactionId: string) => void;
};

const DEFAULT_UTILITY_ESTIMATES: UtilityEstimateMap = {
  ELECTRICITY: 0,
  GAS: 0,
  WATER: 0,
};

function calculateComputedMetrics(params: {
  readonly remainingCycleBudget: number;
  readonly daysUntilNextPaydayIncludingToday: number;
  readonly daysUntilNextPaydayExcludingToday: number;
  readonly utilityEstimates: UtilityEstimateMap;
  readonly transactions: readonly DashboardTransaction[];
  readonly isFirstCycle: boolean;
}): DashboardComputedMetrics {
  return calculateDashboardCycleMetrics(params);
}

function createOptimisticTransaction(input: SubmitTransactionInput): DashboardTransaction {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    amount: input.amount,
    memo: input.memo,
    type: input.kind === "SPECIAL" ? "SPECIAL" : "NORMAL",
    utility_type: input.kind === "UTILITY" ? input.utilityType : null,
    logical_date: "",
    created_at: new Date().toISOString(),
    isOptimistic: true,
  };
}

function rollbackToPreviousState(
  set: (partial: Partial<DashboardStoreState>) => void,
  previousState: DashboardStoreState,
  submitErrorMessage: string,
): void {
  set({
    transactions: previousState.transactions,
    dailyBudgetToday: previousState.dailyBudgetToday,
    remainingToday: previousState.remainingToday,
    futureDailyBudget: previousState.futureDailyBudget,
    todaySpentTotal: previousState.todaySpentTotal,
    todayNormalSpent: previousState.todayNormalSpent,
    utilityDeltaTotal: previousState.utilityDeltaTotal,
    isOverBudget: previousState.isOverBudget,
    isSubmitting: false,
    submitErrorMessage,
  });
}

export const useDashboardStore = create<DashboardStoreState>((set, get) => ({
  logicalToday: "",
  anchorLogicalDate: "",
  isFirstCycle: false,
  remainingCycleBudget: 0,
  daysUntilNextPaydayIncludingToday: 1,
  daysUntilNextPaydayExcludingToday: 0,
  utilityEstimates: DEFAULT_UTILITY_ESTIMATES,
  transactions: [],
  dailyBudgetToday: 0,
  remainingToday: 0,
  futureDailyBudget: 0,
  todaySpentTotal: 0,
  todayNormalSpent: 0,
  utilityDeltaTotal: 0,
  isOverBudget: false,
  isSubmitting: false,
  submitErrorMessage: "",
  hydrate: (payload) => {
    const computed = calculateComputedMetrics(payload);
    set({
      remainingCycleBudget: payload.remainingCycleBudget,
      logicalToday: payload.logicalToday,
      anchorLogicalDate: payload.anchorLogicalDate,
      isFirstCycle: payload.isFirstCycle,
      daysUntilNextPaydayIncludingToday: payload.daysUntilNextPaydayIncludingToday,
      daysUntilNextPaydayExcludingToday: payload.daysUntilNextPaydayExcludingToday,
      utilityEstimates: payload.utilityEstimates,
      transactions: payload.transactions,
      ...computed,
      submitErrorMessage: "",
    });
  },
  applyProfileSettings: (payload) => {
    const previousState = get();
    const logicalTodayDate = resolveLogicalTodayDate(previousState.logicalToday);
    const prorationDayCounts = previousState.isFirstCycle
      ? calculateFirstCycleDailyProrationDayCounts({
          logicalToday: logicalTodayDate,
          anchorLogicalDate: parseJstDateKeyToDate(previousState.anchorLogicalDate),
          payday: payload.payday,
          paydayRule: payload.paydayRule,
        })
      : calculateNormalCycleDailyProrationDayCounts({
          logicalToday: logicalTodayDate,
          nextPaydayDate: calculateCycleWindow({
            referenceDate: logicalTodayDate,
            payday: payload.payday,
            paydayRule: payload.paydayRule,
          }).nextPaydayDate,
        });
    const daysUntilNextPaydayIncludingToday = prorationDayCounts.daysIncludingToday;
    const daysUntilNextPaydayExcludingToday = prorationDayCounts.daysExcludingToday;
    const computed = calculateComputedMetrics({
      remainingCycleBudget: payload.remainingCycleBudget,
      daysUntilNextPaydayIncludingToday,
      daysUntilNextPaydayExcludingToday,
      utilityEstimates: payload.utilityEstimates,
      transactions: previousState.transactions,
      isFirstCycle: previousState.isFirstCycle,
    });

    set({
      remainingCycleBudget: payload.remainingCycleBudget,
      daysUntilNextPaydayIncludingToday,
      daysUntilNextPaydayExcludingToday,
      utilityEstimates: payload.utilityEstimates,
      ...computed,
    });
  },
  submitTransaction: async (input) => {
    const previousState = get();
    const optimisticTransaction = createOptimisticTransaction(input);
    const nextTransactions = [optimisticTransaction, ...previousState.transactions];
    const optimisticComputed = calculateComputedMetrics({
      remainingCycleBudget: previousState.remainingCycleBudget,
      daysUntilNextPaydayIncludingToday: previousState.daysUntilNextPaydayIncludingToday,
      daysUntilNextPaydayExcludingToday: previousState.daysUntilNextPaydayExcludingToday,
      utilityEstimates: previousState.utilityEstimates,
      transactions: nextTransactions,
      isFirstCycle: previousState.isFirstCycle,
    });

    set({
      transactions: nextTransactions,
      ...optimisticComputed,
      isSubmitting: true,
      submitErrorMessage: "",
    });

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const apiErrorMessage =
          getErrorMessageFromResponseBody(body) ?? "支出の保存に失敗しました。時間をおいて再試行してください。";
        rollbackToPreviousState(set, previousState, apiErrorMessage);
        return { success: false, errorMessage: apiErrorMessage };
      }

      const invalidResponseMessage = "保存を完了できませんでした。通信状況を確認し、もう一度お試しください。";
      if (!isRecord(body) || !("transaction" in body) || !isDashboardTransaction(body.transaction)) {
        rollbackToPreviousState(set, previousState, invalidResponseMessage);
        return { success: false, errorMessage: invalidResponseMessage };
      }
      const rawTransaction = body.transaction;

      const committedTransactions = get().transactions.map((transaction) =>
        transaction.id === optimisticTransaction.id ? { ...rawTransaction, isOptimistic: false } : transaction,
      );
      const committedComputed = calculateComputedMetrics({
        remainingCycleBudget: previousState.remainingCycleBudget,
        daysUntilNextPaydayIncludingToday: previousState.daysUntilNextPaydayIncludingToday,
        daysUntilNextPaydayExcludingToday: previousState.daysUntilNextPaydayExcludingToday,
        utilityEstimates: previousState.utilityEstimates,
        transactions: committedTransactions,
        isFirstCycle: previousState.isFirstCycle,
      });

      set({
        transactions: committedTransactions,
        ...committedComputed,
        isSubmitting: false,
      });
      return { success: true };
    } catch {
      rollbackToPreviousState(
        set,
        previousState,
        "通信に失敗しました。ネットワークを確認して再試行してください。",
      );
      return {
        success: false,
        errorMessage: "通信に失敗しました。ネットワークを確認して再試行してください。",
      };
    }
  },
  deleteCommittedTransaction: (transactionId) => {
    const previousState = get();
    const nextTransactions = previousState.transactions.filter((transaction) => transaction.id !== transactionId);
    const nextComputed = calculateComputedMetrics({
      remainingCycleBudget: previousState.remainingCycleBudget,
      daysUntilNextPaydayIncludingToday: previousState.daysUntilNextPaydayIncludingToday,
      daysUntilNextPaydayExcludingToday: previousState.daysUntilNextPaydayExcludingToday,
      utilityEstimates: previousState.utilityEstimates,
      transactions: nextTransactions,
      isFirstCycle: previousState.isFirstCycle,
    });

    set({
      transactions: nextTransactions,
      ...nextComputed,
    });
  },
}));
