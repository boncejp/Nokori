import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

type Profile = Tables<"profiles">;
type ProfileInsert = TablesInsert<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;

type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

const PROFILE_SELECT_COLUMNS =
  "id,target_amount,target_date,target_duration_months,target_anchor_logical_date,current_total_savings,monthly_income,payday,payday_rule,fixed_costs,estimated_electricity,estimated_gas,estimated_water,surplus_mode,initial_budget,last_monthly_reset_logical_date,last_salary_cycle_logical_date,created_at,updated_at";

export async function fetchProfileByUserId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Result<Profile>> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .eq("id", userId)
    .single();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function upsertOwnProfile(
  supabase: SupabaseClient<Database>,
  profile: ProfileInsert,
): Promise<Result<Profile>> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select(PROFILE_SELECT_COLUMNS)
    .single();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function deleteOwnProfileById(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Result<Profile | null>> {
  const { data, error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId)
    .select(PROFILE_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function updateOwnProfileByUserId(
  supabase: SupabaseClient<Database>,
  userId: string,
  updates: ProfileUpdate,
): Promise<Result<Profile>> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select(PROFILE_SELECT_COLUMNS)
    .single();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function applyMonthlyResetForLogicalDate(
  supabase: SupabaseClient<Database>,
  params: {
    readonly userId: string;
    readonly logicalDate: string;
    readonly nextTotalSavings: number;
    readonly nextInitialBudget: number;
  },
): Promise<Result<{ readonly applied: boolean; readonly profile: Profile | null }>> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      current_total_savings: params.nextTotalSavings,
      initial_budget: params.nextInitialBudget,
      last_monthly_reset_logical_date: params.logicalDate,
    })
    .eq("id", params.userId)
    .or(
      `last_monthly_reset_logical_date.is.null,last_monthly_reset_logical_date.neq.${params.logicalDate}`,
    )
    .select(PROFILE_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return {
    success: true,
    data: {
      applied: data !== null,
      profile: data,
    },
  };
}
