"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { NokoriAppIcon } from "@/components/brand/NokoriAppIcon";

export function WelcomeExperience() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/welcome/complete", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          typeof body === "object" &&
          body !== null &&
          "errorMessage" in body &&
          typeof (body as { errorMessage: unknown }).errorMessage === "string"
            ? (body as { errorMessage: string }).errorMessage
            : "保存に失敗しました。もう一度お試しください。";
        setErrorMessage(msg);
        setIsSubmitting(false);
        return;
      }
      router.push("/onboarding");
    } catch {
      setErrorMessage("通信に失敗しました。接続を確認して再度お試しください。");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="welcome-ambient pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(0,31,63,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_50%,rgba(13,51,88,0.1),transparent_50%),radial-gradient(ellipse_80%_50%_at_0%_80%,rgba(0,31,63,0.08),transparent_45%)]"
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="welcome-panel w-full max-w-lg rounded-3xl border border-nokori-border/80 bg-nokori-surface/95 p-8 shadow-[0_24px_80px_-12px_rgba(0,31,63,0.18)] ring-1 ring-nokori-navy/5 backdrop-blur-md sm:p-10">
          <div className="welcome-icon flex justify-center">
            <NokoriAppIcon
              size={88}
              priority
              className="rounded-[22px] shadow-lg ring-2 ring-nokori-border/60"
            />
          </div>
          <div className="welcome-heading mt-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-nokori-navy sm:text-3xl">
              Nokori へようこそ
            </h1>
          </div>
          <div className="welcome-copy mt-6 space-y-4 text-center text-sm leading-relaxed text-nokori-text sm:text-[15px]">
            <p className="welcome-line">
              「今日残りあといくら使えるか」がひと目で分かり、貯金目標達成に向けた毎日の予算管理の意思決定をサポートします。
            </p>
            <p className="welcome-line">
              精神的なゆとりを保ちながらゴールに近づいていく伴走型のアプリ体験を目指しています。
            </p>
            <p className="welcome-line text-nokori-muted">
              まずは初期設定にお進みください。
            </p>
          </div>
          <div className="welcome-actions mt-10 flex flex-col items-center gap-3">
            {errorMessage ? (
              <p className="text-center text-sm text-red-700" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSubmitting}
              className="welcome-cta min-h-12 w-full max-w-xs rounded-xl bg-nokori-navy px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-nokori-navy-soft disabled:opacity-60 sm:min-h-11"
            >
              {isSubmitting ? "保存しています…" : "はじめる"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
