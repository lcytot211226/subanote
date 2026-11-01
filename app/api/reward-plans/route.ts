import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import RewardPlan from "@/lib/models/RewardPlan";
import { requireAuth } from "@/lib/auth";
import { MAX_REWARD_PLANS, parseTerms } from "@/lib/rewardPlan";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  await connectToDatabase();
  const plans = await RewardPlan.find({ user: auth.userId }).sort({ createdAt: 1 });
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { name, terms } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "請輸入方案名稱" }, { status: 400 });
  }
  const parsed = parseTerms(terms);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await RewardPlan.find({ user: auth.userId }, { colorIndex: 1 });
  if (existing.length >= MAX_REWARD_PLANS) {
    return NextResponse.json({ error: `最多 ${MAX_REWARD_PLANS} 個方案` }, { status: 400 });
  }
  // 顏色跟著方案走:取第一個沒被用到的槽位,刪掉別的方案也不會讓這個方案變色
  const used = new Set(existing.map((p) => p.colorIndex));
  const colorIndex = Array.from({ length: MAX_REWARD_PLANS }, (_, i) => i).find((i) => !used.has(i)) ?? 0;

  const plan = await RewardPlan.create({ user: auth.userId, name: name.trim(), terms: parsed.value, colorIndex });
  return NextResponse.json({ plan }, { status: 201 });
}
