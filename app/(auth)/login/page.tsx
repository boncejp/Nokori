import { redirect } from "next/navigation";

import { LoginForm } from "@/components/features/LoginForm";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="w-full max-w-md space-y-2">
        <h1 className="text-2xl font-semibold">Nokori にログイン</h1>
        <p className="text-sm text-zinc-600">
          メールリンクでログインできます。初回ログイン後はオンボーディングに進みます。
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
