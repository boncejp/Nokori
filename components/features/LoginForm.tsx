"use client";

import Link from "next/link";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function buildAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

function oauthCallbackErrorMessage(fromCallback: boolean): string {
  return fromCallback
    ? "Googleログインを完了できませんでした。時間をおいて再試行してください。"
    : "";
}

type LoginFormProps = {
  authErrorFromCallback?: boolean;
};

export function LoginForm({ authErrorFromCallback = false }: LoginFormProps) {
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(() =>
    oauthCallbackErrorMessage(authErrorFromCallback),
  );

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setIsGoogleSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthCallbackUrl(),
        },
      });

      if (error) {
        setErrorMessage("Googleログインの開始に失敗しました。時間をおいて再試行してください。");
        return;
      }

      const oauthUrl = data.url;
      if (typeof oauthUrl !== "string" || oauthUrl.length === 0) {
        setErrorMessage("Googleログインの開始に失敗しました。時間をおいて再試行してください。");
        return;
      }

      window.location.assign(oauthUrl);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-4">
        <button
          type="button"
          disabled={isGoogleSubmitting}
          onClick={() => {
            void handleGoogleLogin();
          }}
          className="min-h-11 rounded-md bg-nokori-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-nokori-navy-soft disabled:opacity-60"
        >
          {isGoogleSubmitting ? "リダイレクト中..." : "Googleでログイン"}
        </button>
        {errorMessage.length > 0 ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      </div>
      <p className="text-xs leading-relaxed text-nokori-muted">
        ログインまたは本サービスの利用により、
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
  );
}
