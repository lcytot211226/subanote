import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CustomItem from "@/lib/models/CustomItem";
import { requireAuth } from "@/lib/auth";
import { recomputeOverviewSummary } from "@/lib/recomputeOverviewSummary";
import { formatPeriod } from "@/lib/overviewItems";
import { parseCustomItemDate } from "@/lib/customItemDate";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const { name, amount, date } = await request.json();

  await connectToDatabase();
  const existing = await CustomItem.findOne({ _id: id, user: auth.userId });
  if (!existing) {
    return NextResponse.json({ error: "找不到資料" }, { status: 404 });
  }
  // 沒帶 date 就沿用原值;帶 null / 空字串則清掉
  const day = date === undefined ? { value: existing.date ?? null } : parseCustomItemDate(date, existing.year, existing.month);
  if ("error" in day) {
    return NextResponse.json({ error: day.error }, { status: 400 });
  }

  const item = await CustomItem.findOneAndUpdate(
    { _id: id, user: auth.userId },
    { name, amount, ...(day.value != null ? { date: day.value } : { $unset: { date: 1 } }) },
    { new: true, runValidators: true }
  );
  if (!item) {
    return NextResponse.json({ error: "找不到資料" }, { status: 404 });
  }
  await recomputeOverviewSummary(auth.userId, formatPeriod(item.year, item.month));
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const item = await CustomItem.findOneAndDelete({ _id: id, user: auth.userId });
  if (!item) {
    return NextResponse.json({ error: "找不到資料" }, { status: 404 });
  }
  await recomputeOverviewSummary(auth.userId, formatPeriod(item.year, item.month));
  return NextResponse.json({ success: true });
}
