import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert } from "@/lib/types/database";

type Profile = Tables<"profiles">;
type ProfileInsert = TablesInsert<"profiles">;

type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

const PROFILE_SELECT_COLUMNS =
  "id,target_amount,target_date,current_total_savings,monthly_income,payday,payday_rule,fixed_costs,estimated_electricity,estimated_gas,estimated_water,surplus_mode,initial_budget,created_at,updated_at";

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
