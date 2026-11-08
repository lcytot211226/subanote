import Transaction from "@/lib/models/Transaction";
import Utility from "@/lib/models/Utility";
import { summarizeMonth, type MonthSummary, type SummaryUtility } from "@/lib/summarizeMonth";
import { netAmount } from "@/lib/pointsDiscount";

type LeanTransaction = {
  user: { toString(): string };
  type: "income" | "expense";
  date: Date;
  category: "installment" | "cash" | "credit_card";
  kind?: string | null;
  amount: number;
  pointsDiscount?: number | null;
  billingPeriod: string;
  subscription?: unknown;
  card?: { toString(): string } | null;
};

type LeanUtility = SummaryUtility & { user: { toString(): string }; year: number; month: number; date?: number };

export type MonthData = { transactions: LeanTransaction[]; utility: LeanUtility | null };

const key = (userId: string, period: string) => `${userId}:${period}`;

/**
 * 一次查出多個使用者、多個月份的原始資料(交易 + 房租水電),依「使用者:月份」分組。
 * 不讀任何快取:年度檢視與別人分享給我的資料都是每次從原始資料即時算。
 */
export async function loadMonthData(userIds: string[], periods: string[]): Promise<Map<string, MonthData>> {
  const result = new Map<string, MonthData>();
  if (userIds.length === 0 || periods.length === 0) return result;

  const yearMonths = periods.map((p) => {
    const [year, month] = p.split("-").map(Number);
    return { year, month };
  });
  const [transactions, utilities] = await Promise.all([
    Transaction.find({ user: { $in: userIds }, billingPeriod: { $in: periods } })
      .select("user type date category kind amount pointsDiscount billingPeriod subscription card")
      .lean<LeanTransaction[]>(),
    Utility.find({ user: { $in: userIds }, $or: yearMonths }).lean<LeanUtility[]>(),
  ]);

  const get = (k: string) => {
    let data = result.get(k);
    if (!data) {
      data = { transactions: [], utility: null };
      result.set(k, data);
    }
    return data;
  };
  for (const t of transactions) get(key(t.user.toString(), t.billingPeriod)).transactions.push(t);
  for (const u of utilities) {
    const period = `${u.year}-${String(u.month).padStart(2, "0")}`;
    get(key(u.user.toString(), period)).utility = u;
  }
  return result;
}

export function monthDataFor(data: Map<string, MonthData>, userId: string, period: string): MonthData {
  return data.get(key(userId, period)) ?? { transactions: [], utility: null };
}

export function summarizeMonthData({ transactions, utility }: MonthData): MonthSummary {
  return summarizeMonth({
    transactions: transactions.map((t) => ({
      type: t.type,
      category: t.category,
      amount: netAmount(t),
      subscription: t.subscription ?? null,
      cardId: t.card ? t.card.toString() : null,
    })),
    utility,
  });
}
