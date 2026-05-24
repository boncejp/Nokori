"use client";

import {
  FUTURE_DAILY_BUDGET_MASKED_HINT_SETTINGS,
  FUTURE_DAILY_BUDGET_MASKED_LABEL,
} from "@/lib/logic/budget-logic";
import type { SettingsBudgetPreviewResult } from "@/lib/logic/settings-preview-simulation";
import type { SettingsPreviewSnapshot } from "@/lib/supabase/settings-preview-snapshot";

/**
 * 保存前プレビュー（当日予算・翌日以降・月次貯金ノルマ）。
 *
 * 初回サイクルでは「次の給料日まで使う予算」の変更のみ反映する一方、通常サイクルでは
 * 収入・固定費合計・光熱費概算などの変更が日次予算へ波及する。`previewKind` でレイアウトを切り替える。
 */
export function SettingsPreviewSection(props: {
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
          手取り額・固定費合計・光熱費概算・達成条件の変更案がプレビューに反映されます。日次の母数は、余剰金処理が厳格のときは基準サイクル予算、ゆとりのときは給料日リセットで確定したサイクル枠（繰り越し込み）です。貯金総額と今日までの確定支出・当日の支出は実データのままです。
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
            <dt className="text-xs font-medium text-nokori-muted">当日の目安予算</dt>
            <dd className="text-lg font-semibold tabular-nums text-nokori-navy">
              {formatCurrencyYen(previewMetrics.dailyBudgetToday)}
            </dd>
          </div>
          <div className="rounded-md border border-nokori-border bg-nokori-surface px-3 py-2 shadow-sm">
            <dt className="text-xs font-medium text-nokori-muted">翌日以降の目安予算</dt>
            <dd className="text-lg font-semibold tabular-nums text-nokori-navy">
              {previewMetrics.maskFutureDailyBudget
                ? FUTURE_DAILY_BUDGET_MASKED_LABEL
                : formatCurrencyYen(previewMetrics.futureDailyBudget)}
            </dd>
            {previewMetrics.maskFutureDailyBudget ? (
              <p className="mt-1 text-[11px] leading-snug text-nokori-muted">
                {FUTURE_DAILY_BUDGET_MASKED_HINT_SETTINGS}
              </p>
            ) : null}
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

function formatCurrencyYen(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}
