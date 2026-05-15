import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/lib/types/database";

type UserWelcomeRow = Tables<"user_welcome">;

type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

const USER_WELCOME_SELECT = "user_id,completed_at";

export async function fetchUserWelcomeByUserId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Result<UserWelcomeRow | null>> {
  const { data, error } = await supabase
    .from("user_welcome")
    .select(USER_WELCOME_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}

export async function upsertUserWelcomeCompleted(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Result<UserWelcomeRow>> {
  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_welcome")
    .upsert({ user_id: userId, completed_at: completedAt }, { onConflict: "user_id" })
    .select(USER_WELCOME_SELECT)
    .single();

  if (error) {
    return { success: false, error: new Error(error.message) };
  }

  return { success: true, data };
}
