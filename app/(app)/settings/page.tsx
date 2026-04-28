import { redirect } from "next/navigation";

import { SettingsClient } from "@/components/features/SettingsClient";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    redirect("/onboarding");
  }

  const profile = profileResult.data;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <SettingsClient
        initialValues={{
          target_amount: String(profile.target_amount),
          target_date: profile.target_date,
          current_total_savings: String(profile.current_total_savings),
          monthly_income: String(profile.monthly_income),
          payday: String(profile.payday),
          payday_rule: profile.payday_rule,
          fixed_costs: String(profile.fixed_costs),
          estimated_electricity: String(profile.estimated_electricity),
          estimated_gas: String(profile.estimated_gas),
          estimated_water: String(profile.estimated_water),
          surplus_mode: profile.surplus_mode,
          initial_budget: String(profile.initial_budget),
        }}
      />
    </main>
  );
}
