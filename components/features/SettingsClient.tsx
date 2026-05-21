"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SettingsFormFieldGrid } from "./settings/SettingsFormFieldGrid";
import { SettingsPreviewSection } from "./settings/SettingsPreviewSection";
import { SettingsResetSection } from "./settings/SettingsResetSection";
import { getErrorMessageFromResponseBody } from "@/lib/logic/api-response-parsing";
import {
  calculateTargetDateFromDuration,
  parseJstDateKeyToDate,
  toJstDateString,
} from "@/lib/logic/budget-logic";
import { PAYDAY_RULE_VALUES, SURPLUS_MODE_VALUES } from "@/lib/logic/onboarding-validation";
import {
  calculateSettingsBudgetPreview,
  type SettingsBudgetPreviewDraft,
} from "@/lib/logic/settings-preview-simulation";
import type { SettingsPreviewSnapshot } from "@/lib/supabase/settings-preview-snapshot";
import { isRecord } from "@/lib/types/object-parsing";

export type SettingsFormValues = {
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

const SETTINGS_MONEY_FIELD_NAMES: readonly (keyof SettingsFormValues)[] = [
  "target_amount",
  "monthly_income",
  "fixed_costs",
  "estimated_electricity",
  "estimated_gas",
  "estimated_water",
  "initial_budget",
];

/**
 * 設定画面のクライアント本体。
 *
 * 役割:
 * - フォーム状態の保持と PATCH /api/profile 呼び出し
 * - 入力に応じた `target_date` 自動算出（give-back を防ぐため `useMemo`）
 * - 保存前プレビュー（純粋関数 `calculateSettingsBudgetPreview` に委譲）
 *
 * UI は `settings/` 配下の表示部品（FormFields, PreviewSection, ResetSection）に分離している。
 */
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

  const router = useRouter();

  // 目標日に効くフィールドだけを依存に並べ、金額入力等の再入力で計算が走らないようにしている。
  const computedTargetDateKey = useMemo(
    () =>
      computeTargetDateKey({
        targetYears: formValues.target_years,
        targetMonths: formValues.target_months,
        payday: formValues.payday,
        paydayRule: formValues.payday_rule,
        anchorLogicalDateKey: previewContext.anchorLogicalDateKey,
      }),
    [
      formValues.payday,
      formValues.payday_rule,
      formValues.target_months,
      formValues.target_years,
      previewContext.anchorLogicalDateKey,
    ],
  );

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
        yutoriCarryoverDb: previewContext.previewSnapshot.yutoriCarryoverDb,
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
        body: JSON.stringify(buildProfilePatchBody(formValues, previewContext.isFirstCycle)),
      });
      const body: unknown = await response.json();
      const apiErrorMessage = getErrorMessageFromResponseBody(body);

      if (!response.ok || apiErrorMessage) {
        setFormErrorMessage(
          apiErrorMessage ?? "設定を保存できませんでした。通信状況を確認し、もう一度お試しください。",
        );
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

  const targetDateShown = computedTargetDateKey ?? formValues.target_date_display;

  return (
    <section className="space-y-6 rounded-xl border border-nokori-border bg-nokori-surface p-4 shadow-sm sm:p-6">
      <SettingsHeader />

      <form onSubmit={handleSave} className="space-y-4">
        <SettingsFormFieldGrid
          formValues={formValues}
          onChangeValue={handleChangeValue}
          targetDateShown={targetDateShown}
          monthlySavingsQuota={monthlySavingsQuota}
          showMonthlySavingsQuota={showMonthlySavingsQuota}
          yutoriCarryoverDisplayYen={yutoriCarryoverDisplayYen}
          isFirstCycle={previewContext.isFirstCycle}
          moneyFieldNames={SETTINGS_MONEY_FIELD_NAMES}
        />

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

      <SettingsResetSection />
    </section>
  );
}

function SettingsHeader() {
  return (
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
  );
}

function computeTargetDateKey(params: {
  readonly targetYears: string;
  readonly targetMonths: string;
  readonly payday: string;
  readonly paydayRule: string;
  readonly anchorLogicalDateKey: string;
}): string | null {
  const { targetYears, targetMonths, payday: paydayStr, paydayRule, anchorLogicalDateKey } = params;
  const years = Number(targetYears);
  const months = Number(targetMonths);
  const payday = Number(paydayStr);
  const durationMonths = years * 12 + months;
  const matchedRule = PAYDAY_RULE_VALUES.find((value) => value === paydayRule);
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
      anchorLogicalDate: parseJstDateKeyToDate(anchorLogicalDateKey),
      durationMonths,
      payday,
      paydayRule: matchedRule,
    });
    return toJstDateString(targetDate);
  } catch {
    return null;
  }
}

/**
 * API へ送る PATCH ボディを作る。
 * 初回サイクルでは `monthly_income` を送らず、通常サイクルでは `initial_budget` を送らない
 * （サーバー側の `validateProfileSettingsPayload` が DB の既存値で補完する）。
 */
function buildProfilePatchBody(values: SettingsFormValues, isFirstCycle: boolean): Record<string, string> {
  return {
    target_amount: values.target_amount,
    target_years: values.target_years,
    target_months: values.target_months,
    ...(isFirstCycle ? {} : { monthly_income: values.monthly_income }),
    payday: values.payday,
    payday_rule: values.payday_rule,
    fixed_costs: values.fixed_costs,
    estimated_electricity: values.estimated_electricity,
    estimated_gas: values.estimated_gas,
    estimated_water: values.estimated_water,
    surplus_mode: values.surplus_mode,
    ...(isFirstCycle ? { initial_budget: values.initial_budget } : {}),
  };
}

function parseDraftFromForm(
  formValues: SettingsFormValues,
  previewContext: PreviewContext,
): SettingsBudgetPreviewDraft | null {
  const targetAmount = Number(formValues.target_amount.replace(/,/g, ""));
  const years = Number(formValues.target_years);
  const months = Number(formValues.target_months);
  const monthlyIncome = previewContext.isFirstCycle
    ? previewContext.monthlyIncomeDb
    : Number(formValues.monthly_income);
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
