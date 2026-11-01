import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import RewardPlan from "@/lib/models/RewardPlan";
import { requireAuth } from "@/lib/auth";
import { parseTerms } from "@/lib/rewardPlan";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const { name, terms } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "請輸入方案名稱" }, { status: 400 });
  }
  const parsed = parseTerms(terms);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await connectToDatabase();
  const plan = await RewardPlan.findOneAndUpdate(
    { _id: id, user: auth.userId },
    { name: name.trim(), terms: parsed.value },
    { new: true, runValidators: true }
  );
  if (!plan) {
    return NextResponse.json({ error: "找不到方案" }, { status: 404 });
  }
  return NextResponse.json({ plan });
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const plan = await RewardPlan.findOneAndDelete({ _id: id, user: auth.userId });
  if (!plan) {
    return NextResponse.json({ error: "找不到方案" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
