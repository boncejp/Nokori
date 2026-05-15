"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { UtilityType } from "@/lib/logic/budget-logic";
import { useDashboardStore, type DashboardTransaction } from "@/lib/stores/dashboard-store";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { toNumericOnly } from "@/lib/money-input-format";

import { ExpenseAmountKeypad } from "./ExpenseAmountKeypad";
import { PaydaySalaryModal } from "./PaydaySalaryModal";

type DashboardClientProps = {
  readonly salaryPrompt: {
    readonly cycleStartLogicalDate: string;
    readonly currentMonthlyIncome: number;
  } | null;
  readonly initialState: {
    readonly logicalToday: string;
    readonly anchorLogicalDate: string;
    readonly isFirstCycle: boolean;
    readonly remainingCycleBudget: number;
    readonly daysUntilNextPaydayIncludingToday: number;
    readonly daysUntilNextPaydayExcludingToday: number;
    readonly utilityEstimates: Readonly<Record<UtilityType, number>>;
    readonly transactions: readonly DashboardTransaction[];
    readonly initialTransactionsErrorMessage: string | null;
  };
  /** サーバー算出の超過状態（初回ペイントとストア同期前のちらつき防止） */
  readonly initialIsOverBudget: boolean;
  readonly topSlot: ReactNode;
  readonly bottomSlot: ReactNode;
};

type TransactionKind = "NORMAL" | "SPECIAL" | "UTILITY";

const TRANSACTION_KIND_OPTIONS: readonly {
  readonly value: TransactionKind;
  readonly label: string;
  readonly shortLabel: string;
  readonly tooltip: string;
  readonly helpAria: string;
}[] = [
  {
    value: "NORMAL",
    label: "普通支出",
    shortLabel: "普通",
    tooltip: "今日の日次予算と、翌日以降の1日あたりの目安から差し引く普段の支出として扱います。",
    helpAria: "普通支出が予算に与える影響の説明",
  },
  {
    value: "SPECIAL",
    label: "特別支出",
    shortLabel: "特別",
    tooltip: "貯金総額から直接差し引き、当日の日次予算には載せません（月次貯金ノルマは再計算されます）。",
    helpAria: "特別支出が予算に与える影響の説明",
  },
  {
    value: "UTILITY",
    label: "光熱費",
    shortLabel: "光熱",
    tooltip: "各種別の概算との差額がこのサイクル内の残り予算に反映されます（今日の残りは普通支出ベースのまま）。",
    helpAria: "光熱費が予算に与える影響の説明",
  },
];

const UTILITY_TYPE_OPTIONS: readonly {
  readonly value: UtilityType;
  readonly label: string;
  readonly tooltip: string;
  readonly helpAria: string;
}[] = [
  {
    value: "ELECTRICITY",
    label: "電気",
    tooltip: "電気の実額として記録し、概算との差額をこのサイクル内の残り予算に反映します。",
    helpAria: "電気（光熱費）入力の説明",
  },
  {
    value: "GAS",
    label: "ガス",
    tooltip: "ガスの実額として記録し、概算との差額をこのサイクル内の残り予算に反映します。",
    helpAria: "ガス（光熱費）入力の説明",
  },
  {
    value: "WATER",
    label: "水道",
    tooltip: "水道の実額として記録し、概算との差額をこのサイクル内の残り予算に反映します。",
    helpAria: "水道（光熱費）入力の説明",
  },
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

export function DashboardClient({
  salaryPrompt,
  initialState,
  initialIsOverBudget,
  topSlot,
  bottomSlot,
}: DashboardClientProps) {
  const hydrate = useDashboardStore((state) => state.hydrate);
  const submitTransaction = useDashboardStore((state) => state.submitTransaction);
  const remainingToday = useDashboardStore((state) => state.remainingToday);
  const dailyBudgetToday = useDashboardStore((state) => state.dailyBudgetToday);
  const futureDailyBudget = useDashboardStore((state) => state.futureDailyBudget);
  const todaySpentTotal = useDashboardStore((state) => state.todaySpentTotal);
  const isSubmitting = useDashboardStore((state) => state.isSubmitting);
  const submitErrorMessage = useDashboardStore((state) => state.submitErrorMessage);
  const transactions = useDashboardStore((state) => state.transactions);
  const isFirstCycle = useDashboardStore((state) => state.isFirstCycle);

  const [displayOverBudget, setDisplayOverBudget] = useState(initialIsOverBudget);

  const [amountInput, setAmountInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [kindInput, setKindInput] = useState<TransactionKind>("NORMAL");
  const [utilityTypeInput, setUtilityTypeInput] = useState<UtilityType>("ELECTRICITY");
  const [formErrorMessage, setFormErrorMessage] = useState("");

  useEffect(() => {
    hydrate(initialState);
    queueMicrotask(() => {
      setDisplayOverBudget(useDashboardStore.getState().isOverBudget);
    });
    const unsubscribe = useDashboardStore.subscribe((state) => {
      setDisplayOverBudget(state.isOverBudget);
    });
    return unsubscribe;
  }, [hydrate, initialState]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrorMessage("");

    const parsedAmount = Number(toNumericOnly(amountInput));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormErrorMessage("金額は1円以上で入力してください。");
      return;
    }

    const result = await submitTransaction({
      amount: Math.floor(parsedAmount),
      memo: memoInput.trim().length > 0 ? memoInput.trim() : null,
      kind: isFirstCycle ? "NORMAL" : kindInput,
      utilityType: isFirstCycle ? null : kindInput === "UTILITY" ? utilityTypeInput : null,
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
    <div className="relative flex flex-col gap-6">
      {salaryPrompt !== null ? <PaydaySalaryModal salaryPrompt={salaryPrompt} /> : null}
      {topSlot}

      <section className="space-y-6 rounded-xl border border-nokori-border bg-nokori-surface p-4 shadow-sm sm:p-6">
        <div className="space-y-2">
          <p className="text-sm text-nokori-muted">今日の残り予算</p>
          <p
            className={`text-3xl font-bold tracking-tight sm:text-4xl ${
              displayOverBudget ? "text-red-700" : "text-nokori-navy"
            }`}
          >
            {formatCurrency(remainingToday)}
          </p>
          {displayOverBudget ? (
            <p className="text-sm font-medium text-red-700">予算超過です。支出ペースを見直してください。</p>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <MetricCard label="当日の目安予算" value={formatCurrency(dailyBudgetToday)} />
          <MetricCard label="翌日以降の目安（1日あたり）" value={formatCurrency(futureDailyBudget)} />
          <MetricCard label="今日の支出合計" value={formatCurrency(todaySpentTotal)} />
        </div>

        {initialState.initialTransactionsErrorMessage ? (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>{initialState.initialTransactionsErrorMessage}</p>
            <p className="text-xs text-amber-950/80">一覧を取り直すには、ブラウザでページを再読み込みしてください。</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-nokori-border bg-nokori-subtle/50 p-4">
          <h2 className="text-base font-semibold text-nokori-navy">支出を登録</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-nokori-text" htmlFor="expense-amount-input">
              <span>金額</span>
              <ExpenseAmountKeypad digits={amountInput} onDigitsChange={setAmountInput} />
            </label>
            <div className="flex flex-col gap-1 text-sm text-nokori-text sm:col-span-2">
              <span>支出種別</span>
              {isFirstCycle ? (
                <input
                  type="text"
                  readOnly
                  value="普通支出"
                  className="min-h-11 rounded-md border border-nokori-border bg-nokori-subtle px-3 py-2.5 text-base text-nokori-muted sm:text-sm"
                />
              ) : (
                <TransactionKindSegments value={kindInput} onChange={setKindInput} />
              )}
            </div>
            {kindInput === "UTILITY" && !isFirstCycle ? (
              <div className="flex flex-col gap-1 text-sm text-nokori-text sm:col-span-2">
                <span>光熱費の内訳</span>
                <UtilityTypeSegments value={utilityTypeInput} onChange={setUtilityTypeInput} />
              </div>
            ) : null}
            <label className="flex flex-col gap-1 text-sm text-nokori-text sm:col-span-2">
              <span>メモ（任意）</span>
              <input
                type="text"
                value={memoInput}
                onChange={(event) => setMemoInput(event.target.value)}
                className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-base text-nokori-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 sm:text-sm"
                placeholder="例: ランチ"
                maxLength={200}
              />
            </label>
          </div>
          {isFirstCycle ? null : (
            <details className="rounded-md border border-nokori-border bg-nokori-surface px-3 py-2 text-sm text-nokori-muted">
              <summary className="min-h-11 cursor-pointer select-none py-2 font-medium text-nokori-text">
                支出の種別が予算に与える影響（詳細）
              </summary>
              <ul className="mt-2 list-inside list-disc space-y-1.5">
                <li>
                  <strong className="font-medium text-nokori-text">普通支出</strong>
                  ：「今日の残り」に相当する枠と、翌日以降の1日あたりの目安から差し引かれます。
                </li>
                <li>
                  <strong className="font-medium text-nokori-text">特別支出</strong>
                  ：貯金総額から直接差し引かれ、当日の日次予算には影響しません（月次貯金ノルマは再計算されます）。
                </li>
                <li>
                  <strong className="font-medium text-nokori-text">光熱費</strong>
                  ：各項目の概算との差額がこのサイクル内の残り予算に加減されます（実額が概算より安いと予算が増え、高いと減ります）。
                </li>
              </ul>
            </details>
          )}
          {formErrorMessage.length > 0 ? <p className="text-sm text-red-700">{formErrorMessage}</p> : null}
          {submitErrorMessage.length > 0 ? <p className="text-sm text-red-700">{submitErrorMessage}</p> : null}
          <button
            data-testid="submit-expense-button"
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-md bg-nokori-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-nokori-navy-soft disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? "保存中..." : "登録"}
          </button>
        </form>

        {isFirstCycle ? (
          <details className="rounded-lg border border-nokori-border bg-nokori-subtle px-3 py-1 text-sm text-nokori-text">
            <summary className="min-h-11 cursor-pointer select-none py-2 font-medium text-nokori-navy">
              初回サイクルについて
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1.5 pb-3 text-nokori-muted">
              <li>初回サイクルでは、「次の給料日まで使う予算」を「普通支出」としてのみ管理します。</li>
              <li>光熱費と特別支出の詳細管理は、次の給料日以降の通常サイクルから利用できます。</li>
              <li>
                通常サイクルでは、光熱費は概算との差額を残り予算へ反映し、特別支出は貯金総額から直接差し引いて月次貯金ノルマを再計算します。
              </li>
            </ul>
          </details>
        ) : null}

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-nokori-navy">当日の支出（簡易）</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-nokori-muted">
              まだ支出はありません。上のフォームから金額を入力して登録してください。
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {transactions.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between rounded-md border border-nokori-border bg-nokori-surface px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-nokori-text">{formatTransactionHeading(transaction)}</p>
                    {transaction.memo ? <p className="text-nokori-muted">{transaction.memo}</p> : null}
                  </div>
                  <p className={transaction.isOptimistic ? "text-nokori-muted" : "text-nokori-text"}>
                    {formatCurrency(transaction.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{bottomSlot}</div>
    </div>
  );
}

type MetricCardProps = {
  readonly label: string;
  readonly value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-nokori-border bg-nokori-surface p-3 shadow-sm">
      <p className="text-xs text-nokori-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-nokori-navy">{value}</p>
    </div>
  );
}

function TransactionKindSegments({
  value,
  onChange,
}: {
  readonly value: TransactionKind;
  readonly onChange: (next: TransactionKind) => void;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      role="radiogroup"
      aria-label="支出種別"
    >
      {TRANSACTION_KIND_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <div
            key={option.value}
            className="flex min-h-[3.25rem] flex-col gap-1.5 rounded-lg border border-nokori-border bg-nokori-surface p-2 shadow-sm sm:min-h-0"
          >
            <div className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={`min-h-11 flex-1 rounded-md px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/35 ${
                  selected
                    ? "bg-nokori-navy text-white shadow-inner"
                    : "bg-nokori-subtle text-nokori-navy hover:bg-nokori-border/60"
                }`}
                onClick={() => {
                  onChange(option.value);
                }}
              >
                {option.shortLabel}
              </button>
              <HelpTooltip ariaLabel={option.helpAria} description={option.tooltip} />
            </div>
            <span className="text-center text-[11px] leading-tight text-nokori-muted sm:text-xs">{option.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function UtilityTypeSegments({
  value,
  onChange,
}: {
  readonly value: UtilityType;
  readonly onChange: (next: UtilityType) => void;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      role="radiogroup"
      aria-label="光熱費の内訳"
    >
      {UTILITY_TYPE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <div
            key={option.value}
            className="flex min-h-[3.25rem] flex-col gap-1.5 rounded-lg border border-nokori-border bg-nokori-surface p-2 shadow-sm sm:min-h-0"
          >
            <div className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={`min-h-11 flex-1 rounded-md px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/35 ${
                  selected
                    ? "bg-nokori-navy text-white shadow-inner"
                    : "bg-nokori-subtle text-nokori-navy hover:bg-nokori-border/60"
                }`}
                onClick={() => {
                  onChange(option.value);
                }}
              >
                {option.label}
              </button>
              <HelpTooltip ariaLabel={option.helpAria} description={option.tooltip} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
