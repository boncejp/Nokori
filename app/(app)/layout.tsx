import Link from "next/link";
import { redirect } from "next/navigation";

import { NokoriAppIcon } from "@/components/brand/NokoriAppIcon";
import { BetaNotice } from "@/components/layout/BetaNotice";
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
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-nokori-border bg-nokori-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-md py-0.5 outline-offset-4 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nokori-navy/35"
          >
            <NokoriAppIcon size={40} className="rounded-xl shadow-sm ring-1 ring-nokori-border/70" />
            <span className="text-lg font-semibold tracking-tight text-nokori-navy">Nokori</span>
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <BetaNotice />
    </div>
  );
}
