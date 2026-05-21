"use client";

import { formatDigitsWithCommas, toNumericOnly } from "@/lib/logic/money-input-format";

const MAX_DIGITS = 15;

const DIGIT_GRID = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

type ExpenseAmountKeypadProps = {
  readonly digits: string;
  readonly onDigitsChange: (next: string) => void;
};

export function ExpenseAmountKeypad({ digits, onDigitsChange }: ExpenseAmountKeypadProps) {
  const appendDigit = (digit: string) => {
    const merged = toNumericOnly(digits + digit);
    if (merged.length > MAX_DIGITS) {
      return;
    }
    onDigitsChange(merged);
  };

  const removeLastDigit = () => {
    onDigitsChange(digits.slice(0, -1));
  };

  const clearAll = () => {
    onDigitsChange("");
  };

  const formatted = formatDigitsWithCommas(digits);

  return (
    <div className="flex flex-col gap-2">
      <div
        aria-hidden
        className="flex min-h-11 items-center justify-end rounded-md border border-nokori-border bg-nokori-surface px-3 py-2.5 text-right text-lg font-semibold tabular-nums shadow-inner sm:text-base"
      >
        {formatted.length > 0 ? (
          <span className="text-nokori-navy">{formatted}</span>
        ) : (
          <span className="text-base font-normal text-nokori-muted sm:text-sm">金額を入力</span>
        )}
      </div>

      <input
        id="expense-amount-input"
        data-testid="expense-amount-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatted}
        onChange={(event) => {
          const next = toNumericOnly(event.target.value);
          onDigitsChange(next.length > MAX_DIGITS ? next.slice(0, MAX_DIGITS) : next);
        }}
        className="sr-only"
        aria-label="金額。数字キーで入力するか、ここに数字を直接入力できます。"
      />

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="金額の数字キー">
        {DIGIT_GRID.map((digit) => (
          <button
            key={digit}
            type="button"
            className="min-h-11 rounded-md border border-nokori-border bg-nokori-subtle text-base font-semibold text-nokori-navy transition hover:bg-nokori-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 active:bg-nokori-border/80 sm:min-h-10 sm:text-sm"
            aria-label={`${digit}を追加`}
            onClick={() => {
              appendDigit(digit);
            }}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="min-h-11 rounded-md border border-nokori-border bg-nokori-subtle text-sm font-medium text-nokori-navy transition hover:bg-nokori-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 active:bg-nokori-border/80 sm:min-h-10"
          aria-label="末尾の数字を1つ削除"
          onClick={removeLastDigit}
        >
          削除
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-nokori-border bg-nokori-subtle text-base font-semibold text-nokori-navy transition hover:bg-nokori-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 active:bg-nokori-border/80 sm:min-h-10 sm:text-sm"
          aria-label="0を追加"
          onClick={() => {
            appendDigit("0");
          }}
        >
          0
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-nokori-border bg-nokori-subtle text-sm font-medium text-nokori-navy transition hover:bg-nokori-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/30 active:bg-nokori-border/80 sm:min-h-10"
          aria-label="金額をすべて消去"
          onClick={clearAll}
        >
          全消去
        </button>
      </div>
    </div>
  );
}
