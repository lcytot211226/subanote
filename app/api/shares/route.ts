import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Share from "@/lib/models/Share";
import { requireAuth } from "@/lib/auth";

/** 我(分享者)分享給哪些 email,用來管理 / 取消分享。 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  await connectToDatabase();
  const shares = await Share.find({ owner: auth.userId }).sort({ createdAt: -1 });

  // 同一個 email 只回一筆(舊資料一個項目存一筆,遷移合併前可能有好幾筆)
  const seen = new Set<string>();
  const unique = shares.filter((s) => !seen.has(s.targetEmail) && !!seen.add(s.targetEmail));

  return NextResponse.json({
    shares: unique.map((s) => ({ _id: s._id.toString(), targetEmail: s.targetEmail })),
  });
}

/** 把我的資料分享給一個 email(不需要是已註冊的帳號);已經分享過就維持原狀。 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { targetEmail } = await request.json();
  const email = typeof targetEmail === "string" ? targetEmail.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "請輸入對方的 email" }, { status: 400 });
  }
  if (email === auth.email.toLowerCase()) {
    return NextResponse.json({ error: "不能分享給自己" }, { status: 400 });
  }

  await connectToDatabase();
  const share = await Share.findOneAndUpdate(
    { owner: auth.userId, targetEmail: email },
    { $setOnInsert: { owner: auth.userId, targetEmail: email, included: false } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ share: { _id: share._id.toString(), targetEmail: share.targetEmail } }, { status: 201 });
}
