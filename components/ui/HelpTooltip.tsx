"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type HelpTooltipProps = {
  /** トリガーボタン用の短い名前（スクリーンリーダー） */
  readonly ariaLabel: string;
  /** ツールチップ本文（一文で挙動を説明） */
  readonly description: string;
};

/**
 * フォーカス・クリック・Esc で開閉するヘルプ。キーボード操作と `aria-*` を維持する。
 */
export function HelpTooltip({ ariaLabel, description }: HelpTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      close();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [close, open]);

  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <button
        ref={triggerRef}
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-nokori-border bg-nokori-surface text-xs font-semibold text-nokori-navy shadow-sm transition hover:bg-nokori-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nokori-navy/35 focus-visible:ring-offset-2 focus-visible:ring-offset-nokori-surface"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => {
          setOpen((previous) => !previous);
        }}
      >
        ?
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-nokori-border bg-nokori-surface px-3 py-2.5 text-left text-xs leading-relaxed text-nokori-text shadow-lg ring-1 ring-black/[0.04] sm:left-1/2 sm:right-auto sm:top-1/2 sm:mt-0 sm:-translate-x-1/2 sm:-translate-y-full sm:pb-3"
        >
          {description}
        </div>
      ) : null}
    </span>
  );
}
