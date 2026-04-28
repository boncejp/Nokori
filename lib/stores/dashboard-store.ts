"use client";

import { create } from "zustand";

import {
  applyUtilityDeltaToRemainingBudget,
  calculateDailyBudgetFuture,
  calculateDailyBudgetToday,
  calculateRemainingToday,
  type UtilityType,
} from "@/lib/logic/budget-logic";

export type DashboardTransaction = {
  readonly id: string;
  readonly amount: number;
  readonly memo: string | null;
  readonly type: "NORMAL" | "SPECIAL";
  readonly utility_type: UtilityType | null;
  readonly logical_date: string;
  readonly created_at: string;
  readonly isOptimistic: boolean;
};

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

type UtilityEstimateMap = Readonly<Record<UtilityType, number>>;

type DashboardHydration = {
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
  submitTransaction: (input: SubmitTransactionInput) => Promise<SubmitTransactionResult>;
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
}): DashboardComputedMetrics {
  const {
    remainingCycleBudget,
    daysUntilNextPaydayIncludingToday,
    daysUntilNextPaydayExcludingToday,
    utilityEstimates,
    transactions,
  } = params;

  const todaySpentTotal = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const todayNormalSpent = transactions.reduce((sum, transaction) => {
    if (transaction.type === "NORMAL" && transaction.utility_type === null) {
      return sum + transaction.amount;
    }
    return sum;
  }, 0);
  const utilityDeltaTotal = transactions.reduce((sum, transaction) => {
    if (transaction.utility_type === null) {
      return sum;
    }
    const estimate = utilityEstimates[transaction.utility_type];
    return sum + (estimate - transaction.amount);
  }, 0);

  const dailyBudgetToday = calculateDailyBudgetToday({
    remainingCycleBudget,
    daysUntilNextPaydayIncludingToday,
  });
  const remainingToday = calculateRemainingToday({
    dailyBudgetToday,
    todaySpent: todayNormalSpent,
  });
  const remainingBudgetWithUtilityDelta = applyUtilityDeltaToRemainingBudget({
    remainingBudget: remainingCycleBudget,
    utilityDelta: utilityDeltaTotal,
  });
  const futureDailyBudget = calculateDailyBudgetFuture({
    remainingCycleBudget: remainingBudgetWithUtilityDelta,
    todaySpent: todayNormalSpent,
    daysUntilNextPaydayExcludingToday,
  });

  return {
    dailyBudgetToday,
    remainingToday,
    futureDailyBudget,
    todaySpentTotal,
    todayNormalSpent,
    utilityDeltaTotal,
    isOverBudget: remainingToday < 0,
  };
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

function getErrorMessageFromResponseBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  if (!("errorMessage" in body)) {
    return null;
  }
  const errorMessage = body.errorMessage;
  if (typeof errorMessage !== "string") {
    return null;
  }
  return errorMessage;
}

function isDashboardTransaction(value: unknown): value is DashboardTransaction {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("id" in value) || typeof value.id !== "string") {
    return false;
  }
  if (!("amount" in value) || typeof value.amount !== "number") {
    return false;
  }
  if (!("memo" in value) || !(typeof value.memo === "string" || value.memo === null)) {
    return false;
  }
  if (!("type" in value) || !(value.type === "NORMAL" || value.type === "SPECIAL")) {
    return false;
  }
  if (
    !("utility_type" in value) ||
    !(value.utility_type === null || value.utility_type === "ELECTRICITY" || value.utility_type === "GAS" || value.utility_type === "WATER")
  ) {
    return false;
  }
  if (!("logical_date" in value) || typeof value.logical_date !== "string") {
    return false;
  }
  if (!("created_at" in value) || typeof value.created_at !== "string") {
    return false;
  }
  return true;
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
      daysUntilNextPaydayIncludingToday: payload.daysUntilNextPaydayIncludingToday,
      daysUntilNextPaydayExcludingToday: payload.daysUntilNextPaydayExcludingToday,
      utilityEstimates: payload.utilityEstimates,
      transactions: payload.transactions,
      ...computed,
      submitErrorMessage: "",
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

      if (typeof body !== "object" || body === null || !("transaction" in body)) {
        const invalidResponseMessage =
          "サーバー応答の形式が不正です。データを保護するため入力を取り消しました。";
        rollbackToPreviousState(set, previousState, invalidResponseMessage);
        return { success: false, errorMessage: invalidResponseMessage };
      }

      const rawTransaction = body.transaction;
      if (!isDashboardTransaction(rawTransaction)) {
        const invalidTransactionMessage =
          "保存結果の形式が不正です。データを保護するため入力を取り消しました。";
        rollbackToPreviousState(set, previousState, invalidTransactionMessage);
        return { success: false, errorMessage: invalidTransactionMessage };
      }

      const committedTransactions = get().transactions.map((transaction) =>
        transaction.id === optimisticTransaction.id ? { ...rawTransaction, isOptimistic: false } : transaction,
      );
      const committedComputed = calculateComputedMetrics({
        remainingCycleBudget: previousState.remainingCycleBudget,
        daysUntilNextPaydayIncludingToday: previousState.daysUntilNextPaydayIncludingToday,
        daysUntilNextPaydayExcludingToday: previousState.daysUntilNextPaydayExcludingToday,
        utilityEstimates: previousState.utilityEstimates,
        transactions: committedTransactions,
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
}));
