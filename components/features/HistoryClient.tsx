"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { UtilityType } from "@/lib/logic/budget-logic";
import { useDashboardStore, type DashboardTransaction } from "@/lib/stores/dashboard-store";

type HistoryClientProps = {
  readonly dashboardHydration: {
    readonly logicalToday: string;
    readonly anchorLogicalDate: string;
    readonly isFirstCycle: boolean;
    readonly remainingCycleBudget: number;
    readonly daysUntilNextPaydayIncludingToday: number;
    readonly daysUntilNextPaydayExcludingToday: number;
    readonly utilityEstimates: Readonly<Record<UtilityType, number>>;
    readonly transactions: readonly DashboardTransaction[];
  };
  readonly cycleTransactions: readonly DashboardTransaction[];
  /** サーバー算出のサイクル範囲・27:00 ルールの説明（実装の `getHistoryListingLogicalDateRange` と整合） */
  readonly cycleListingDescription: string;
  readonly initialHistoryErrorMessage: string | null;
};

function formatLogicalDateJa(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) {
    return dateKey;
  }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return dateKey;
  }
  return `${y}年${m}月${d}日`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatKindLabel(transaction: DashboardTransaction): string {
  if (transaction.type === "SPECIAL") {
    return "特別支出";
  }
  if (transaction.utility_type !== null) {
    let utilityLabel = "水道";
    if (transaction.utility_type === "ELECTRICITY") {
      utilityLabel = "電気";
    } else if (transaction.utility_type === "GAS") {
      utilityLabel = "ガス";
    }
    return `光熱費（${utilityLabel}）`;
  }
  return "普通支出";
}

export function HistoryClient({
  dashboardHydration,
  cycleTransactions,
  cycleListingDescription,
  initialHistoryErrorMessage,
}: HistoryClientProps) {
  const hydrate = useDashboardStore((state) => state.hydrate);
  const logicalToday = useDashboardStore((state) => state.logicalToday);
  const deleteCommittedTransaction = useDashboardStore((state) => state.deleteCommittedTransaction);

  const [transactions, setTransactions] = useState<readonly DashboardTransaction[]>(cycleTransactions);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState("");

  useEffect(() => {
    hydrate(dashboardHydration);
  }, [dashboardHydration, hydrate]);

  useEffect(() => {
    queueMicrotask(() => {
      setTransactions(cycleTransactions);
    });
  }, [cycleTransactions]);

  const cycleExpenseTotal = useMemo(() => {
    return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  }, [transactions]);

  const handleDelete = async (transaction: DashboardTransaction) => {
    const isConfirmed = window.confirm("この支出を削除しますか？");
    if (!isConfirmed) {
      return;
    }

    const previousTransactions = transactions;
    setActionErrorMessage("");
    setIsDeletingId(transaction.id);
    setTransactions((currentTransactions) =>
      currentTransactions.filter((currentTransaction) => currentTransaction.id !== transaction.id),
    );

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const errorMessage = getErrorMessageFromResponseBody(body) ?? "削除に失敗しました。時間をおいて再試行してください。";
        setTransactions(previousTransactions);
        setActionErrorMessage(errorMessage);
        return;
      }

      if (transaction.logical_date === logicalToday) {
        deleteCommittedTransaction(transaction.id);
      }
    } catch {
      setTransactions(previousTransactions);
      setActionErrorMessage("通信に失敗しました。ネットワークを確認して再試行してください。");
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-nokori-border bg-nokori-surface p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-nokori-navy">履歴</h1>
          <p className="mt-1 text-sm font-medium text-nokori-text">このサイクル内の支出</p>
          <p className="text-xs leading-relaxed text-nokori-muted">
            集計の範囲や日付の切り替えは、下の「集計の説明」を開いて確認できます。
          </p>
          <details className="rounded-md border border-nokori-border bg-nokori-surface text-nokori-text">
            <summary className="min-h-11 cursor-pointer select-none px-3 py-2 text-sm font-medium text-nokori-navy outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/35 focus-visible:ring-inset">
              集計の説明
            </summary>
            <div className="border-t border-nokori-border/70 px-3 pb-3 pt-2">
              <p className="max-h-[min(45vh,22rem)] max-w-[min(42rem,100%)] overflow-y-auto text-sm leading-relaxed text-nokori-muted">
                {cycleListingDescription}
              </p>
            </div>
          </details>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-navy shadow-sm transition hover:bg-nokori-subtle sm:flex-initial"
          >
            ダッシュボードへ戻る
          </Link>
          <Link
            href="/settings"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-navy shadow-sm transition hover:bg-nokori-subtle sm:flex-initial"
          >
            設定を開く
          </Link>
        </div>
      </div>

      {initialHistoryErrorMessage ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>{initialHistoryErrorMessage}</p>
          <p className="text-xs text-amber-950/80">一覧を取り直すには、ブラウザでページを再読み込みしてください。</p>
        </div>
      ) : null}
      {actionErrorMessage ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionErrorMessage}</p> : null}

      <div className="rounded-lg border border-nokori-border bg-nokori-subtle/60 p-4">
        <p className="text-xs text-nokori-muted">このサイクル内の支出の合計</p>
        <p className="text-2xl font-semibold text-nokori-navy">{formatCurrency(cycleExpenseTotal)}</p>
      </div>

      {transactions.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed border-nokori-border px-4 py-8 text-center text-sm text-nokori-muted">
          <p>このサイクル内の支出はまだありません。</p>
          <p>ダッシュボードから支出を登録すると、ここに表示されます。</p>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-nokori-navy px-4 py-2.5 text-sm text-white transition hover:bg-nokori-navy-soft"
          >
            ダッシュボードへ
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {transactions.map((transaction) => (
            <li key={transaction.id} className="rounded-lg border border-nokori-border bg-nokori-surface px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-nokori-navy">{formatCurrency(transaction.amount)}</p>
                  <p className="text-sm text-nokori-text">{formatKindLabel(transaction)}</p>
                  <p className="text-xs text-nokori-muted">集計日: {formatLogicalDateJa(transaction.logical_date)}</p>
                  <p className="text-xs text-nokori-muted">登録日時: {formatCreatedAt(transaction.created_at)}</p>
                  {transaction.memo ? <p className="text-sm text-nokori-muted">{transaction.memo}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(transaction)}
                  disabled={isDeletingId === transaction.id}
                  className="min-h-11 shrink-0 rounded-md border border-red-300 px-4 py-2.5 text-sm text-red-700 disabled:opacity-60"
                >
                  {isDeletingId === transaction.id ? "削除中..." : "削除"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getErrorMessageFromResponseBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  if (!("errorMessage" in body)) {
    return null;
  }
  if (typeof body.errorMessage !== "string") {
    return null;
  }
  return body.errorMessage;
}
