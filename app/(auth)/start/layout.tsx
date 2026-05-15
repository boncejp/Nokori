import { AppBrandHeader } from "@/components/layout/AppBrandHeader";

type StartLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function StartLayout({ children }: StartLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppBrandHeader brandHref={null} />
      {children}
    </div>
  );
}
