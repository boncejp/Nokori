"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PAYDAY_RULE_VALUES,
  SURPLUS_MODE_VALUES,
} from "@/lib/logic/onboarding-validation";

type OnboardingFormValues = {
  target_amount: string;
  target_years: string;
  target_months: string;
  initial_total_assets: string;
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

const MONEY_FIELD_NAMES: readonly (keyof OnboardingFormValues)[] = [
  "target_amount",
  "initial_total_assets",
  "monthly_income",
  "fixed_costs",
  "estimated_electricity",
  "estimated_gas",
  "estimated_water",
  "initial_budget",
];

const STEP_FIELD_NAMES: readonly (keyof OnboardingFormValues)[] = [
  "target_amount",
  "target_years",
  "initial_total_assets",
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
  target_years: "0",
  target_months: "1",
  initial_total_assets: "",
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
      target_years: "達成期限",
      target_months: "達成期限（月）",
      initial_total_assets: "現在の全財産",
      monthly_income: "月収（手取り概算）",
      payday: "給料日",
      payday_rule: "給料日の補正ルール",
      fixed_costs: "固定費合計",
      estimated_electricity: "電気代概算",
      estimated_gas: "ガス代概算",
      estimated_water: "水道代概算",
      surplus_mode: "余剰金処理モード",
      initial_budget: "次の給料日まで使う予算",
    };
    return labels[currentFieldName];
  }, [currentFieldName]);

  const handleChangeValue = (fieldName: keyof OnboardingFormValues, value: string) => {
    if (isMoneyFieldName(fieldName)) {
      const numericOnlyValue = toNumericOnly(value);
      setFormValues((previousValues) => ({ ...previousValues, [fieldName]: numericOnlyValue }));
      return;
    }

    if (fieldName === "payday") {
      const numericOnlyValue = toNumericOnly(value);
      setFormValues((previousValues) => ({ ...previousValues, [fieldName]: numericOnlyValue }));
      return;
    }

    setFormValues((previousValues) => ({ ...previousValues, [fieldName]: value }));
  };

  const handleGoNext = () => {
    if (currentFieldName === "target_years") {
      const targetYears = Number(formValues.target_years);
      const targetMonths = Number(formValues.target_months);
      if (targetYears === 0 && targetMonths === 0) {
        setErrorMessage("達成期限は1か月以上になるように選択してください。");
        return;
      }
    }
    if (currentFieldName === "payday") {
      const payday = Number(formValues.payday);
      if (payday < 1 || payday > 31) {
        setErrorMessage("給料日は1〜31の範囲で入力してください。");
        return;
      }
    }

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

  const handleSave = async () => {
    if (!isLastStep) {
      return;
    }
    const lastFieldValue = formValues.initial_budget;
    if (lastFieldValue.length === 0) {
      setErrorMessage("次の給料日まで使う予算を入力してください。");
      return;
    }

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
    <form onSubmit={(event) => event.preventDefault()} className="w-full max-w-xl space-y-6 rounded-lg border p-4 sm:p-6">
      <p className="text-sm text-zinc-500">
        ステップ {currentStepIndex + 1} / {STEP_FIELD_NAMES.length}
      </p>
      <div className="space-y-2">
        <label htmlFor={currentFieldName} className="text-base font-medium">
          {currentStepLabel}
        </label>
        {currentFieldName === "target_years" ? (
          <p className="text-sm text-zinc-500">
            選択した期間のあとの給料日が、目標達成日として使われます。
          </p>
        ) : null}
        {currentFieldName === "initial_total_assets" ? (
          <div className="space-y-2 text-sm text-zinc-600">
            <p>
              初回サイクルでは、現在の全財産から「次の給料日まで使う予算」を切り出し、生活費として管理します。残りは資産側の金額として扱います。
            </p>
            <p>
              例: 全財産が 140,000円で、次の給料日までに使う予算が 50,000円の場合、90,000円が資産側として扱われます。
            </p>
          </div>
        ) : null}
        {currentFieldName === "initial_budget" ? (
          <div className="space-y-2 text-sm text-zinc-600">
            <p>次の給料日までに使う予定の金額です。現在の全財産を超えては入力できません。</p>
          </div>
        ) : null}
        {renderCurrentField({
          currentFieldName,
          formValues,
          onChange: handleChangeValue,
        })}
      </div>

      {errorMessage.length > 0 ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleGoBack}
          disabled={currentStepIndex === 0 || isSubmitting}
          className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          戻る
        </button>
        {isLastStep ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="min-h-11 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "保存中..." : "保存してダッシュボードへ"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGoNext}
            disabled={isSubmitting}
            className="min-h-11 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
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

  const helperTextByField: Partial<Record<keyof OnboardingFormValues, string>> = {
    target_amount: "例: 1,000,000（円）",
    initial_total_assets: "銀行口座・現金など、手元の全財産の合計（円）",
    monthly_income: "例: 260,000（円）",
    payday: "毎月の給料日を1〜31で入力してください（例: 25）。",
    fixed_costs: "毎月必ず固定でかかり、金額の変動しない支出の合計額を入力してください。",
    initial_budget: "次の給料日までに使う予定の金額（円）",
  };
  const helperText = helperTextByField[currentFieldName];

  if (currentFieldName === "target_years") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="target_years" className="text-sm text-zinc-600">
            年
          </label>
          <select
            id="target_years"
            value={formValues.target_years}
            onChange={(event) => onChange("target_years", event.target.value)}
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
          >
            {Array.from({ length: 21 }, (_, year) => (
              <option key={year} value={String(year)}>
                {year}年
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="target_months" className="text-sm text-zinc-600">
            月
          </label>
          <select
            id="target_months"
            value={formValues.target_months}
            onChange={(event) => onChange("target_months", event.target.value)}
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
          >
            {Array.from({ length: 12 }, (_, month) => (
              <option key={month} value={String(month)}>
                {month}か月
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (currentFieldName === "payday_rule") {
    return (
      <select
        id={currentFieldName}
        value={value}
        onChange={(event) => onChange(currentFieldName, event.target.value)}
        className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
      >
        <option value="BEFORE">前倒し（土日祝は前の平日へ）</option>
        <option value="AFTER">後ろ倒し（土日祝は次の平日へ）</option>
        <option value="FIXED">固定（土日祝も給料日のまま）</option>
      </select>
    );
  }

  if (currentFieldName === "surplus_mode") {
    return (
      <select
        id={currentFieldName}
        value={value}
        onChange={(event) => onChange(currentFieldName, event.target.value)}
        className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
      >
        <option value="STRICT">厳格（余剰は貯金へ）</option>
        <option value="YUTORI">ゆとり（余剰は翌月の予算へ）</option>
      </select>
    );
  }

  const isPaydayField = currentFieldName === "payday";
  const inputValue = isMoneyFieldName(currentFieldName) ? formatNumberWithCommas(value) : value;
  return (
    <div className="space-y-2">
      <input
        id={currentFieldName}
        type={isPaydayField ? "number" : "text"}
        inputMode="numeric"
        min={isPaydayField ? 1 : undefined}
        max={isPaydayField ? 31 : undefined}
        placeholder={isMoneyFieldName(currentFieldName) ? "例: 1,000,000" : undefined}
        value={inputValue}
        onChange={(event) => onChange(currentFieldName, event.target.value)}
        className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
      />
      {helperText ? <p className="text-sm text-zinc-500">{helperText}</p> : null}
    </div>
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

function toNumericOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function formatNumberWithCommas(value: string): string {
  if (value.length === 0) {
    return "";
  }
  const normalizedValue = String(Number(value));
  return normalizedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function isMoneyFieldName(fieldName: keyof OnboardingFormValues): boolean {
  return MONEY_FIELD_NAMES.includes(fieldName);
}
