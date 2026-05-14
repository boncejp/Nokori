import { redirect } from "next/navigation";

import { NokoriAppIcon } from "@/components/brand/NokoriAppIcon";
import { LoginForm } from "@/components/features/LoginForm";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ auth_error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const authErrorRaw = resolvedSearchParams.auth_error;
  const authErrorValue = Array.isArray(authErrorRaw) ? authErrorRaw[0] : authErrorRaw;
  const authErrorFromCallback = authErrorValue === "oauth";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profileResult = await fetchProfileByUserId(supabase, user.id);
    if (profileResult.success) {
      redirect("/dashboard");
    }
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center sm:items-start sm:text-left">
        <NokoriAppIcon size={72} priority className="rounded-2xl shadow-sm ring-1 ring-nokori-border/80" />
        <div className="w-full space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-nokori-navy">Nokori にログイン</h1>
          <p className="text-sm text-nokori-muted">
            メールリンクまたは Google でログインできます。初回ログイン後はオンボーディングに進みます。
          </p>
        </div>
      </div>
      <LoginForm authErrorFromCallback={authErrorFromCallback} />
    </main>
  );
}
