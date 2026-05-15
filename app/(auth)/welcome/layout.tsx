import { AppBrandHeader } from "@/components/layout/AppBrandHeader";

type WelcomeLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function WelcomeLayout({ children }: WelcomeLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppBrandHeader brandHref={null} />
      {children}
    </div>
  );
}
