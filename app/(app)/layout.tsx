import { redirect } from "next/navigation";

import { AppBrandHeader } from "@/components/layout/AppBrandHeader";
import { BetaNotice } from "@/components/layout/BetaNotice";
import { resolvePostAuthLandingPath } from "@/lib/routing/post-auth-landing";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AppLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function AppLayout({ children }: AppLayoutProps) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppBrandHeader />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <BetaNotice />
    </div>
  );
}
