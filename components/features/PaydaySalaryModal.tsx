"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PaydaySalaryModalProps = {
  readonly salaryPrompt: {
    readonly cycleStartLogicalDate: string;
    readonly currentMonthlyIncome: number;
  };
};

export function PaydaySalaryModal({ salaryPrompt }: PaydaySalaryModalProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(salaryPrompt.currentMonthlyIncome));
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setErrorMessage("手取りは1円以上の整数で入力してください。");
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
      const message =
        typeof body === "object" &&
        body !== null &&
        "errorMessage" in body &&
        typeof body.errorMessage === "string"
          ? body.errorMessage
          : "保存に失敗しました。";

      if (!response.ok) {
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
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">
        <h2 id="payday-salary-title" className="text-lg font-semibold text-slate-900">
          今月の手取り給料
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          給料日の記録として、今サイクルに使う手取り概算を入力してください。予算の基準（月収 − 固定費合計 −
          光熱費概算 − 月次貯金ノルマ）に反映されます。
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>手取り（円）</span>
            <input
              type="number"
              min={1}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
            />
          </label>
          {errorMessage.length > 0 ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-11 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "保存中..." : "確定して続ける"}
          </button>
        </form>
      </div>
    </div>
  );
}
