import Link from "next/link";

export function BetaNotice() {
  return (
    <footer
      className="mt-auto shrink-0 border-t border-zinc-200/80 bg-zinc-50/90 px-4 py-2.5 text-center text-[11px] leading-snug text-zinc-600 sm:text-xs"
      role="note"
    >
      <p>試用版（ベータ）です。不具合やご要望はオーナーに直接お知らせください。</p>
      <nav
        className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-zinc-500"
        aria-label="法務情報"
      >
        <Link href="/legal/terms" className="underline underline-offset-2 hover:text-zinc-700">
          利用規約
        </Link>
        <span className="text-zinc-300" aria-hidden>
          ·
        </span>
        <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-zinc-700">
          プライバシーポリシー
        </Link>
      </nav>
    </footer>
  );
}
