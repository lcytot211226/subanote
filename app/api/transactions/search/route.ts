import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import { requireAuth } from "@/lib/auth";
import { generateDueSubscriptionTransactions } from "@/lib/generateSubscriptionTransactions";
import { escapeRegExp, parseKeywords } from "@/lib/searchKeywords";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 一次最多查幾個月、幾個關鍵字、回傳幾筆,避免一次撈太多 */
const MAX_MONTHS = 120;
const MAX_KEYWORDS = 10;
const MAX_RESULTS = 1000;

function monthIndex(period: string) {
  return Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
}

/**
 * 依品名搜尋交易:`?q=關鍵字1,關鍵字2&from=YYYY-MM&to=YYYY-MM`。
 * 關鍵字是品名的子字串就算符合(不分大小寫,任一個符合即可);月份區間比對消費日期 date(含頭尾月份),
 * 不是歸屬月份 billingPeriod——搜尋時想的是「什麼時候買的」,不是哪個月扣款。
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keywords = parseKeywords(searchParams.get("q") ?? "");
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (keywords.length === 0) {
    return NextResponse.json({ error: "請輸入搜尋關鍵字" }, { status: 400 });
  }
  if (keywords.length > MAX_KEYWORDS) {
    return NextResponse.json({ error: `一次最多 ${MAX_KEYWORDS} 個關鍵字` }, { status: 400 });
  }
  if (!PERIOD_RE.test(from) || !PERIOD_RE.test(to) || from > to) {
    return NextResponse.json({ error: "月份區間不正確" }, { status: 400 });
  }
  if (monthIndex(to) - monthIndex(from) + 1 > MAX_MONTHS) {
    return NextResponse.json({ error: `月份區間最多 ${MAX_MONTHS / 12} 年` }, { status: 400 });
  }

  await connectToDatabase();
  // 跟交易列表一樣先補生成到期的訂閱,搜尋結果才會包含最新的訂閱扣款
  await generateDueSubscriptionTransactions(auth.userId);

  // 交易日期一律存成當天 UTC 00:00,所以用 UTC 的月初切區間
  const start = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1));
  const end = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 1));
  const filter = {
    user: auth.userId,
    date: { $gte: start, $lt: end },
    item: { $regex: keywords.map(escapeRegExp).join("|"), $options: "i" },
  };
  const transactions = await Transaction.find(filter)
    .populate("card")
    .sort({ date: -1, createdAt: -1 })
    .limit(MAX_RESULTS + 1);

  return NextResponse.json({
    transactions: transactions.slice(0, MAX_RESULTS),
    truncated: transactions.length > MAX_RESULTS,
  });
}
