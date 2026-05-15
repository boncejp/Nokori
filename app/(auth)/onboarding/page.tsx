import Link from "next/link";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 text-nokori-text">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-nokori-navy">初期設定</h1>
        <p className="text-sm text-nokori-muted">
          貯金目標と月次の前提を入力します。完了後、ダッシュボードへ移動します。
        </p>
        <p className="text-xs leading-relaxed text-nokori-muted">
          本サービスの利用により、
          <Link href="/legal/terms" className="text-nokori-navy underline underline-offset-2">
            利用規約
          </Link>
          および
          <Link href="/legal/privacy" className="text-nokori-navy underline underline-offset-2">
            プライバシーポリシー
          </Link>
          に同意したものとみなします。
        </p>
      </div>
      <OnboardingStepForm />
    </main>
  );
}
