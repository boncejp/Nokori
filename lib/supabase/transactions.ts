/**
 * transactions テーブルへの RLS 付きアクセス。
 * INSERT 時の logical_date は 27:00 ルール（getLogicalDate）で算出する。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfMonth, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { TIMEZONE } from "@/lib/constants/time";
import { getLogicalDate, toJstDateString } from "@/lib/logic/budget-logic";
import type { UtilityType } from "@/lib/types/domain";
import type { Result } from "@/lib/types/result";
import type { Database, Tables, TablesInsert } from "@/lib/types/database";

type Transaction = Tables<"transactions">;
type TransactionInsert = TablesInsert<"transactions">;

type InsertTransactionInput = {
  readonly amount: number;
  readonly memo: string | null;
  readonly type: "NORMAL" | "SPECIAL";
  readonly utility_type: UtilityType | null;
};

const TRANSACTION_SELECT_COLUMNS =
  "id,user_id,amount,memo,type,utility_type,logical_date,created_at";

export async function listTransactionsByLogicalDate(
  supabase: SupabaseClient<Database>,
  logicalDate: Date,
): Promise<Result<readonly Transaction[]>> {
  const logicalDateString = toJstDateString(logicalDate);
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_SELECT_COLUMNS)
    .eq("logical_date", logicalDateString)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function listTransactionsByLogicalMonth(
  supabase: SupabaseClient<Database>,
  referenceDate: Date,
): Promise<Result<readonly Transaction[]>> {
  const jstReferenceDate = toZonedTime(referenceDate, TIMEZONE);
  const monthStart = toJstDateString(startOfMonth(jstReferenceDate));
  const monthEnd = toJstDateString(endOfMonth(jstReferenceDate));

  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_SELECT_COLUMNS)
    .gte("logical_date", monthStart)
    .lte("logical_date", monthEnd)
    .order("logical_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

function logicalDateRangeKeys(params: {
  readonly fromLogicalDate: Date;
  readonly toLogicalDate: Date;
}): { readonly fromLogicalDateString: string; readonly toLogicalDateString: string } {
  return {
    fromLogicalDateString: toJstDateString(params.fromLogicalDate),
    toLogicalDateString: toJstDateString(params.toLogicalDate),
  };
}

export async function listTransactionsByLogicalDateRange(
  supabase: SupabaseClient<Database>,
  params: {
    readonly fromLogicalDate: Date;
    readonly toLogicalDate: Date;
    readonly limit?: number;
    readonly offset?: number;
  },
): Promise<Result<readonly Transaction[]>> {
  const { fromLogicalDateString, toLogicalDateString } = logicalDateRangeKeys(params);
  let query = supabase
    .from("transactions")
    .select(TRANSACTION_SELECT_COLUMNS)
    .gte("logical_date", fromLogicalDateString)
    .lte("logical_date", toLogicalDateString)
    .order("logical_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.limit !== undefined) {
    const offset = params.offset ?? 0;
    if (offset < 0 || params.limit <= 0) {
      return { success: false, error: new Error("limit and offset must be valid for pagination") };
    }
    query = query.range(offset, offset + params.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function countTransactionsByLogicalDateRange(
  supabase: SupabaseClient<Database>,
  params: {
    readonly fromLogicalDate: Date;
    readonly toLogicalDate: Date;
  },
): Promise<Result<number>> {
  const { fromLogicalDateString, toLogicalDateString } = logicalDateRangeKeys(params);
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .gte("logical_date", fromLogicalDateString)
    .lte("logical_date", toLogicalDateString);

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data: count ?? 0 };
}

export async function sumTransactionAmountsByLogicalDateRange(
  supabase: SupabaseClient<Database>,
  params: {
    readonly fromLogicalDate: Date;
    readonly toLogicalDate: Date;
  },
): Promise<Result<number>> {
  const { fromLogicalDateString, toLogicalDateString } = logicalDateRangeKeys(params);
  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .gte("logical_date", fromLogicalDateString)
    .lte("logical_date", toLogicalDateString);

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  const total = data.reduce((sum, row) => sum + row.amount, 0);
  return { success: true, data: total };
}

export async function insertOwnTransaction(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: InsertTransactionInput,
): Promise<Result<Transaction>> {
  const logicalDate = getLogicalDate(new Date());
  const payload: TransactionInsert = {
    user_id: userId,
    amount: input.amount,
    memo: input.memo,
    type: input.type,
    utility_type: input.utility_type,
    logical_date: toJstDateString(logicalDate),
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select(TRANSACTION_SELECT_COLUMNS)
    .single();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function insertOwnSpecialTransactionAndDecrementSavings(
  supabase: SupabaseClient<Database>,
  input: {
    readonly amount: number;
    readonly memo: string | null;
  },
): Promise<Result<Transaction>> {
  const logicalDate = getLogicalDate(new Date());
  const logicalDateString = toJstDateString(logicalDate);

  const { data, error } = await supabase.rpc("create_special_transaction_and_decrement_savings", {
    p_amount: input.amount,
    p_memo: input.memo ?? "",
    p_logical_date: logicalDateString,
  });

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function deleteOwnTransactionById(
  supabase: Pick<SupabaseClient<Database>, "rpc">,
  transactionId: string,
): Promise<Result<Transaction | null>> {
  const { data, error } = await supabase.rpc("delete_own_transaction_and_restore_savings", {
    p_transaction_id: transactionId,
  });

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function deleteAllOwnTransactions(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Result<number>> {
  const { data, error } = await supabase.from("transactions").delete().eq("user_id", userId).select("id");

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data: data.length };
}
