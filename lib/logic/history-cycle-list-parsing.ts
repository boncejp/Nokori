import { isDashboardTransaction } from "@/lib/stores/dashboard-transaction-parsing";
import type { DashboardTransaction } from "@/lib/stores/dashboard-transaction-parsing";
import { isRecord } from "@/lib/types/object-parsing";

export type HistoryCycleListPage = {
  readonly transactions: readonly DashboardTransaction[];
  readonly totalCount: number;
  readonly offset: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
};

export function parseHistoryCycleListPage(body: unknown): HistoryCycleListPage | null {
  if (!isRecord(body)) {
    return null;
  }
  if (!Array.isArray(body.transactions)) {
    return null;
  }
  if (
    typeof body.totalCount !== "number" ||
    typeof body.offset !== "number" ||
    typeof body.pageSize !== "number" ||
    typeof body.hasMore !== "boolean"
  ) {
    return null;
  }

  const transactions: DashboardTransaction[] = [];
  for (const item of body.transactions) {
    if (!isDashboardTransaction(item)) {
      return null;
    }
    transactions.push({ ...item, isOptimistic: false });
  }

  return {
    transactions,
    totalCount: body.totalCount,
    offset: body.offset,
    pageSize: body.pageSize,
    hasMore: body.hasMore,
  };
}
