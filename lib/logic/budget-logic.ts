import * as holidayJp from "@holiday-jp/holiday_jp";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  startOfDay,
  subDays,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const TIMEZONE = "Asia/Tokyo";
export const RESET_HOUR = 3;

export type PaydayRule = "BEFORE" | "AFTER" | "FIXED";
export type SurplusMode = "STRICT" | "YUTORI";
export type UtilityType = "ELECTRICITY" | "GAS" | "WATER";

export type UtilityEstimateMap = Readonly<Record<UtilityType, number>>;

function toJstStartOfDay(date: Date): Date {
  const jstDate = toZonedTime(date, TIMEZONE);
  const jstStart = startOfDay(jstDate);
  return fromZonedTime(jstStart, TIMEZONE);
}

export function toJstDateString(date: Date): string {
  const jstDate = toZonedTime(date, TIMEZONE);
  const year = String(jstDate.getFullYear());
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** profiles の論理日キー（YYYY-MM-DD）を、その日の JST 開始の瞬間として解釈する Date を返す。 */
export function parseJstDateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

function createJstDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  const month = String(monthIndex + 1).padStart(2, "0");
  const day = String(dayOfMonth).padStart(2, "0");
  return fromZonedTime(`${year}-${month}-${day}T00:00:00`, TIMEZONE);
}

function isHolidayInJapan(date: Date): boolean {
  // 実行環境のローカルTZに依存しないよう、JSTの年月日に正規化して祝日判定する。
  const jstDate = toZonedTime(date, TIMEZONE);
  const normalizedJstDate = createJstDate(
    jstDate.getFullYear(),
    jstDate.getMonth(),
    jstDate.getDate(),
  );
  return holidayJp.between(normalizedJstDate, normalizedJstDate).length > 0;
}

function isWeekendOrHoliday(date: Date): boolean {
  const jstDate = toZonedTime(date, TIMEZONE);
  const day = jstDate.getDay();
  const isWeekend = day === 0 || day === 6;
  return isWeekend || isHolidayInJapan(date);
}

function adjustPaydayByRule(basePayday: Date, paydayRule: PaydayRule): Date {
  if (paydayRule === "FIXED") {
    return basePayday;
  }

  let adjusted = basePayday;
  while (isWeekendOrHoliday(adjusted)) {
    adjusted = paydayRule === "BEFORE" ? subDays(adjusted, 1) : addDays(adjusted, 1);
  }
  return adjusted;
}

/**
 * 27:00 (JST 03:00) ルールに基づき論理日付を返す。
 */
export function getLogicalDate(now: Date): Date {
  const jstNow = toZonedTime(now, TIMEZONE);
  const jstStart = startOfDay(jstNow);
  if (jstNow.getHours() < RESET_HOUR) {
    return subDays(jstStart, 1);
  }
  return jstStart;
}

/**
 * 次回給料日までの日数を返す。
 */
export function calculateDaysUntilNextPayday(params: {
  readonly fromDate: Date;
  readonly nextPayday: Date;
  readonly includeToday: boolean;
}): number {
  const { fromDate, nextPayday, includeToday } = params;
  const fromJstStart = startOfDay(toZonedTime(fromDate, TIMEZONE));
  const paydayJstStart = startOfDay(toZonedTime(nextPayday, TIMEZONE));
  const days = differenceInCalendarDays(paydayJstStart, fromJstStart);

  if (days < 0) {
    throw new Error("nextPayday must be on or after fromDate");
  }

  return includeToday ? days + 1 : days;
}

/**
 * 当日予算 D_today を算出する。
 */
export function calculateDailyBudgetToday(params: {
  readonly remainingCycleBudget: number;
  readonly daysUntilNextPaydayIncludingToday: number;
}): number {
  const { remainingCycleBudget, daysUntilNextPaydayIncludingToday } = params;
  if (daysUntilNextPaydayIncludingToday <= 0) {
    throw new Error("daysUntilNextPaydayIncludingToday must be greater than 0");
  }
  return remainingCycleBudget / daysUntilNextPaydayIncludingToday;
}

/**
 * 今日の残予算 remainingToday を算出する。
 */
export function calculateRemainingToday(params: {
  readonly dailyBudgetToday: number;
  readonly todaySpent: number;
}): number {
  const { dailyBudgetToday, todaySpent } = params;
  return dailyBudgetToday - todaySpent;
}

/**
 * 翌日以降予算 D_future を算出する。
 */
export function calculateDailyBudgetFuture(params: {
  readonly remainingCycleBudget: number;
  readonly todaySpent: number;
  readonly daysUntilNextPaydayExcludingToday: number;
}): number {
  const { remainingCycleBudget, todaySpent, daysUntilNextPaydayExcludingToday } = params;
  const budgetAfterTodaySpending = remainingCycleBudget - todaySpent;

  if (daysUntilNextPaydayExcludingToday < 0) {
    throw new Error("daysUntilNextPaydayExcludingToday must not be negative");
  }
  if (daysUntilNextPaydayExcludingToday === 0) {
    return budgetAfterTodaySpending;
  }

  return budgetAfterTodaySpending / daysUntilNextPaydayExcludingToday;
}

/**
 * 光熱費実額と概算の差額を返す（正: 予算増 / 負: 予算減）。
 */
export function calculateUtilityBudgetDelta(params: {
  readonly utilityType: UtilityType;
  readonly actualAmount: number;
  readonly estimatedByType: UtilityEstimateMap;
}): number {
  const { utilityType, actualAmount, estimatedByType } = params;
  const estimatedAmount = estimatedByType[utilityType];
  return estimatedAmount - actualAmount;
}

/**
 * 光熱費差額を当月残予算に反映する。
 */
export function applyUtilityDeltaToRemainingBudget(params: {
  readonly remainingBudget: number;
  readonly utilityDelta: number;
}): number {
  const { remainingBudget, utilityDelta } = params;
  return remainingBudget + utilityDelta;
}

/**
 * 次回の給料日を算出する（給料日ルール、土日祝、月末補正を適用）。
 */
export function calculateNextPayday(params: {
  readonly fromDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): Date {
  const { fromDate, payday, paydayRule } = params;
  if (payday < 1 || payday > 31) {
    throw new Error(`payday must be between 1 and 31: ${payday}`);
  }

  const jstNow = toZonedTime(fromDate, TIMEZONE);
  const year = jstNow.getFullYear();
  const month = jstNow.getMonth();

  const currentMonthEnd = endOfMonth(createJstDate(year, month, 1));
  const currentMonthLastDay = toZonedTime(currentMonthEnd, TIMEZONE).getDate();
  const currentMonthDay = Math.min(payday, currentMonthLastDay);
  const currentMonthBase = createJstDate(year, month, currentMonthDay);
  const currentMonthPayday = adjustPaydayByRule(currentMonthBase, paydayRule);

  const todayString = toJstDateString(fromDate);
  const currentPaydayString = toJstDateString(currentMonthPayday);
  if (todayString <= currentPaydayString) {
    return toJstStartOfDay(currentMonthPayday);
  }

  const nextMonthDate = addMonths(createJstDate(year, month, 1), 1);
  const nextMonthJst = toZonedTime(nextMonthDate, TIMEZONE);
  const nextYear = nextMonthJst.getFullYear();
  const nextMonth = nextMonthJst.getMonth();
  const nextMonthEnd = endOfMonth(createJstDate(nextYear, nextMonth, 1));
  const nextMonthLastDay = toZonedTime(nextMonthEnd, TIMEZONE).getDate();
  const nextMonthDay = Math.min(payday, nextMonthLastDay);
  const nextMonthBase = createJstDate(nextYear, nextMonth, nextMonthDay);
  const nextMonthPayday = adjustPaydayByRule(nextMonthBase, paydayRule);
  return toJstStartOfDay(nextMonthPayday);
}

/**
 * 給料日リセット時の余剰金処理（STRICT / YUTORI）。
 */
export function processMonthlyReset(params: {
  readonly surplusMode: SurplusMode;
  readonly currentTotalSavings: number;
  readonly baseBudget: number;
  readonly surplus: number;
}): {
  readonly nextTotalSavings: number;
  readonly nextInitialBudget: number;
} {
  const { surplusMode, currentTotalSavings, baseBudget, surplus } = params;
  if (surplus <= 0) {
    return {
      nextTotalSavings: currentTotalSavings,
      nextInitialBudget: baseBudget,
    };
  }

  if (surplusMode === "STRICT") {
    return {
      nextTotalSavings: currentTotalSavings + surplus,
      nextInitialBudget: baseBudget,
    };
  }

  return {
    nextTotalSavings: currentTotalSavings,
    nextInitialBudget: baseBudget + surplus,
  };
}

/**
 * 目標日までの残り月数を返す（最小1）。
 */
export function calculateRemainingMonthsToTarget(params: {
  readonly targetDate: Date;
  readonly referenceDate: Date;
}): number {
  const { targetDate, referenceDate } = params;
  const jstTarget = toZonedTime(targetDate, TIMEZONE);
  const jstReference = toZonedTime(referenceDate, TIMEZONE);
  const monthDiff =
    (jstTarget.getFullYear() - jstReference.getFullYear()) * 12 +
    (jstTarget.getMonth() - jstReference.getMonth());

  return Math.max(monthDiff + 1, 1);
}

/**
 * 貯金目標に対する月次貯金ノルマを算出する。
 */
export function calculateMonthlySavingsQuota(params: {
  readonly targetAmount: number;
  readonly currentTotalSavings: number;
  readonly targetDate: Date;
  readonly referenceDate: Date;
}): number {
  const { targetAmount, currentTotalSavings, targetDate, referenceDate } = params;
  const remainingMonths = calculateRemainingMonthsToTarget({ targetDate, referenceDate });
  const remainingSavings = targetAmount - currentTotalSavings;
  const monthlySavingsQuota = remainingSavings / remainingMonths;

  return Math.max(0, monthlySavingsQuota);
}

/**
 * 設計4.2に基づく基準サイクル予算を算出する。
 */
export function calculateBaseCycleBudget(params: {
  readonly monthlyIncome: number;
  readonly fixedCosts: number;
  readonly estimatedElectricity: number;
  readonly estimatedGas: number;
  readonly estimatedWater: number;
  readonly monthlySavingsQuota: number;
}): number {
  const {
    monthlyIncome,
    fixedCosts,
    estimatedElectricity,
    estimatedGas,
    estimatedWater,
    monthlySavingsQuota,
  } = params;
  const estimatedUtilitiesTotal = estimatedElectricity + estimatedGas + estimatedWater;

  const rawBaseCycleBudget = monthlyIncome - fixedCosts - estimatedUtilitiesTotal - monthlySavingsQuota;
  // 可処分予算の保存値は0未満を許可しない。負債状態は remainingToday 側で表現する。
  return Math.max(0, rawBaseCycleBudget);
}

/**
 * 設定更新時に保存すべき initial_budget を決定する。
 * 初回サイクル中はオンボーディングで確定した初回開始予算を保持し、
 * ユーザーが明示的に初回開始予算を変更した場合のみ反映する。
 */
export function resolveInitialBudgetForSettingsUpdate(params: {
  readonly isWithinFirstCycle: boolean;
  readonly existingInitialBudget: number;
  readonly submittedInitialBudget: number;
}): number {
  const { isWithinFirstCycle, existingInitialBudget, submittedInitialBudget } = params;

  if (!isWithinFirstCycle) {
    return submittedInitialBudget;
  }

  if (submittedInitialBudget !== existingInitialBudget) {
    return submittedInitialBudget;
  }

  return existingInitialBudget;
}

/**
 * 設定 PATCH 時に保存すべき current_total_savings（現在の貯金総額）を決定する。
 * 初回サイクル中に「次の給料日まで使う予算」だけを変えたとき、かつ
 * 保存前の貯金がオンボーディング時点の内訳式と一致しているときに限り、
 * 全財産を維持したまま貯金側を `initial_total_assets - 新予算` に合わせる。
 */
export function resolveCurrentTotalSavingsForProfileSettingsUpdate(params: {
  readonly isWithinFirstCycle: boolean;
  readonly initialTotalAssets: number;
  readonly existingInitialBudget: number;
  readonly submittedInitialBudget: number;
  readonly existingCurrentTotalSavings: number;
}): number {
  const {
    isWithinFirstCycle,
    initialTotalAssets,
    existingInitialBudget,
    submittedInitialBudget,
    existingCurrentTotalSavings,
  } = params;

  if (!isWithinFirstCycle) {
    return existingCurrentTotalSavings;
  }

  if (submittedInitialBudget === existingInitialBudget) {
    return existingCurrentTotalSavings;
  }

  const impliedSavingsFromExistingBudget = initialTotalAssets - existingInitialBudget;
  if (existingCurrentTotalSavings !== impliedSavingsFromExistingBudget) {
    return existingCurrentTotalSavings;
  }

  return initialTotalAssets - submittedInitialBudget;
}

/** 初回サイクル中に「次の給料日まで使う予算」が全財産を超えないか（API 400 用）。 */
export function isFirstCycleInitialBudgetExceedingTotalAssets(params: {
  readonly isWithinFirstCycle: boolean;
  readonly submittedInitialBudget: number;
  readonly initialTotalAssets: number;
}): boolean {
  return (
    params.isWithinFirstCycle && params.submittedInitialBudget > params.initialTotalAssets
  );
}

/**
 * 次サイクルのremainingCycleBudgetを算出する。
 */
export function calculateNextRemainingCycleBudget(params: {
  readonly isFirstCycle: boolean;
  readonly initialBudget: number;
  readonly baseCycleBudget: number;
  readonly confirmedNormalSpentBeforeToday: number;
}): number {
  const { isFirstCycle, initialBudget, baseCycleBudget, confirmedNormalSpentBeforeToday } = params;
  if (isFirstCycle) {
    return initialBudget - confirmedNormalSpentBeforeToday;
  }
  return baseCycleBudget - confirmedNormalSpentBeforeToday;
}

/**
 * 初回サイクル締め（次の給料日リセット）: STRICT / YUTORI を適用せず、初回差額のみ貯金総額へ反映する。
 */
export function processFirstCycleClose(params: {
  readonly currentTotalSavings: number;
  readonly initialBudget: number;
  readonly sumPlainNormalSpentInFirstCycle: number;
  readonly baseCycleBudget: number;
}): {
  readonly nextTotalSavings: number;
  readonly nextInitialBudget: number;
} {
  const firstCycleDelta = params.initialBudget - params.sumPlainNormalSpentInFirstCycle;
  return {
    nextTotalSavings: params.currentTotalSavings + firstCycleDelta,
    nextInitialBudget: params.baseCycleBudget,
  };
}

type PlainNormalExpenseRow = {
  readonly type: "NORMAL" | "SPECIAL";
  readonly utility_type: UtilityType | null;
  readonly amount: number;
};

/** 初回サイクル締め・初回残予算などで用いる「普通支出」（type=NORMAL かつ光熱費なし）の合計。 */
export function sumPlainNormalExpenseAmounts(transactions: readonly PlainNormalExpenseRow[]): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.type !== "NORMAL") {
      return sum;
    }
    if (transaction.utility_type !== null) {
      return sum;
    }
    return sum + transaction.amount;
  }, 0);
}

type ProfileLikeTransactionRow = {
  readonly type: "NORMAL" | "SPECIAL";
  readonly utility_type: UtilityType | null;
  readonly amount: number;
};

/**
 * 通常サイクルでサイクル開始〜前日までに確定した支出（普通支出に加え、光熱費は実額と概算の差を織り込む）。
 */
export function calculateConfirmedNormalSpentWithUtilityAdjustment(
  transactions: readonly ProfileLikeTransactionRow[],
  utilityEstimates: UtilityEstimateMap,
): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.type !== "NORMAL") {
      return sum;
    }
    if (transaction.utility_type === null) {
      return sum + transaction.amount;
    }
    const estimate = utilityEstimates[transaction.utility_type];
    return sum - (estimate - transaction.amount);
  }, 0);
}

/**
 * 参照日が属するサイクル開始日と次回給料日を返す。
 */
export function calculateCycleWindow(params: {
  readonly referenceDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): {
  readonly cycleStartDate: Date;
  readonly nextPaydayDate: Date;
} {
  const { referenceDate, payday, paydayRule } = params;
  const currentMonthPayday = calculatePaydayInMonth({
    referenceDate,
    payday,
    paydayRule,
    monthOffset: 0,
  });
  const previousMonthPayday = calculatePaydayInMonth({
    referenceDate,
    payday,
    paydayRule,
    monthOffset: -1,
  });
  const nextMonthPayday = calculatePaydayInMonth({
    referenceDate,
    payday,
    paydayRule,
    monthOffset: 1,
  });

  const referenceDateString = toJstDateString(referenceDate);
  const currentMonthPaydayString = toJstDateString(currentMonthPayday);
  if (referenceDateString >= currentMonthPaydayString) {
    return {
      cycleStartDate: toJstStartOfDay(currentMonthPayday),
      nextPaydayDate: toJstStartOfDay(nextMonthPayday),
    };
  }

  return {
    cycleStartDate: toJstStartOfDay(previousMonthPayday),
    nextPaydayDate: toJstStartOfDay(currentMonthPayday),
  };
}

function calculatePaydayInMonth(params: {
  readonly referenceDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
  readonly monthOffset: number;
}): Date {
  const { referenceDate, payday, paydayRule, monthOffset } = params;
  const jstReferenceDate = toZonedTime(referenceDate, TIMEZONE);
  const monthReference = addMonths(
    createJstDate(jstReferenceDate.getFullYear(), jstReferenceDate.getMonth(), 1),
    monthOffset,
  );
  const targetMonth = toZonedTime(monthReference, TIMEZONE);
  const monthEnd = endOfMonth(createJstDate(targetMonth.getFullYear(), targetMonth.getMonth(), 1));
  const monthLastDay = toZonedTime(monthEnd, TIMEZONE).getDate();
  const resolvedPayday = Math.min(payday, monthLastDay);
  const basePayday = createJstDate(targetMonth.getFullYear(), targetMonth.getMonth(), resolvedPayday);

  return adjustPaydayByRule(basePayday, paydayRule);
}

/**
 * 達成期間（か月）に基づき、目標日（給料日）を算出する。
 * 例: 1か月後 => アンカー日の翌月における給料日。
 */
export function calculateTargetDateFromDuration(params: {
  readonly anchorLogicalDate: Date;
  readonly durationMonths: number;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): Date {
  const { anchorLogicalDate, durationMonths, payday, paydayRule } = params;
  if (durationMonths < 1) {
    throw new Error(`durationMonths must be at least 1: ${durationMonths}`);
  }

  const targetMonthReference = addMonths(anchorLogicalDate, durationMonths);
  return calculatePaydayInMonth({
    referenceDate: targetMonthReference,
    payday,
    paydayRule,
    monthOffset: 0,
  });
}

/**
 * 初回サイクル中かどうかを判定する。
 * 初回サイクル = target_anchor_logical_date（論理日）から最初の給料日前日まで。
 */
export function isWithinFirstCycle(params: {
  readonly anchorLogicalDate: Date;
  readonly referenceDate: Date;
  readonly payday: number;
  readonly paydayRule: PaydayRule;
}): boolean {
  const { anchorLogicalDate, referenceDate, payday, paydayRule } = params;
  const anchorString = toJstDateString(anchorLogicalDate);
  const firstCandidatePayday = calculateNextPayday({
    fromDate: anchorLogicalDate,
    payday,
    paydayRule,
  });
  const firstCandidatePaydayString = toJstDateString(firstCandidatePayday);
  const firstPaydayAfterOnboarding =
    anchorString === firstCandidatePaydayString
      ? calculateNextPayday({
          fromDate: addDays(firstCandidatePayday, 1),
          payday,
          paydayRule,
        })
      : firstCandidatePayday;
  const firstCycleEndDate = subDays(firstPaydayAfterOnboarding, 1);
  const referenceDateString = toJstDateString(referenceDate);
  const firstCycleEndDateString = toJstDateString(firstCycleEndDate);

  return referenceDateString >= anchorString && referenceDateString <= firstCycleEndDateString;
}

/**
 * 月次リセットを実行すべきか判定する。
 */
export function shouldExecuteMonthlyReset(params: {
  readonly isPayday: boolean;
  readonly logicalTodayString: string;
  readonly lastMonthlyResetLogicalDate: string | null;
}): boolean {
  const { isPayday, logicalTodayString, lastMonthlyResetLogicalDate } = params;
  if (!isPayday) {
    return false;
  }
  return lastMonthlyResetLogicalDate !== logicalTodayString;
}
