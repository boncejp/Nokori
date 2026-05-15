"use client";

import Link from "next/link";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [email, setEmail] = useState("");
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(() =>
    oauthCallbackErrorMessage(authErrorFromCallback),
  );

  const isBusy = isEmailSubmitting || isGoogleSubmitting;

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!EMAIL_REGEX.test(email)) {
      setErrorMessage("有効なメールアドレスを入力してください。");
      return;
    }

    setIsEmailSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = buildAuthCallbackUrl();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setErrorMessage("ログインメールの送信に失敗しました。時間をおいて再試行してください。");
        return;
      }

      setMessage("ログイン用メールを送信しました。受信ボックスを確認してください。");
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setMessage("");
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
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-nokori-text">
          <span className="text-sm font-medium">メールアドレス</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-base text-nokori-text shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 sm:text-sm"
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={isBusy}
          />
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className="min-h-11 rounded-md bg-nokori-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-nokori-navy-soft disabled:opacity-60"
        >
          {isEmailSubmitting ? "送信中..." : "メールでログイン"}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void handleGoogleLogin();
          }}
          className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm font-medium text-nokori-navy shadow-sm transition hover:bg-nokori-subtle disabled:opacity-60"
        >
          {isGoogleSubmitting ? "リダイレクト中..." : "Googleでログイン"}
        </button>
        {message.length > 0 ? <p className="text-sm text-emerald-800">{message}</p> : null}
        {errorMessage.length > 0 ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      </form>
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
