import { redirect } from "next/navigation";

import { OnboardingStepForm } from "@/components/features/OnboardingStepForm";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">初期設定</h1>
        <p className="text-sm text-zinc-600">
          貯金目標と月次の前提を入力します。完了後、ダッシュボードへ移動します。
        </p>
      </div>
      <OnboardingStepForm />
    </main>
  );
}
