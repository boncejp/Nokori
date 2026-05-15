import Link from "next/link";

import { NokoriAppIcon } from "@/components/brand/NokoriAppIcon";

const BRAND_LINK_CLASS =
  "flex items-center gap-2.5 rounded-md py-0.5 outline-offset-4 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nokori-navy/35";

type AppBrandHeaderProps = Readonly<{
  /**
   * ブランド行の遷移先。`null` のときはリンクにしない。
   * プロフィール未完了のオンボーディングでは、ダッシュボードへ飛べる印象を避けるため `null` を使う。
   */
  brandHref?: string | null;
}>;

export function AppBrandHeader({ brandHref = "/dashboard" }: AppBrandHeaderProps) {
  const inner = (
    <>
      <NokoriAppIcon size={40} className="rounded-xl shadow-sm ring-1 ring-nokori-border/70" />
      <span className="text-lg font-semibold tracking-tight text-nokori-navy">Nokori</span>
    </>
  );

  return (
    <header className="shrink-0 border-b border-nokori-border bg-nokori-surface px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center">
        {brandHref != null ? (
          <Link href={brandHref} className={BRAND_LINK_CLASS}>
            {inner}
          </Link>
        ) : (
          <div className="flex items-center gap-2.5 py-0.5" aria-label="Nokori">
            {inner}
          </div>
        )}
      </div>
    </header>
  );
}
