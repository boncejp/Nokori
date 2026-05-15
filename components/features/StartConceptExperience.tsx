"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NokoriAppIcon } from "@/components/brand/NokoriAppIcon";

const FADE_DELAYS_SEC = [
  "0.18s",
  "0.26s",
  "0.34s",
  "0.42s",
  "0.5s",
  "0.58s",
  "0.66s",
  "0.74s",
  "0.82s",
  "0.9s",
] as const;

function fadeDelayStyle(index: number): CSSProperties {
  return {
    animationDelay: FADE_DELAYS_SEC[Math.min(index, FADE_DELAYS_SEC.length - 1)],
  };
}

export function StartConceptExperience() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/start-concept/complete", { method: "POST" });
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
      router.push("/dashboard");
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
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <div className="welcome-panel mx-auto w-full max-w-lg rounded-3xl border border-nokori-border/80 bg-nokori-surface/95 shadow-[0_24px_80px_-12px_rgba(0,31,63,0.18)] ring-1 ring-nokori-navy/5 backdrop-blur-md">
          <div className="max-h-[min(78vh,calc(100dvh-8rem))] overflow-y-auto overscroll-contain px-6 py-8 sm:px-10 sm:py-10">
            <div className="welcome-icon flex justify-center">
              <NokoriAppIcon
                size={88}
                priority
                className="rounded-[22px] shadow-lg ring-2 ring-nokori-border/60"
              />
            </div>
            <div className="welcome-heading mt-8 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-nokori-navy sm:text-3xl">
                このアプリの考え方
              </h1>
              <p
                className="start-concept-fade-in mt-3 text-sm text-nokori-muted sm:text-[15px]"
                style={fadeDelayStyle(0)}
              >
                Nokoriの使い方をご説明します。※あとから設定やヘルプでも確認できます
              </p>
            </div>

            <div className="mt-8 space-y-8 text-sm leading-relaxed text-nokori-text sm:text-[15px]">
              <section className="space-y-3">
                <h2
                  className="start-concept-fade-in text-xs font-semibold uppercase tracking-wider text-nokori-navy/80"
                  style={fadeDelayStyle(1)}
                >
                  1. サイクルについて
                </h2>
                <p className="start-concept-fade-in" style={fadeDelayStyle(2)}>
                  前の給料日から、次の給料日までをひとつのサイクルとして扱います。あなたが登録した貯金目標から、月あたりいくら貯めるかを自動計算し、そのサイクル内で毎日「残りあといくらまで使えるか」をダッシュボードに出します。
                </p>
              </section>

              <section className="space-y-3">
                <h2
                  className="start-concept-fade-in text-xs font-semibold uppercase tracking-wider text-nokori-navy/80"
                  style={fadeDelayStyle(3)}
                >
                  2. はじめのサイクルだけ、少し特別
                </h2>
                <p className="start-concept-fade-in" style={fadeDelayStyle(4)}>
                  登録直後から次の給料日の前日までの「初回サイクル」は、2回目以降の通常サイクルとは別ルールです。ここではシンプルに、初期設定で登録した「次の給料日まで使う予算」を残り日数で割り、算出された値がダッシュボードに表示されます。
                </p>
              </section>

              <section className="space-y-3">
                <h2
                  className="start-concept-fade-in text-xs font-semibold uppercase tracking-wider text-nokori-navy/80"
                  style={fadeDelayStyle(5)}
                >
                  3. おすすめの使い方
                </h2>
                <ol
                  className="start-concept-fade-in list-decimal space-y-2 pl-5 marker:font-semibold marker:text-nokori-navy"
                  style={fadeDelayStyle(6)}
                >
                  <li>支出のたびにアプリをさっと開き、金額だけ入力する。</li>
                  <li>今日の残り予算を超えないよう、ざっくり意識する。</li>
                  <li>
                    万が一超えた場合は、翌日以降の目安予算も更新されます。ダッシュボードで「どこまでなら使ってもいいか」を確認してください。
                  </li>
                </ol>
              </section>

              <section
                className="start-concept-pwa rounded-2xl border border-nokori-border/70 bg-nokori-subtle/80 px-4 py-4 sm:px-5"
                aria-labelledby="start-concept-pwa-heading"
              >
                <h2
                  id="start-concept-pwa-heading"
                  className="text-sm font-semibold text-nokori-navy"
                >
                  スマホのホーム画面にNokoriを設置するのがおすすめ
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-nokori-muted sm:text-sm">
                  本アプリはWebアプリですが、ブラウザの「ホーム画面に追加」や「アプリとしてインストール」でスマホのホーム画面に置いておくと、いつでもすぐに開けるのでレジのあとでもすぐに金額が記録できるようになります。iOS
                  は Safari の共有メニュー、Android はメニュー内の「ホームに追加」、PC の Chrome などではメニューからインストールできる場合があります。
                </p>
              </section>
            </div>

            <div className="start-concept-cta mt-10 flex flex-col items-center gap-3">
              {errorMessage ? (
                <p className="text-center text-sm text-red-700" role="alert">
                  {errorMessage}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleContinue}
                disabled={isSubmitting}
                className="start-concept-cta min-h-12 w-full max-w-xs rounded-xl bg-nokori-navy px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-nokori-navy-soft disabled:opacity-60 sm:min-h-11"
              >
                {isSubmitting ? "保存しています…" : "ダッシュボードへ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
