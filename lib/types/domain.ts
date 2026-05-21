/**
 * ドメイン上の列挙型・マップ型。
 * DB の enum とアプリ層のバリデーションで共有する（`lib/types/database.ts` は Supabase 生成型）。
 */

export const PAYDAY_RULE_VALUES = ["BEFORE", "AFTER", "FIXED"] as const;
export const SURPLUS_MODE_VALUES = ["STRICT", "YUTORI"] as const;
export const UTILITY_TYPE_VALUES = ["ELECTRICITY", "GAS", "WATER"] as const;

export type PaydayRule = (typeof PAYDAY_RULE_VALUES)[number];
export type SurplusMode = (typeof SURPLUS_MODE_VALUES)[number];
export type UtilityType = (typeof UTILITY_TYPE_VALUES)[number];

/** 光熱費種別ごとの概算（profiles の estimated_* から組み立てる） */
export type UtilityEstimateMap = Readonly<Record<UtilityType, number>>;

/** 支出集計用の最小行（transactions の一部カラム） */
export type TransactionAmountRow = {
  readonly type: "NORMAL" | "SPECIAL";
  readonly utility_type: UtilityType | null;
  readonly amount: number;
};
