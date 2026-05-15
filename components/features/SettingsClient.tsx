"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";

import { HelpTooltip } from "@/components/ui/HelpTooltip";
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
import { formatDigitsWithCommas, toNumericOnly } from "@/lib/money-input-format";

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
  /** 初回サイクルでは月収欄を出さないため、プレビューは DB の値を使う */
  readonly monthlyIncomeDb: number;
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

const SETTINGS_MONEY_FIELD_NAMES: readonly (keyof SettingsFormValues)[] = [
  "target_amount",
  "monthly_income",
  "fixed_costs",
  "estimated_electricity",
  "estimated_gas",
  "estimated_water",
  "initial_budget",
];

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
    if (SETTINGS_MONEY_FIELD_NAMES.includes(fieldName)) {
      setFormValues((previousValues) => ({ ...previousValues, [fieldName]: toNumericOnly(value) }));
      return;
    }
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
          ...(previewContext.isFirstCycle ? {} : { monthly_income: formValues.monthly_income }),
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
    <section className="space-y-6 rounded-xl border border-nokori-border bg-nokori-surface p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-nokori-navy">設定</h1>
          <p className="text-sm text-nokori-muted">予算・給料日・光熱費の前提値を更新できます。</p>
          <p className="mt-1 text-xs text-nokori-muted leading-relaxed">
            日付の扱い: 「今日」や取引の集計に使う日付は、日本時間で毎日午前3:00が前日と当日の切り替わりタイミングです（午前0:00〜2:59に登録した取引は前日扱い）。
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-md border border-nokori-border bg-nokori-surface px-4 py-2.5 text-sm text-nokori-navy shadow-sm transition hover:bg-nokori-subtle sm:w-auto"
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
            thousands
            placeholder="例: 1,000,000"
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
          <ReadOnlyField label="現在の貯金総額" value={formatNumberDisplay(formValues.current_total_savings_display)} />
          {showMonthlySavingsQuota && monthlySavingsQuota !== null ? (
            <ReadOnlyField
              label="月次貯金ノルマ（確定値）"
              value={formatCurrencyYen(monthlySavingsQuota)}
              helperText="（目標金額 − 現在の貯金総額）÷ 目標日までの残り月数。編集はできません。"
            />
          ) : null}
          {previewContext.isFirstCycle ? null : (
            <NumberField
              label="月収（手取り概算）"
              name="monthly_income"
              value={formValues.monthly_income}
              onChange={handleChangeValue}
              thousands
              placeholder="例: 300,000"
            />
          )}
          <NumberField label="給料日" name="payday" value={formValues.payday} onChange={handleChangeValue} min={1} max={31} />
          <SelectField
            label="給料日ルール"
            name="payday_rule"
            value={formValues.payday_rule}
            helpAriaLabel="給料日ルールの説明"
            helpDescription="給料日が土日祝と重なったときの扱いを選びます。前倒しは直前の平日、後ろ倒しは次の平日、固定はカレンダー日のまま給料日とみなします。"
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
          <NumberField
            label="固定費合計"
            name="fixed_costs"
            value={formValues.fixed_costs}
            onChange={handleChangeValue}
            thousands
            placeholder="例: 100,000"
          />
          <NumberField
            label="電気代概算"
            name="estimated_electricity"
            value={formValues.estimated_electricity}
            onChange={handleChangeValue}
            thousands
            placeholder="例: 5,000"
          />
          <NumberField
            label="ガス代概算"
            name="estimated_gas"
            value={formValues.estimated_gas}
            onChange={handleChangeValue}
            thousands
            placeholder="例: 5,000"
          />
          <NumberField
            label="水道代概算"
            name="estimated_water"
            value={formValues.estimated_water}
            onChange={handleChangeValue}
            thousands
            placeholder="例: 5,000"
          />
          <SelectField
            label="余剰金処理モード"
            name="surplus_mode"
            value={formValues.surplus_mode}
            helpAriaLabel="余剰金処理モードの説明"
            helpDescription="通常サイクルの給料日リセット時のみ効きます。厳格は余剰を貯金に足して翌月の使える枠は基準に戻し、ゆとりは余剰を翌月の可処分枠に織り込みます（初回サイクル締めでは使いません）。"
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
              label="次の給料日まで使う予算"
              name="initial_budget"
              value={formValues.initial_budget}
              onChange={handleChangeValue}
              thousands
              placeholder="例: 100,000"
            />
          ) : null}
        </div>

        <SettingsPreviewSection
          isFirstCycle={previewContext.isFirstCycle}
          previewMetrics={previewMetrics}
          previewSnapshot={previewContext.previewSnapshot}
        />

        {formErrorMessage ? <p className="text-sm text-red-700">{formErrorMessage}</p> : null}
        {formSuccessMessage ? <p className="text-sm text-emerald-800">{formSuccessMessage}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 rounded-md bg-nokori-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-nokori-navy-soft disabled:opacity-60"
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
    <section className="rounded-lg border border-nokori-border bg-nokori-subtle/80 p-4" aria-label="保存前プレビュー">
      <h2 className="text-base font-semibold text-nokori-navy">保存前プレビュー</h2>
      {isFirstCycle ? (
        <p className="mt-2 text-sm text-nokori-muted">
          <strong className="text-nokori-text">初回サイクル:</strong>{" "}
          当日・翌日以降の日次プレビューは「次の給料日まで使う予算」の変更だけが反映されます。他の項目を変えても日次プレビューは原則変わりません。
        </p>
      ) : (
        <p className="mt-2 text-sm text-nokori-muted">
          <strong className="text-nokori-text">通常サイクル:</strong>{" "}
          収入・固定費合計・光熱費概算・達成条件の変更案がプレビューに反映されます。日次の母数は、余剰金処理が厳格のときは基準サイクル予算、ゆとりのときは給料日リセットで確定したサイクル枠（繰り越し込み）です。貯金総額と今日までの確定支出・当日の支出は実データのままです。
        </p>
      )}

      {previewSnapshot === null ? (
        <div className="mt-3 space-y-2 text-sm text-amber-900">
          <p>プレビュー用データを読み込めませんでした。設定の編集・保存はそのまま試せます。</p>
          <p className="text-xs text-amber-950/80">改善しない場合は、ページを再読み込みするか、時間をおいてから再度お試しください。</p>
        </div>
      ) : previewMetrics === null ? (
        <p className="mt-3 text-sm text-nokori-muted">入力内容を確認するとプレビューを表示します。</p>
      ) : previewMetrics.status === "unavailable" ? (
        <p className="mt-3 text-sm text-nokori-muted">この入力ではプレビューを計算できません（—）。</p>
      ) : (
        <dl
          className={`mt-3 grid gap-3 ${
            previewMetrics.previewKind === "normal" ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
          <div className="rounded-md border border-nokori-border bg-nokori-surface px-3 py-2 shadow-sm">
            <dt className="text-xs font-medium text-nokori-muted">当日予算（目安）</dt>
            <dd className="text-lg font-semibold tabular-nums text-nokori-navy">
              {formatCurrencyYen(previewMetrics.dailyBudgetToday)}
            </dd>
          </div>
          <div className="rounded-md border border-nokori-border bg-nokori-surface px-3 py-2 shadow-sm">
            <dt className="text-xs font-medium text-nokori-muted">翌日以降の目安</dt>
            <dd className="text-lg font-semibold tabular-nums text-nokori-navy">
              {formatCurrencyYen(previewMetrics.futureDailyBudget)}
            </dd>
          </div>
          {previewMetrics.previewKind === "normal" ? (
            <div className="rounded-md border border-nokori-border bg-nokori-surface px-3 py-2 shadow-sm">
              <dt className="text-xs font-medium text-nokori-muted">月次貯金ノルマ（プレビュー）</dt>
              <dd className="text-lg font-semibold tabular-nums text-nokori-navy">
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
  const targetAmount = Number(formValues.target_amount.replace(/,/g, ""));
  const years = Number(formValues.target_years);
  const months = Number(formValues.target_months);
  const monthlyIncome = previewContext.isFirstCycle ? previewContext.monthlyIncomeDb : Number(formValues.monthly_income);
  const payday = Number(formValues.payday);
  const fixedCosts = Number(formValues.fixed_costs.replace(/,/g, ""));
  const estimatedElectricity = Number(formValues.estimated_electricity.replace(/,/g, ""));
  const estimatedGas = Number(formValues.estimated_gas.replace(/,/g, ""));
  const estimatedWater = Number(formValues.estimated_water.replace(/,/g, ""));
  const initialBudgetFromForm = Number(formValues.initial_budget.replace(/,/g, ""));
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

function NumberField({
  label,
  name,
  value,
  onChange,
  min = 0,
  max,
  thousands = false,
  placeholder,
}: FieldProps & { min?: number; max?: number; thousands?: boolean; placeholder?: string }) {
  const fieldId = `settings-field-${name}`;
  const displayValue = thousands ? formatDigitsWithCommas(value) : value;
  return (
    <div className="flex flex-col gap-1 text-sm text-nokori-text">
      <FormFieldLabelRow htmlFor={fieldId} label={label} />
      <input
        id={fieldId}
        type={thousands ? "text" : "number"}
        inputMode="numeric"
        min={thousands ? undefined : min}
        max={thousands ? undefined : max}
        required
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => onChange(name, thousands ? toNumericOnly(event.target.value) : event.target.value)}
        className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-base text-nokori-text shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 sm:text-sm"
      />
    </div>
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
  const reactId = useId();
  const fieldId = `${reactId}-readonly`;
  return (
    <div className="flex flex-col gap-1 text-sm text-nokori-text">
      <FormFieldLabelRow htmlFor={fieldId} label={label} />
      <input
        id={fieldId}
        type="text"
        readOnly
        value={value}
        className="min-h-11 rounded-md border border-nokori-border bg-nokori-subtle px-3 py-2.5 text-base text-nokori-text sm:text-sm"
      />
      {helperText ? <p className="text-xs text-nokori-muted">{helperText}</p> : null}
    </div>
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
    <div className="flex flex-col gap-1 text-sm text-nokori-text">
      <FormFieldLabelRow label={label} />
      <div className="grid grid-cols-2 gap-2">
        <select
          required
          value={yearsValue}
          onChange={(event) => onChange(yearsName, event.target.value)}
          className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-base text-nokori-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 sm:text-sm"
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
          className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-base text-nokori-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 sm:text-sm"
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

function SelectField(
  props: FieldProps & {
    readonly options: readonly { readonly value: string; readonly label: string }[];
    readonly helpAriaLabel?: string;
    readonly helpDescription?: string;
  },
) {
  const { label, name, value, onChange, options, helpAriaLabel, helpDescription } = props;
  const fieldId = `settings-field-${name}`;
  const descriptionText = helpDescription?.trim() ?? "";
  const showHelp = descriptionText.length > 0;
  const tooltipAria = helpAriaLabel ?? `${label}の説明`;

  return (
    <div className="flex flex-col gap-1 text-sm text-nokori-text">
      <FormFieldLabelRow
        htmlFor={fieldId}
        label={label}
        trailing={
          showHelp ? <HelpTooltip ariaLabel={tooltipAria} description={descriptionText} /> : undefined
        }
      />
      <select
        id={fieldId}
        required
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="min-h-11 rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-base text-nokori-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 sm:text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
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

function FormFieldLabelRow(props: { readonly htmlFor?: string; readonly label: string; readonly trailing?: ReactNode }) {
  const { htmlFor, label, trailing } = props;
  const labelBody =
    typeof htmlFor === "string" ? (
      <label htmlFor={htmlFor} className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-snug text-nokori-text">
        {label}
      </label>
    ) : (
      <span className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-snug text-nokori-text">{label}</span>
    );
  return (
    <div className="flex min-h-8 items-start justify-between gap-2">
      {labelBody}
      <span className="inline-flex w-8 shrink-0 justify-end">{trailing ?? <span className="h-8 w-8 shrink-0" aria-hidden />}</span>
    </div>
  );
}

