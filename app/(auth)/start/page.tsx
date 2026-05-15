import { redirect } from "next/navigation";

import { StartConceptExperience } from "@/components/features/StartConceptExperience";
import { resolvePostAuthLandingPath } from "@/lib/routing/post-auth-landing";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StartPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileResult = await fetchProfileByUserId(supabase, user.id);
  if (!profileResult.success) {
    redirect(await resolvePostAuthLandingPath(supabase, user.id));
  }

  if (profileResult.data.start_concept_completed_at !== null) {
    redirect("/dashboard");
  }

  return <StartConceptExperience />;
}
