import { redirect } from "next/navigation";

import { WelcomeExperience } from "@/components/features/WelcomeExperience";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserWelcomeByUserId } from "@/lib/supabase/user-welcome";

export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (profileResult.success) {
    redirect("/dashboard");
  }

  const welcomeResult = await fetchUserWelcomeByUserId(supabase, user.id);
  if (welcomeResult.success && welcomeResult.data !== null) {
    redirect("/onboarding");
  }

  return <WelcomeExperience />;
}
