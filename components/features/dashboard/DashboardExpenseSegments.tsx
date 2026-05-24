"use client";

import { HelpTooltip } from "@/components/ui/HelpTooltip";
import type { UtilityType } from "@/lib/types/domain";

export type TransactionKind = "NORMAL" | "SPECIAL" | "UTILITY";

type TransactionKindOption = {
  readonly value: TransactionKind;
  readonly label: string;
  readonly shortLabel: string;
  readonly tooltip: string;
  readonly helpAria: string;
};

export const TRANSACTION_KIND_OPTIONS: readonly TransactionKindOption[] = [
  {
    value: "NORMAL",
    label: "普通支出",
    shortLabel: "普通",
    tooltip: "今日の残り予算と、翌日以降の目安予算（1日あたり）から差し引く普段の支出として扱います。",
    helpAria: "普通支出が予算に与える影響の説明",
  },
  {
    value: "SPECIAL",
    label: "特別支出",
    shortLabel: "特別",
    tooltip: "貯金総額から直接差し引き、当日の日次予算には載せません（月次貯金ノルマは再計算されます）。",
    helpAria: "特別支出が予算に与える影響の説明",
  },
  {
    value: "UTILITY",
    label: "光熱費",
    shortLabel: "光熱",
    tooltip: "各種別の概算との差額がこのサイクル内の残り予算に反映されます（今日の残りは普通支出ベースのまま）。",
    helpAria: "光熱費が予算に与える影響の説明",
  },
];

type UtilityTypeOption = {
  readonly value: UtilityType;
  readonly label: string;
  readonly tooltip: string;
  readonly helpAria: string;
};

export const UTILITY_TYPE_OPTIONS: readonly UtilityTypeOption[] = [
  {
    value: "ELECTRICITY",
    label: "電気",
    tooltip: "電気の実額として記録し、概算との差額をこのサイクル内の残り予算に反映します。",
    helpAria: "電気（光熱費）入力の説明",
  },
  {
    value: "GAS",
    label: "ガス",
    tooltip: "ガスの実額として記録し、概算との差額をこのサイクル内の残り予算に反映します。",
    helpAria: "ガス（光熱費）入力の説明",
  },
  {
    value: "WATER",
    label: "水道",
    tooltip: "水道の実額として記録し、概算との差額をこのサイクル内の残り予算に反映します。",
    helpAria: "水道（光熱費）入力の説明",
  },
];

/** 支出種別の 3 択（普通 / 特別 / 光熱費）。 */
export function TransactionKindSegments({
  value,
  onChange,
}: {
  readonly value: TransactionKind;
  readonly onChange: (next: TransactionKind) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="支出種別">
      {TRANSACTION_KIND_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <div
            key={option.value}
            className="flex min-h-[3.25rem] flex-col gap-1.5 rounded-lg border border-nokori-border bg-nokori-surface p-2 shadow-sm sm:min-h-0"
          >
            <div className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={`min-h-11 flex-1 rounded-md px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/35 ${
                  selected
                    ? "bg-nokori-navy text-white shadow-inner"
                    : "bg-nokori-subtle text-nokori-navy hover:bg-nokori-border/60"
                }`}
                onClick={() => {
                  onChange(option.value);
                }}
              >
                {option.shortLabel}
              </button>
              <HelpTooltip ariaLabel={option.helpAria} description={option.tooltip} />
            </div>
            <span className="text-center text-[11px] leading-tight text-nokori-muted sm:text-xs">
              {option.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 光熱費の内訳（電気 / ガス / 水道）。 */
export function UtilityTypeSegments({
  value,
  onChange,
}: {
  readonly value: UtilityType;
  readonly onChange: (next: UtilityType) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="光熱費の内訳">
      {UTILITY_TYPE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <div
            key={option.value}
            className="flex min-h-[3.25rem] flex-col gap-1.5 rounded-lg border border-nokori-border bg-nokori-surface p-2 shadow-sm sm:min-h-0"
          >
            <div className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={`min-h-11 flex-1 rounded-md px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/35 ${
                  selected
                    ? "bg-nokori-navy text-white shadow-inner"
                    : "bg-nokori-subtle text-nokori-navy hover:bg-nokori-border/60"
                }`}
                onClick={() => {
                  onChange(option.value);
                }}
              >
                {option.label}
              </button>
              <HelpTooltip ariaLabel={option.helpAria} description={option.tooltip} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
