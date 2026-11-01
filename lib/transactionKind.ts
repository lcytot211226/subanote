import { EXPENSE_KINDS, EXPENSE_KIND_LABEL, isExpenseKind, type ExpenseKind } from "./expenseKind";
import { INCOME_KINDS, INCOME_KIND_LABEL, isIncomeKind, type IncomeKind } from "./incomeKind";

/**
 * 交易分類(Transaction.kind):支出用 lib/expenseKind.ts 那組,收入用 lib/incomeKind.ts 那組,
 * 兩組共用「其他」(other)。沒有分類或分類跟收支類型對不上時,一律視為「其他」。
 */
export type TransactionKind = ExpenseKind | IncomeKind;
export type TransactionType = "income" | "expense";

export const DEFAULT_KIND = "other" as const;

/** Mongoose enum 用:兩組合併去重 */
export const ALL_KINDS = [...new Set<string>([...EXPENSE_KINDS, ...INCOME_KINDS])] as TransactionKind[];

export const KIND_LABEL: Record<TransactionKind, string> = { ...EXPENSE_KIND_LABEL, ...INCOME_KIND_LABEL };

export function kindsFor(type: TransactionType): readonly TransactionKind[] {
  return type === "income" ? INCOME_KINDS : EXPENSE_KINDS;
}

export function isKindFor(type: TransactionType, value: unknown): value is TransactionKind {
  return type === "income" ? isIncomeKind(value) : isExpenseKind(value);
}

export function kindOf(t: { type: TransactionType; kind?: string | null }): TransactionKind {
  return isKindFor(t.type, t.kind) ? t.kind : DEFAULT_KIND;
}
