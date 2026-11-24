import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/lib/models/Card";
import Share from "@/lib/models/Share";
import { requireAuth } from "@/lib/auth";
import { generateDueSubscriptionTransactions } from "@/lib/generateSubscriptionTransactions";
import { loadMonthData, monthDataFor, summarizeMonthData } from "@/lib/computeMonthSummaries";
import { formatPeriod } from "@/lib/period";

/**
 * /overview 的年度檢視:某年 12 個月的收支,每次都從原始資料(交易 + 房租水電)即時算,不讀快取。
 * 自己的收支以外,另外附上每個月別人分享給我、且目前勾選納入(included)的資料收入 / 支出
 * (sharedIncome / sharedExpense,以及各分項 sharedCash / sharedInstallment / sharedSubscription / sharedUtility),要不要計入由前端切換。自己和所有分享者的資料一次查完。
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    return NextResponse.json({ error: "缺少或格式錯誤的 year" }, { status: 400 });
  }

  await connectToDatabase();
  // 跟交易列表一樣,先補生成到期的訂閱交易,年度數字才不會漏掉最新的扣款。
  await generateDueSubscriptionTransactions(auth.userId);

  const periods = Array.from({ length: 12 }, (_, i) => formatPeriod(year, i + 1));
  const [cards, includedShares] = await Promise.all([
    Card.find({ user: auth.userId }).sort({ createdAt: 1 }),
    Share.find({ targetEmail: auth.email.toLowerCase(), included: true }).select("owner"),
  ]);
  const ownerIds = Array.from(new Set(includedShares.map((s) => s.owner.toString())));
  const data = await loadMonthData([auth.userId, ...ownerIds], periods);

  const months = periods.map((period) => {
    const s = summarizeMonthData(monthDataFor(data, auth.userId, period));
    // 已納入的分享者這個月的收支與各分項(前端計入共享時加進自己的數字,並在底下標共享多少)
    const shared = { income: 0, expense: 0, cash: 0, installment: 0, subscription: 0, utility: 0 };
    for (const ownerId of ownerIds) {
      const o = summarizeMonthData(monthDataFor(data, ownerId, period));
      shared.income += o.income;
      shared.expense += o.expense;
      shared.cash += o.cash;
      shared.installment += o.installment;
      shared.subscription += o.subscription;
      shared.utility += o.utility;
    }
    return {
      period,
      income: s.income,
      expense: s.expense,
      balance: s.balance,
      cash: s.cash,
      installment: s.installment,
      subscription: s.subscription,
      utility: s.utility,
      cards: s.cards,
      sharedIncome: shared.income,
      sharedExpense: shared.expense,
      sharedCash: shared.cash,
      sharedInstallment: shared.installment,
      sharedSubscription: shared.subscription,
      sharedUtility: shared.utility,
    };
  });

  return NextResponse.json({
    year,
    months,
    cards: cards.map((c) => ({ _id: String(c._id), name: c.name, isDebit: !!c.isDebit, pattern: c.pattern ?? null })),
  });
}
