import { AppBrandHeader } from "@/components/layout/AppBrandHeader";

type OnboardingLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* プロフィール未完了のためダッシュボードへのリンクは付けない（遷移できない印象を避ける） */}
      <AppBrandHeader brandHref={null} />
      {children}
    </div>
  );
}
