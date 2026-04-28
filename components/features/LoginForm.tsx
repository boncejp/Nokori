"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!EMAIL_REGEX.test(email)) {
      setErrorMessage("有効なメールアドレスを入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
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
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleEmailLogin} className="flex w-full max-w-md flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">メールアドレス</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {isSubmitting ? "送信中..." : "Emailでログイン"}
      </button>
      <button
        type="button"
        disabled
        className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-500"
      >
        Googleログイン（準備中）
      </button>
      {message.length > 0 ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {errorMessage.length > 0 ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </form>
  );
}
