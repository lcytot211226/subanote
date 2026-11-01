import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CustomItem from "@/lib/models/CustomItem";
import { requireAuth } from "@/lib/auth";
import { recomputeOverviewSummary } from "@/lib/recomputeOverviewSummary";
import { formatPeriod } from "@/lib/overviewItems";
import { parseCustomItemDate } from "@/lib/customItemDate";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const filter: Record<string, unknown> = { user: auth.userId };
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);

  await connectToDatabase();
  const items = await CustomItem.find(filter).sort({ createdAt: 1 });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { year, month, name, amount, date } = await request.json();
  if (!year || !month || !name) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }
  const day = parseCustomItemDate(date, year, month);
  if ("error" in day) {
    return NextResponse.json({ error: day.error }, { status: 400 });
  }

  await connectToDatabase();
  const item = await CustomItem.create({
    user: auth.userId,
    year,
    month,
    name,
    amount: amount ?? 0,
    // 沒填日期就不寫這個欄位
    ...(day.value != null ? { date: day.value } : {}),
  });
  await recomputeOverviewSummary(auth.userId, formatPeriod(year, month));
  return NextResponse.json({ item }, { status: 201 });
}
