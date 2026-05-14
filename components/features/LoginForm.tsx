"use client";

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
      <p className="text-xs leading-relaxed text-zinc-500">
        Googleログインは Google の認証画面へ遷移します。認証情報およびアプリのデータは Supabase を通じて安全に扱われます。
      </p>
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">メールアドレス</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={isBusy}
          />
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className="min-h-11 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isEmailSubmitting ? "送信中..." : "メールでログイン"}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void handleGoogleLogin();
          }}
          className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-slate-900 disabled:opacity-60"
        >
          {isGoogleSubmitting ? "リダイレクト中..." : "Googleでログイン"}
        </button>
        {message.length > 0 ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {errorMessage.length > 0 ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      </form>
    </div>
  );
}
