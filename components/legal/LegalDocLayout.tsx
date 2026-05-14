import Link from "next/link";
import type { ReactNode } from "react";

type LegalDocLayoutProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function LegalDocLayout({ title, children }: LegalDocLayoutProps) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          href="/legal/terms"
          className="text-zinc-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          利用規約
        </Link>
        <Link
          href="/legal/privacy"
          className="text-zinc-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          プライバシーポリシー
        </Link>
        <Link
          href="/login"
          className="text-zinc-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          ログイン
        </Link>
      </nav>
      <article className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-xs text-zinc-500">最終更新日：2026年5月14日</p>
        </header>
        <div className="space-y-8 text-sm leading-relaxed text-zinc-700 sm:text-[15px]">{children}</div>
      </article>
    </main>
  );
}

type LegalSectionProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
