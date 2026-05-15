import { redirect } from "next/navigation";

import { resolvePostAuthLandingPath } from "@/lib/routing/post-auth-landing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirect(await resolvePostAuthLandingPath(supabase, user.id));
}
