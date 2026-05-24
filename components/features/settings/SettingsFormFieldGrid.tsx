"use client";

import {
  DurationField,
  NumberField,
  ReadOnlyField,
  SelectField,
} from "./SettingsFormFields";
import { toNumericOnly } from "@/lib/logic/money-input-format";
import { PAYDAY_RULE_VALUES, SURPLUS_MODE_VALUES } from "@/lib/logic/onboarding-validation";

import type { SettingsFormValues } from "../SettingsClient";

/**
 * 設定画面の入力グリッド。
 *
 * `SettingsClient` から「フィールドの並び」と「金額フィールドの正規化」だけを抜き出したコンポーネント。
 * フィールド単体は `SettingsFormFields.tsx` を参照。
 */
export function SettingsFormFieldGrid(props: {
  readonly formValues: SettingsFormValues;
  readonly onChangeValue: (fieldName: keyof SettingsFormValues, value: string) => void;
  readonly targetDateShown: string;
  readonly monthlySavingsQuota: number | null;
  readonly showMonthlySavingsQuota: boolean;
  readonly yutoriCarryoverDisplayYen: number | null;
  readonly isFirstCycle: boolean;
  readonly moneyFieldNames: readonly (keyof SettingsFormValues)[];
}) {
  const {
    formValues,
    onChangeValue,
    targetDateShown,
    monthlySavingsQuota,
    showMonthlySavingsQuota,
    yutoriCarryoverDisplayYen,
    isFirstCycle,
    moneyFieldNames,
  } = props;

  /** 金額フィールドは状態側を「数字のみ」に正規化してから保持する。 */
  const handleChange = (fieldName: keyof SettingsFormValues, value: string) => {
    if (moneyFieldNames.includes(fieldName)) {
      onChangeValue(fieldName, toNumericOnly(value));
      return;
    }
    onChangeValue(fieldName, value);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberField
        label="目標金額"
        name="target_amount"
        value={formValues.target_amount}
        onChange={handleChange}
        thousands
        placeholder="例: 1,000,000"
      />
      <DurationField
        label="達成期限"
        yearsName="target_years"
        yearsValue={formValues.target_years}
        monthsName="target_months"
        monthsValue={formValues.target_months}
        onChange={handleChange}
      />
      <ReadOnlyField label="目標日（自動算出）" value={targetDateShown} />
      <ReadOnlyField
        label="現在の貯金総額"
        value={formatNumberDisplay(formValues.current_total_savings_display)}
      />
      {showMonthlySavingsQuota && monthlySavingsQuota !== null ? (
        <ReadOnlyField
          label="月次貯金ノルマ（確定値）"
          value={formatCurrencyYen(monthlySavingsQuota)}
          helperText="（目標金額 − 現在の貯金総額）÷ 目標日までの残り月数。編集はできません。"
        />
      ) : null}
      {isFirstCycle ? null : (
        <NumberField
          label="月収（手取り概算）"
          name="monthly_income"
          value={formValues.monthly_income}
          onChange={handleChange}
          thousands
          placeholder="例: 300,000"
          helperText="このサイクルで使う手取りの目安です。ボーナスなど臨時収入がある月は、ここに含めた合計額を入力してください。"
        />
      )}
      <NumberField
        label="給料日"
        name="payday"
        value={formValues.payday}
        onChange={handleChange}
        min={1}
        max={31}
      />
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
        onChange={handleChange}
      />
      <NumberField
        label="固定費合計"
        name="fixed_costs"
        value={formValues.fixed_costs}
        onChange={handleChange}
        thousands
        placeholder="例: 100,000"
      />
      <NumberField
        label="電気代概算"
        name="estimated_electricity"
        value={formValues.estimated_electricity}
        onChange={handleChange}
        thousands
        placeholder="例: 5,000"
      />
      <NumberField
        label="ガス代概算"
        name="estimated_gas"
        value={formValues.estimated_gas}
        onChange={handleChange}
        thousands
        placeholder="例: 5,000"
      />
      <NumberField
        label="水道代概算"
        name="estimated_water"
        value={formValues.estimated_water}
        onChange={handleChange}
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
        onChange={handleChange}
      />
      {yutoriCarryoverDisplayYen !== null ? (
        <ReadOnlyField
          label="前月からの繰り越し（参考）"
          value={formatCurrencyYen(yutoriCarryoverDisplayYen)}
          helperText="直近の給料日リセット後の基準サイクル予算を超えた分（max(0, 保存済み initial_budget − 基準サイクル予算)）。編集はできません。"
        />
      ) : null}
      {isFirstCycle ? (
        <NumberField
          label="次の給料日まで使う予算"
          name="initial_budget"
          value={formValues.initial_budget}
          onChange={handleChange}
          thousands
          placeholder="例: 100,000"
        />
      ) : null}
    </div>
  );
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
