"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PAYDAY_RULE_VALUES, SURPLUS_MODE_VALUES } from "@/lib/logic/onboarding-validation";

type SettingsFormValues = {
  target_amount: string;
  target_years: string;
  target_months: string;
  target_date_display: string;
  current_total_savings_display: string;
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

type SettingsClientProps = {
  readonly initialValues: SettingsFormValues;
  readonly monthlySavingsQuota: number | null;
  readonly showMonthlySavingsQuota: boolean;
};

const REQUIRED_RESET_TEXT = "RESET";

export function SettingsClient({
  initialValues,
  monthlySavingsQuota,
  showMonthlySavingsQuota,
}: SettingsClientProps) {
  const [formValues, setFormValues] = useState<SettingsFormValues>(initialValues);
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [formSuccessMessage, setFormSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetErrorMessage, setResetErrorMessage] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const router = useRouter();

  const handleChangeValue = (fieldName: keyof SettingsFormValues, value: string) => {
    setFormValues((previousValues) => ({ ...previousValues, [fieldName]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrorMessage("");
    setFormSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_amount: formValues.target_amount,
          target_years: formValues.target_years,
          target_months: formValues.target_months,
          monthly_income: formValues.monthly_income,
          payday: formValues.payday,
          payday_rule: formValues.payday_rule,
          fixed_costs: formValues.fixed_costs,
          estimated_electricity: formValues.estimated_electricity,
          estimated_gas: formValues.estimated_gas,
          estimated_water: formValues.estimated_water,
          surplus_mode: formValues.surplus_mode,
          initial_budget: formValues.initial_budget,
        }),
      });
      const body: unknown = await response.json();
      const apiErrorMessage = getErrorMessageFromResponseBody(body);

      if (!response.ok || apiErrorMessage) {
        setFormErrorMessage(apiErrorMessage ?? "設定の保存に失敗しました。");
        return;
      }

      const savedSavings = readCurrentTotalSavingsFromProfilePatchBody(body);
      if (savedSavings !== null) {
        setFormValues((previousValues) => ({
          ...previousValues,
          current_total_savings_display: String(savedSavings),
        }));
      }

      setFormSuccessMessage("設定を保存しました。");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormErrorMessage("通信に失敗しました。ネットワークを確認して再試行してください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetData = async () => {
    setResetErrorMessage("");
    if (resetConfirmText !== REQUIRED_RESET_TEXT) {
      setResetErrorMessage(`確認テキスト「${REQUIRED_RESET_TEXT}」を入力してください。`);
      return;
    }

    const isConfirmed = window.confirm("全取引データを削除し、初期設定に戻します。実行しますか？");
    if (!isConfirmed) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch("/api/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: resetConfirmText }),
      });
      const body: unknown = await response.json();
      const apiErrorMessage = getErrorMessageFromResponseBody(body);
      if (!response.ok || apiErrorMessage) {
        setResetErrorMessage(apiErrorMessage ?? "データ初期化に失敗しました。");
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setResetErrorMessage("通信に失敗しました。ネットワークを確認して再試行してください。");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <section className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-zinc-600">予算・給料日・光熱費の前提値を更新できます。</p>
        </div>
        <Link href="/dashboard" className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
          Dashboardへ戻る
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="目標金額"
            name="target_amount"
            value={formValues.target_amount}
            onChange={handleChangeValue}
          />
          <DurationField
            label="達成期限"
            yearsName="target_years"
            yearsValue={formValues.target_years}
            monthsName="target_months"
            monthsValue={formValues.target_months}
            onChange={handleChangeValue}
          />
          <ReadOnlyField label="目標日（自動算出）" value={formValues.target_date_display} />
          <ReadOnlyField label="現在の貯金総額（資産側）" value={formatNumberDisplay(formValues.current_total_savings_display)} />
          {showMonthlySavingsQuota && monthlySavingsQuota !== null ? (
            <ReadOnlyField
              label="月次貯金ノルマ"
              value={formatCurrencyYen(monthlySavingsQuota)}
              helperText="（目標金額 − 現在の貯金総額）÷ 目標日までの残り月数。編集はできません。"
            />
          ) : null}
          <NumberField
            label="月収"
            name="monthly_income"
            value={formValues.monthly_income}
            onChange={handleChangeValue}
          />
          <NumberField label="給料日" name="payday" value={formValues.payday} onChange={handleChangeValue} min={1} max={31} />
          <SelectField
            label="給料日ルール"
            name="payday_rule"
            value={formValues.payday_rule}
            options={PAYDAY_RULE_VALUES.map((value) => ({
              value,
              label: `${value}${value === "FIXED" ? "（補正なし）" : value === "BEFORE" ? "（前倒し）" : "（後ろ倒し）"}`,
            }))}
            onChange={handleChangeValue}
          />
          <NumberField label="固定費" name="fixed_costs" value={formValues.fixed_costs} onChange={handleChangeValue} />
          <NumberField
            label="電気代概算"
            name="estimated_electricity"
            value={formValues.estimated_electricity}
            onChange={handleChangeValue}
          />
          <NumberField label="ガス代概算" name="estimated_gas" value={formValues.estimated_gas} onChange={handleChangeValue} />
          <NumberField label="水道代概算" name="estimated_water" value={formValues.estimated_water} onChange={handleChangeValue} />
          <SelectField
            label="余剰金モード"
            name="surplus_mode"
            value={formValues.surplus_mode}
            options={SURPLUS_MODE_VALUES.map((value) => ({
              value,
              label: value === "STRICT" ? "厳格（余剰は貯金へ）" : "ゆとり（余剰は翌月の予算へ）",
            }))}
            onChange={handleChangeValue}
          />
          <NumberField
            label="次の給料日まで使う予算（サイクル基準）"
            name="initial_budget"
            value={formValues.initial_budget}
            onChange={handleChangeValue}
          />
        </div>
        {formErrorMessage ? <p className="text-sm text-red-700">{formErrorMessage}</p> : null}
        {formSuccessMessage ? <p className="text-sm text-emerald-700">{formSuccessMessage}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {isSubmitting ? "保存中..." : "設定を保存"}
        </button>
      </form>

      <section className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-base font-semibold text-red-900">データ初期化</h2>
        <p className="text-sm text-red-800">
          取引履歴を全削除し、初期設定からやり直す状態に戻します。確認のため「{REQUIRED_RESET_TEXT}」を入力してください。
        </p>
        <input
          type="text"
          value={resetConfirmText}
          onChange={(event) => setResetConfirmText(event.target.value)}
          className="w-full rounded-md border border-red-300 px-3 py-2 text-sm"
          placeholder={REQUIRED_RESET_TEXT}
        />
        {resetErrorMessage ? <p className="text-sm text-red-700">{resetErrorMessage}</p> : null}
        <button
          type="button"
          onClick={handleResetData}
          disabled={isResetting}
          className="rounded-md border border-red-400 bg-white px-4 py-2 text-sm text-red-800 disabled:opacity-60"
        >
          {isResetting ? "初期化中..." : "データを初期化する"}
        </button>
      </section>
    </section>
  );
}

type FieldProps = {
  readonly label: string;
  readonly name: keyof SettingsFormValues;
  readonly value: string;
  readonly onChange: (name: keyof SettingsFormValues, value: string) => void;
};

function NumberField({ label, name, value, onChange, min = 0, max }: FieldProps & { min?: number; max?: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        required
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2"
      />
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
  helperText,
}: {
  readonly label: string;
  readonly value: string;
  readonly helperText?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <input
        type="text"
        readOnly
        value={value}
        className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-800"
      />
      {helperText ? <p className="text-xs text-zinc-500">{helperText}</p> : null}
    </label>
  );
}

function DurationField(props: {
  readonly label: string;
  readonly yearsName: keyof SettingsFormValues;
  readonly yearsValue: string;
  readonly monthsName: keyof SettingsFormValues;
  readonly monthsValue: string;
  readonly onChange: (name: keyof SettingsFormValues, value: string) => void;
}) {
  const { label, yearsName, yearsValue, monthsName, monthsValue, onChange } = props;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <select
          required
          value={yearsValue}
          onChange={(event) => onChange(yearsName, event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        >
          {Array.from({ length: 21 }, (_, year) => (
            <option key={year} value={String(year)}>
              {year}年
            </option>
          ))}
        </select>
        <select
          required
          value={monthsValue}
          onChange={(event) => onChange(monthsName, event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2"
        >
          {Array.from({ length: 12 }, (_, month) => (
            <option key={month} value={String(month)}>
              {month}か月
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function SelectField(
  props: FieldProps & {
    readonly options: readonly { readonly value: string; readonly label: string }[];
  },
) {
  const { label, name, value, onChange, options } = props;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <select
        required
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function readCurrentTotalSavingsFromProfilePatchBody(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("profile" in body)) {
    return null;
  }
  const profile = (body as { profile: unknown }).profile;
  if (typeof profile !== "object" || profile === null || !("current_total_savings" in profile)) {
    return null;
  }
  const value = (profile as { current_total_savings: unknown }).current_total_savings;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getErrorMessageFromResponseBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  if (!("errorMessage" in body)) {
    return null;
  }
  if (typeof body.errorMessage !== "string") {
    return null;
  }
  return body.errorMessage;
}

function formatNumberDisplay(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return raw;
  }
  return new Intl.NumberFormat("ja-JP").format(Math.floor(n));
}

function formatCurrencyYen(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}
