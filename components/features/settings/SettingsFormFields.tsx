"use client";

import { useId, type ReactNode } from "react";

import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { formatDigitsWithCommas, toNumericOnly } from "@/lib/logic/money-input-format";

/**
 * 設定画面 / プレビューで共有する小さな入力フィールド群。
 * `SettingsClient` の縦長を抑え、UI 部分を独立してレビューできるよう抽出した。
 */

/**
 * `name` を呼び出し側のフィールド名 union（例: `keyof SettingsFormValues`）に合わせるためジェネリック化。
 * `string` 固定だと contravariance により親フォームの型と互換しなくなる。
 */
type BaseFieldProps<TName extends string> = {
  readonly label: string;
  readonly name: TName;
  readonly value: string;
  readonly onChange: (name: TName, value: string) => void;
};

export function NumberField<TName extends string>({
  label,
  name,
  value,
  onChange,
  min = 0,
  max,
  thousands = false,
  placeholder,
  helperText,
}: BaseFieldProps<TName> & {
  readonly min?: number;
  readonly max?: number;
  /** true なら表示時に千区切りを適用し、保存値は数字のみへ正規化する */
  readonly thousands?: boolean;
  readonly placeholder?: string;
  readonly helperText?: string;
}) {
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
      {helperText ? <p className="text-xs leading-relaxed text-nokori-muted">{helperText}</p> : null}
    </div>
  );
}

export function ReadOnlyField({
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

export function DurationField<TName extends string>(props: {
  readonly label: string;
  readonly yearsName: TName;
  readonly yearsValue: string;
  readonly monthsName: TName;
  readonly monthsValue: string;
  readonly onChange: (name: TName, value: string) => void;
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

export function SelectField<TName extends string>(
  props: BaseFieldProps<TName> & {
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
        trailing={showHelp ? <HelpTooltip ariaLabel={tooltipAria} description={descriptionText} /> : undefined}
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

/** ラベル＋（オプションで）ヘルプアイコンの 1 行レイアウト。フィールド間で高さを揃える。 */
export function FormFieldLabelRow(props: {
  readonly htmlFor?: string;
  readonly label: string;
  readonly trailing?: ReactNode;
}) {
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
      <span className="inline-flex w-8 shrink-0 justify-end">
        {trailing ?? <span className="h-8 w-8 shrink-0" aria-hidden />}
      </span>
    </div>
  );
}
