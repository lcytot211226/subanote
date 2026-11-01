/** 收入分類(Transaction.kind,type = income 時)。支出分類見 lib/expenseKind.ts。 */
export const INCOME_KINDS = ["salary", "bonus", "transfer", "other"] as const;

export type IncomeKind = (typeof INCOME_KINDS)[number];

export const INCOME_KIND_LABEL: Record<IncomeKind, string> = {
  salary: "薪水",
  bonus: "獎金",
  transfer: "轉帳",
  other: "其他",
};

export function isIncomeKind(value: unknown): value is IncomeKind {
  return typeof value === "string" && (INCOME_KINDS as readonly string[]).includes(value);
}
