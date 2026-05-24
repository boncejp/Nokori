"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getErrorMessageFromResponseBody } from "@/lib/logic/api-response-parsing";
import { formatDigitsWithCommas, toNumericOnly } from "@/lib/logic/money-input-format";

type PaydaySalaryModalProps = {
  readonly salaryPrompt: {
    readonly cycleStartLogicalDate: string;
    readonly currentMonthlyIncome: number;
  };
};

export function PaydaySalaryModal({ salaryPrompt }: PaydaySalaryModalProps) {
  const router = useRouter();
  // 桁のみを状態として保持し、表示は千区切りフォーマットを適用する（設定画面と同じパターン）
  const [numericValue, setNumericValue] = useState(
    salaryPrompt.currentMonthlyIncome > 0 ? String(salaryPrompt.currentMonthlyIncome) : "",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumericValue(toNumericOnly(e.target.value));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const parsed = Number(numericValue);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setErrorMessage("手取り額は1円以上の整数で入力してください。");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/salary-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyIncome: Math.floor(parsed),
          cycleStartLogicalDate: salaryPrompt.cycleStartLogicalDate,
        }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const message =
          getErrorMessageFromResponseBody(body) ?? "保存に失敗しました。時間をおいて再試行してください。";
        setErrorMessage(message);
        setIsSaving(false);
        return;
      }

      await router.refresh();
      setIsSaving(false);
    } catch {
      setErrorMessage("通信に失敗しました。ネットワークを確認し、もう一度お試しください。");
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payday-salary-title"
    >
      <div className="max-w-md rounded-xl border border-nokori-border bg-nokori-surface p-6 shadow-xl">
        <h2 id="payday-salary-title" className="text-lg font-semibold text-nokori-navy">
          このサイクルの手取り額
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-nokori-muted">
          給料日の記録として、このサイクルに使う手取り額を入力してください。予算の基準（手取り額 − 固定費合計 −
          光熱費概算 − 月次貯金ノルマ）に反映されます。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-nokori-muted">
          ボーナスや臨時収入がある月は、通常の手取り額に足した合計額を入力してください。翌月から元の水準に戻す場合は、次の給料日にあらためて入力し直してください。
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-sm text-nokori-text">
            <span>手取り額（円）</span>
            <input
              type="text"
              inputMode="numeric"
              required
              value={formatDigitsWithCommas(numericValue)}
              onChange={handleChange}
              placeholder="例: 260,000"
              className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-base text-nokori-text shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 sm:text-sm"
            />
          </label>
          {errorMessage.length > 0 ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-11 w-full rounded-md bg-nokori-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-nokori-navy-soft disabled:opacity-60"
          >
            {isSaving ? "保存中..." : "確定して続ける"}
          </button>
        </form>
      </div>
    </div>
  );
}
