/**
 * 支出分類(Transaction.kind)。只有支出有分類,收入沒有。
 * 注意:`category` 欄位已經用來表示付款方式(現金 / 信用卡 / 分期),分類另外用 `kind`。
 */
export const EXPENSE_KINDS = [
  "food",
  "entertainment",
  "shop",
  "transport",
  "medical",
  "learning",
  "sport",
  "other",
] as const;

export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const DEFAULT_EXPENSE_KIND: ExpenseKind = "other";

export const EXPENSE_KIND_LABEL: Record<ExpenseKind, string> = {
  food: "食物",
  entertainment: "娛樂",
  shop: "商店",
  transport: "交通",
  medical: "醫療",
  learning: "學習",
  sport: "運動",
  other: "其他",
};

export function isExpenseKind(value: unknown): value is ExpenseKind {
  return typeof value === "string" && (EXPENSE_KINDS as readonly string[]).includes(value);
}

/** 沒有分類(舊資料、收入)一律視為「其他」。 */
export function expenseKindOf(t: { kind?: string | null }): ExpenseKind {
  return isExpenseKind(t.kind) ? t.kind : DEFAULT_EXPENSE_KIND;
}
