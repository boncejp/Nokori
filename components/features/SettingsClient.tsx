"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  calculateTargetDateFromDuration,
  parseJstDateKeyToDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { PAYDAY_RULE_VALUES, SURPLUS_MODE_VALUES } from "@/lib/logic/onboarding-validation";
import {
  calculateSettingsBudgetPreview,
  type SettingsBudgetPreviewDraft,
  type SettingsBudgetPreviewResult,
} from "@/lib/logic/settings-preview-simulation";
import type { SettingsPreviewSnapshot } from "@/lib/supabase/settings-preview-snapshot";

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

type PreviewContext = {
  readonly anchorLogicalDateKey: string;
  readonly logicalTodayKey: string;
  readonly isFirstCycle: boolean;
  /** 保存済み `initial_budget`（通常サイクルのプレビュー母数に使用） */
  readonly initialBudgetDb: number;
  readonly previewSnapshot: SettingsPreviewSnapshot | null;
};

type SettingsClientProps = {
  readonly initialValues: SettingsFormValues;
  readonly monthlySavingsQuota: number | null;
  readonly showMonthlySavingsQuota: boolean;
  /** YUTORI かつ繰り越しが正のときのみ円。STRICT または繰り越しなしは null。 */
  readonly yutoriCarryoverDisplayYen: number | null;
  readonly previewContext: PreviewContext;
};

const REQUIRED_RESET_TEXT = "RESET";

export function SettingsClient({
  initialValues,
  monthlySavingsQuota,
  showMonthlySavingsQuota,
  yutoriCarryoverDisplayYen,
  previewContext,
}: SettingsClientProps) {
  const [formValues, setFormValues] = useState<SettingsFormValues>(initialValues);
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [formSuccessMessage, setFormSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetErrorMessage, setResetErrorMessage] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const router = useRouter();

  const computedTargetDateKey = useMemo(() => {
    const years = Number(formValues.target_years);
    const months = Number(formValues.target_months);
    const payday = Number(formValues.payday);
    const durationMonths = years * 12 + months;
    const matchedRule = PAYDAY_RULE_VALUES.find((value) => value === formValues.payday_rule);
    if (
      !Number.isFinite(years) ||
      !Number.isFinite(months) ||
      !Number.isFinite(payday) ||
      typeof matchedRule === "undefined" ||
      durationMonths < 1 ||
      payday < 1 ||
      payday > 31
    ) {
      return null;
    }
    try {
      const targetDate = calculateTargetDateFromDuration({
        anchorLogicalDate: parseJstDateKeyToDate(previewContext.anchorLogicalDateKey),
        durationMonths,
        payday,
        paydayRule: matchedRule,
      });
      return toJstDateString(targetDate);
    } catch {
      return null;
    }
  }, [formValues.payday, formValues.payday_rule, formValues.target_months, formValues.target_years, previewContext.anchorLogicalDateKey]);

  const previewMetrics = useMemo(() => {
    if (previewContext.previewSnapshot === null) {
      return null;
    }
    const draft = parseDraftFromForm(formValues, previewContext);
    if (draft === null) {
      return null;
    }
    return calculateSettingsBudgetPreview({
      previewKind: previewContext.isFirstCycle ? "first" : "normal",
      logicalToday: parseJstDateKeyToDate(previewContext.logicalTodayKey),
      anchorLogicalDate: parseJstDateKeyToDate(previewContext.anchorLogicalDateKey),
      currentTotalSavingsDb: previewContext.previewSnapshot.currentTotalSavingsDb,
      snapshot: {
        confirmedNormalSpentBeforeToday: previewContext.previewSnapshot.confirmedNormalSpentBeforeToday,
        todayTransactions: previewContext.previewSnapshot.todayTransactions,
        utilityEstimatesDb: previewContext.previewSnapshot.utilityEstimatesDb,
        initialBudgetDb: previewContext.previewSnapshot.initialBudgetDb,
      },
      firstCycleCalendar: previewContext.previewSnapshot.firstCycleCalendar,
      draft,
    });
  }, [formValues, previewContext]);

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
          ...(previewContext.isFirstCycle ? { initial_budget: formValues.initial_budget } : {}),
        }),
      });
      const body: unknown = await response.json();
      const apiErrorMessage = getErrorMessageFromResponseBody(body);

      if (!response.ok || apiErrorMessage) {
        setFormErrorMessage(apiErrorMessage ?? "設定を保存できませんでした。通信状況を確認し、もう一度お試しください。");
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
        setResetErrorMessage(apiErrorMessage ?? "データを初期化できませんでした。通信状況を確認し、もう一度お試しください。");
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

  const targetDateShown = computedTargetDateKey ?? formValues.target_date_display;

  return (
    <section className="space-y-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">設定</h1>
          <p className="text-sm text-zinc-600">予算・給料日・光熱費の前提値を更新できます。</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-md border border-zinc-300 px-4 py-2.5 text-sm hover:bg-zinc-100 sm:w-auto"
        >
          ダッシュボードへ戻る
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
          <ReadOnlyField label="目標日（自動算出）" value={targetDateShown} />
          <ReadOnlyField label="現在の貯金総額（資産側）" value={formatNumberDisplay(formValues.current_total_savings_display)} />
          {showMonthlySavingsQuota && monthlySavingsQuota !== null ? (
            <ReadOnlyField
              label="月次貯金ノルマ（確定値）"
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
              label:
                value === "FIXED"
                  ? "固定（土日祝も給料日のまま）"
                  : value === "BEFORE"
                    ? "前倒し（土日祝は前の平日へ）"
                    : "後ろ倒し（土日祝は次の平日へ）",
            }))}
            onChange={handleChangeValue}
          />
          <NumberField label="固定費合計" name="fixed_costs" value={formValues.fixed_costs} onChange={handleChangeValue} />
          <NumberField
            label="電気代概算"
            name="estimated_electricity"
            value={formValues.estimated_electricity}
            onChange={handleChangeValue}
          />
          <NumberField label="ガス代概算" name="estimated_gas" value={formValues.estimated_gas} onChange={handleChangeValue} />
          <NumberField label="水道代概算" name="estimated_water" value={formValues.estimated_water} onChange={handleChangeValue} />
          <SelectField
            label="余剰金処理モード"
            name="surplus_mode"
            value={formValues.surplus_mode}
            options={SURPLUS_MODE_VALUES.map((value) => ({
              value,
              label: value === "STRICT" ? "厳格（余剰は貯金へ）" : "ゆとり（余剰は翌月の予算へ）",
            }))}
            onChange={handleChangeValue}
          />
          {yutoriCarryoverDisplayYen !== null ? (
            <ReadOnlyField
              label="前月からの繰り越し（参考）"
              value={formatCurrencyYen(yutoriCarryoverDisplayYen)}
              helperText="直近の給料日リセット後の基準サイクル予算を超えた分（max(0, 保存済み initial_budget − 基準サイクル予算)）。編集はできません。"
            />
          ) : null}
          {previewContext.isFirstCycle ? (
            <NumberField
              label="次の給料日まで使う予算（サイクル基準）"
              name="initial_budget"
              value={formValues.initial_budget}
              onChange={handleChangeValue}
            />
          ) : null}
        </div>

        <SettingsPreviewSection
          isFirstCycle={previewContext.isFirstCycle}
          previewMetrics={previewMetrics}
          previewSnapshot={previewContext.previewSnapshot}
        />

        {formErrorMessage ? <p className="text-sm text-red-700">{formErrorMessage}</p> : null}
        {formSuccessMessage ? <p className="text-sm text-emerald-700">{formSuccessMessage}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
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
          className="min-h-11 w-full rounded-md border border-red-300 px-3 py-2.5 text-base sm:text-sm"
          placeholder={REQUIRED_RESET_TEXT}
        />
        {resetErrorMessage ? <p className="text-sm text-red-700">{resetErrorMessage}</p> : null}
        <button
          type="button"
          onClick={handleResetData}
          disabled={isResetting}
          className="min-h-11 rounded-md border border-red-400 bg-white px-4 py-2.5 text-sm font-medium text-red-800 disabled:opacity-60"
        >
          {isResetting ? "初期化中..." : "データを初期化する"}
        </button>
      </section>
    </section>
  );
}

function SettingsPreviewSection(props: {
  readonly isFirstCycle: boolean;
  readonly previewMetrics: SettingsBudgetPreviewResult | null;
  readonly previewSnapshot: SettingsPreviewSnapshot | null;
}) {
  const { isFirstCycle, previewMetrics, previewSnapshot } = props;

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4" aria-label="保存前プレビュー">
      <h2 className="text-base font-semibold text-indigo-950">保存前プレビュー（動的シミュレーション）</h2>
      {isFirstCycle ? (
        <p className="mt-2 text-sm text-indigo-900">
          <strong>初回サイクル:</strong>{" "}
          当日・翌日以降の日次プレビューは「次の給料日まで使う予算」だけが反映されます。他の項目を変えても日次は原則変わりません。月次貯金ノルマは通常サイクル（2回目以降）から適用されるため、このフェーズではプレビューに含めていません。
        </p>
      ) : (
        <p className="mt-2 text-sm text-indigo-900">
          <strong>通常サイクル:</strong>{" "}
          収入・固定費合計・光熱費概算・達成条件の変更案がプレビューに反映されます。日次の母数は、余剰金処理が厳格のときは基準サイクル予算、ゆとりのときは給料日リセットで確定したサイクル枠（繰り越し込み）です。貯金総額と今日までの確定支出・当日の支出は実データのままです。
        </p>
      )}

      {previewSnapshot === null ? (
        <div className="mt-3 space-y-2 text-sm text-amber-900">
          <p>プレビュー用データを読み込めませんでした。設定の編集・保存はそのまま試せます。</p>
          <p className="text-xs text-amber-950/80">改善しない場合は、ページを再読み込みするか、時間をおいてから再度お試しください。</p>
        </div>
      ) : previewMetrics === null ? (
        <p className="mt-3 text-sm text-zinc-700">入力内容を確認するとプレビューを表示します。</p>
      ) : previewMetrics.status === "unavailable" ? (
        <p className="mt-3 text-sm text-zinc-700">この入力ではプレビューを計算できません（—）。</p>
      ) : (
        <dl
          className={`mt-3 grid gap-3 ${
            previewMetrics.previewKind === "normal" ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
          <div className="rounded-md border border-indigo-100 bg-white px-3 py-2">
            <dt className="text-xs font-medium text-zinc-500">当日予算（目安）</dt>
            <dd className="text-lg font-semibold tabular-nums text-indigo-950">
              {formatCurrencyYen(previewMetrics.dailyBudgetToday)}
            </dd>
          </div>
          <div className="rounded-md border border-indigo-100 bg-white px-3 py-2">
            <dt className="text-xs font-medium text-zinc-500">翌日以降の目安</dt>
            <dd className="text-lg font-semibold tabular-nums text-indigo-950">
              {formatCurrencyYen(previewMetrics.futureDailyBudget)}
            </dd>
          </div>
          {previewMetrics.previewKind === "normal" ? (
            <div className="rounded-md border border-indigo-100 bg-white px-3 py-2">
              <dt className="text-xs font-medium text-zinc-500">月次貯金ノルマ（プレビュー）</dt>
              <dd className="text-lg font-semibold tabular-nums text-indigo-950">
                {formatCurrencyYen(previewMetrics.monthlySavingsQuota)}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function parseDraftFromForm(
  formValues: SettingsFormValues,
  previewContext: PreviewContext,
): SettingsBudgetPreviewDraft | null {
  const targetAmount = Number(formValues.target_amount);
  const years = Number(formValues.target_years);
  const months = Number(formValues.target_months);
  const monthlyIncome = Number(formValues.monthly_income);
  const payday = Number(formValues.payday);
  const fixedCosts = Number(formValues.fixed_costs);
  const estimatedElectricity = Number(formValues.estimated_electricity);
  const estimatedGas = Number(formValues.estimated_gas);
  const estimatedWater = Number(formValues.estimated_water);
  const initialBudgetFromForm = Number(formValues.initial_budget);
  const initialBudget = previewContext.isFirstCycle ? initialBudgetFromForm : previewContext.initialBudgetDb;

  const numericFields = [
    targetAmount,
    years,
    months,
    monthlyIncome,
    payday,
    fixedCosts,
    estimatedElectricity,
    estimatedGas,
    estimatedWater,
    ...(previewContext.isFirstCycle ? [initialBudgetFromForm] : []),
  ];
  if (!numericFields.every((value) => Number.isFinite(value))) {
    return null;
  }

  const durationMonths = years * 12 + months;
  const matchedRule = PAYDAY_RULE_VALUES.find((value) => value === formValues.payday_rule);
  const matchedSurplus = SURPLUS_MODE_VALUES.find((value) => value === formValues.surplus_mode);
  if (
    typeof matchedRule === "undefined" ||
    typeof matchedSurplus === "undefined" ||
    durationMonths < 1 ||
    payday < 1 ||
    payday > 31
  ) {
    return null;
  }

  return {
    targetAmount,
    targetDurationMonths: durationMonths,
    monthlyIncome,
    payday,
    paydayRule: matchedRule,
    fixedCosts,
    estimatedElectricity,
    estimatedGas,
    estimatedWater,
    surplusMode: matchedSurplus,
    initialBudget,
  };
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
        className="min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
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
        className="min-h-11 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base text-zinc-800 sm:text-sm"
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
          className="min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
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
          className="min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
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
        className="min-h-11 rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCurrentTotalSavingsFromProfilePatchBody(body: unknown): number | null {
  if (!isRecord(body) || !("profile" in body)) {
    return null;
  }
  const profileValue = body.profile;
  if (!isRecord(profileValue) || !("current_total_savings" in profileValue)) {
    return null;
  }
  const savings = profileValue.current_total_savings;
  return typeof savings === "number" && Number.isFinite(savings) ? savings : null;
}

function getErrorMessageFromResponseBody(body: unknown): string | null {
  if (!isRecord(body) || !("errorMessage" in body)) {
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
