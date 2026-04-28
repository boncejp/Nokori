"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PAYDAY_RULE_VALUES,
  SURPLUS_MODE_VALUES,
} from "@/lib/logic/onboarding-validation";

type OnboardingFormValues = {
  target_amount: string;
  target_date: string;
  current_total_savings: string;
  monthly_income: string;
  payday: string;
  payday_rule: string;
  fixed_costs: string;
  estimated_electricity: string;
  estimated_gas: string;
  estimated_water: string;
  surplus_mode: string;
  initial_budget: string;
};

const STEP_FIELD_NAMES: readonly (keyof OnboardingFormValues)[] = [
  "target_amount",
  "target_date",
  "current_total_savings",
  "monthly_income",
  "payday",
  "payday_rule",
  "fixed_costs",
  "estimated_electricity",
  "estimated_gas",
  "estimated_water",
  "surplus_mode",
  "initial_budget",
];

const INITIAL_FORM_VALUES: OnboardingFormValues = {
  target_amount: "",
  target_date: "",
  current_total_savings: "",
  monthly_income: "",
  payday: "",
  payday_rule: PAYDAY_RULE_VALUES[0],
  fixed_costs: "",
  estimated_electricity: "",
  estimated_gas: "",
  estimated_water: "",
  surplus_mode: SURPLUS_MODE_VALUES[0],
  initial_budget: "",
};

export function OnboardingStepForm() {
  const [formValues, setFormValues] = useState<OnboardingFormValues>(INITIAL_FORM_VALUES);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const isLastStep = currentStepIndex === STEP_FIELD_NAMES.length - 1;
  const currentFieldName = STEP_FIELD_NAMES[currentStepIndex];

  const currentStepLabel = useMemo(() => {
    const labels: Record<keyof OnboardingFormValues, string> = {
      target_amount: "最終目標金額",
      target_date: "達成期限",
      current_total_savings: "現在の貯金総額",
      monthly_income: "月収（手取り概算）",
      payday: "給料日",
      payday_rule: "給料日の補正ルール",
      fixed_costs: "固定費合計",
      estimated_electricity: "電気代概算",
      estimated_gas: "ガス代概算",
      estimated_water: "水道代概算",
      surplus_mode: "余剰金処理モード",
      initial_budget: "初回開始予算",
    };
    return labels[currentFieldName];
  }, [currentFieldName]);

  const handleChangeValue = (fieldName: keyof OnboardingFormValues, value: string) => {
    setFormValues((previousValues) => ({ ...previousValues, [fieldName]: value }));
  };

  const handleGoNext = () => {
    const currentValue = formValues[currentFieldName];
    if (typeof currentValue !== "string" || currentValue.length === 0) {
      setErrorMessage(`${currentStepLabel}を入力してください。`);
      return;
    }
    setErrorMessage("");
    setCurrentStepIndex((previousIndex) => Math.min(previousIndex + 1, STEP_FIELD_NAMES.length - 1));
  };

  const handleGoBack = () => {
    setErrorMessage("");
    setCurrentStepIndex((previousIndex) => Math.max(previousIndex - 1, 0));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      });

      const body: unknown = await response.json();
      const apiErrorMessage = getErrorMessageFromResponseBody(body);
      if (!response.ok || apiErrorMessage) {
        setErrorMessage(apiErrorMessage ?? "設定の保存に失敗しました。");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました。ネットワークを確認して再試行してください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-6 rounded-lg border p-6">
      <p className="text-sm text-zinc-500">
        Step {currentStepIndex + 1} / {STEP_FIELD_NAMES.length}
      </p>
      <div className="space-y-2">
        <label htmlFor={currentFieldName} className="text-base font-medium">
          {currentStepLabel}
        </label>
        {renderCurrentField({
          currentFieldName,
          formValues,
          onChange: handleChangeValue,
        })}
      </div>

      {errorMessage.length > 0 ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleGoBack}
          disabled={currentStepIndex === 0 || isSubmitting}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          戻る
        </button>
        {isLastStep ? (
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {isSubmitting ? "保存中..." : "保存してダッシュボードへ"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGoNext}
            disabled={isSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            次へ
          </button>
        )}
      </div>
    </form>
  );
}

function renderCurrentField(params: {
  readonly currentFieldName: keyof OnboardingFormValues;
  readonly formValues: OnboardingFormValues;
  readonly onChange: (fieldName: keyof OnboardingFormValues, value: string) => void;
}) {
  const { currentFieldName, formValues, onChange } = params;
  const value = formValues[currentFieldName];

  if (currentFieldName === "target_date") {
    return (
      <input
        id={currentFieldName}
        type="date"
        value={value}
        onChange={(event) => onChange(currentFieldName, event.target.value)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2"
      />
    );
  }

  if (currentFieldName === "payday_rule") {
    return (
      <select
        id={currentFieldName}
        value={value}
        onChange={(event) => onChange(currentFieldName, event.target.value)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2"
      >
        <option value="BEFORE">BEFORE（土日祝は前倒し）</option>
        <option value="AFTER">AFTER（土日祝は後ろ倒し）</option>
        <option value="FIXED">FIXED（補正なし）</option>
      </select>
    );
  }

  if (currentFieldName === "surplus_mode") {
    return (
      <select
        id={currentFieldName}
        value={value}
        onChange={(event) => onChange(currentFieldName, event.target.value)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2"
      >
        <option value="STRICT">STRICT（余剰は貯金へ）</option>
        <option value="YUTORI">YUTORI（余剰は翌月へ）</option>
      </select>
    );
  }

  const isPaydayField = currentFieldName === "payday";
  return (
    <input
      id={currentFieldName}
      type="number"
      min={isPaydayField ? 1 : 0}
      max={isPaydayField ? 31 : undefined}
      value={value}
      onChange={(event) => onChange(currentFieldName, event.target.value)}
      className="w-full rounded-md border border-zinc-300 px-3 py-2"
    />
  );
}

function getErrorMessageFromResponseBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  if (!("errorMessage" in body)) {
    return null;
  }

  const { errorMessage } = body;
  if (typeof errorMessage !== "string") {
    return null;
  }
  return errorMessage;
}
