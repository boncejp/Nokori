"use client";

import { useEffect, useState } from "react";

import type { UtilityType } from "@/lib/logic/budget-logic";
import { useDashboardStore, type DashboardTransaction } from "@/lib/stores/dashboard-store";

import { PaydaySalaryModal } from "./PaydaySalaryModal";

type DashboardClientProps = {
  readonly salaryPrompt: {
    readonly cycleStartLogicalDate: string;
    readonly currentMonthlyIncome: number;
  } | null;
  readonly initialState: {
    readonly logicalToday: string;
    readonly remainingCycleBudget: number;
    readonly daysUntilNextPaydayIncludingToday: number;
    readonly daysUntilNextPaydayExcludingToday: number;
    readonly utilityEstimates: Readonly<Record<UtilityType, number>>;
    readonly transactions: readonly DashboardTransaction[];
    readonly initialTransactionsErrorMessage: string | null;
  };
};

type TransactionKind = "NORMAL" | "SPECIAL" | "UTILITY";

const TRANSACTION_KIND_OPTIONS: readonly { readonly value: TransactionKind; readonly label: string }[] = [
  { value: "NORMAL", label: "普通支出" },
  { value: "SPECIAL", label: "特別支出" },
  { value: "UTILITY", label: "光熱費" },
];

const UTILITY_TYPE_OPTIONS: readonly { readonly value: UtilityType; readonly label: string }[] = [
  { value: "ELECTRICITY", label: "電気" },
  { value: "GAS", label: "ガス" },
  { value: "WATER", label: "水道" },
];

function formatTransactionHeading(transaction: DashboardTransaction): string {
  if (transaction.type === "SPECIAL") {
    return "特別支出";
  }
  if (transaction.utility_type !== null) {
    const label = UTILITY_TYPE_OPTIONS.find((o) => o.value === transaction.utility_type)?.label ?? "";
    return `光熱費（${label}）`;
  }
  return "普通支出";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardClient({ salaryPrompt, initialState }: DashboardClientProps) {
  const hydrate = useDashboardStore((state) => state.hydrate);
  const submitTransaction = useDashboardStore((state) => state.submitTransaction);
  const remainingToday = useDashboardStore((state) => state.remainingToday);
  const dailyBudgetToday = useDashboardStore((state) => state.dailyBudgetToday);
  const futureDailyBudget = useDashboardStore((state) => state.futureDailyBudget);
  const todaySpentTotal = useDashboardStore((state) => state.todaySpentTotal);
  const isOverBudget = useDashboardStore((state) => state.isOverBudget);
  const isSubmitting = useDashboardStore((state) => state.isSubmitting);
  const submitErrorMessage = useDashboardStore((state) => state.submitErrorMessage);
  const transactions = useDashboardStore((state) => state.transactions);

  const [amountInput, setAmountInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [kindInput, setKindInput] = useState<TransactionKind>("NORMAL");
  const [utilityTypeInput, setUtilityTypeInput] = useState<UtilityType>("ELECTRICITY");
  const [formErrorMessage, setFormErrorMessage] = useState("");

  useEffect(() => {
    hydrate(initialState);
  }, [hydrate, initialState]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrorMessage("");

    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormErrorMessage("金額は1円以上で入力してください。");
      return;
    }

    const result = await submitTransaction({
      amount: Math.floor(parsedAmount),
      memo: memoInput.trim().length > 0 ? memoInput.trim() : null,
      kind: kindInput,
      utilityType: kindInput === "UTILITY" ? utilityTypeInput : null,
    });

    if (!result.success) {
      setFormErrorMessage(result.errorMessage);
      return;
    }

    setAmountInput("");
    setMemoInput("");
    setKindInput("NORMAL");
    setUtilityTypeInput("ELECTRICITY");
  };

  return (
    <section
      className={`relative space-y-6 rounded-xl border p-6 ${
        isOverBudget ? "border-red-300 bg-red-50 text-red-950" : "border-zinc-200 bg-white"
      }`}
    >
      {salaryPrompt !== null ? <PaydaySalaryModal salaryPrompt={salaryPrompt} /> : null}
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">今日の残り予算</p>
        <p className="text-4xl font-bold tracking-tight">{formatCurrency(remainingToday)}</p>
        {isOverBudget ? (
          <p className="text-sm font-medium text-red-700">予算超過です。支出ペースを見直してください。</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="当日予算（D_today）" value={formatCurrency(dailyBudgetToday)} />
        <MetricCard label="翌日以降予測（D_future）" value={formatCurrency(futureDailyBudget)} />
        <MetricCard label="今日の支出合計" value={formatCurrency(todaySpentTotal)} />
      </div>

      {initialState.initialTransactionsErrorMessage ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {initialState.initialTransactionsErrorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <h2 className="text-base font-semibold">支出を登録</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>金額</span>
            <input
              data-testid="expense-amount-input"
              type="number"
              min={1}
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder="1500"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>種別</span>
            <select
              value={kindInput}
              onChange={(event) => setKindInput(parseKind(event.target.value))}
              className="rounded-md border border-zinc-300 px-3 py-2"
              title="支出のカテゴリ（予算・貯金への効き方が異なります）"
            >
              {TRANSACTION_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {kindInput === "UTILITY" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>光熱費種別</span>
              <select
                value={utilityTypeInput}
                onChange={(event) => setUtilityTypeInput(parseUtilityType(event.target.value))}
                className="rounded-md border border-zinc-300 px-3 py-2"
              >
                {UTILITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span>メモ（任意）</span>
            <input
              type="text"
              value={memoInput}
              onChange={(event) => setMemoInput(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder="ランチ"
              maxLength={200}
            />
          </label>
        </div>
        <details className="rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-700">
          <summary className="cursor-pointer select-none font-medium text-zinc-800">支出の種別が予算に与える影響</summary>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-zinc-600">
            <li>
              <strong className="font-medium text-zinc-800">普通支出</strong>
              ：当日の可処分予算と翌日以降の日次予算から差し引かれます。
            </li>
            <li>
              <strong className="font-medium text-zinc-800">特別支出</strong>
              ：貯金総額から直接差し引かれ、当日の日次予算には影響しません（貯金ノルマは再計算されます）。
            </li>
            <li>
              <strong className="font-medium text-zinc-800">光熱費</strong>
              ：各項目の概算との差額が当月の残り予算に加減されます（実額が概算より安いと予算が増え、高いと減ります）。
            </li>
          </ul>
        </details>
        {formErrorMessage.length > 0 ? <p className="text-sm text-red-700">{formErrorMessage}</p> : null}
        {submitErrorMessage.length > 0 ? <p className="text-sm text-red-700">{submitErrorMessage}</p> : null}
        <button
          data-testid="submit-expense-button"
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {isSubmitting ? "保存中..." : "登録"}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">当日の支出（簡易）</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-zinc-600">まだ支出はありません。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {transactions.map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{formatTransactionHeading(transaction)}</p>
                  {transaction.memo ? <p className="text-zinc-500">{transaction.memo}</p> : null}
                </div>
                <p className={transaction.isOptimistic ? "text-zinc-500" : "text-zinc-800"}>
                  {formatCurrency(transaction.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type MetricCardProps = {
  readonly label: string;
  readonly value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function parseKind(value: string): TransactionKind {
  if (value === "SPECIAL") {
    return "SPECIAL";
  }
  if (value === "UTILITY") {
    return "UTILITY";
  }
  return "NORMAL";
}

function parseUtilityType(value: string): UtilityType {
  if (value === "GAS") {
    return "GAS";
  }
  if (value === "WATER") {
    return "WATER";
  }
  return "ELECTRICITY";
}
