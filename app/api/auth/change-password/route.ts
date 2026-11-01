import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { hashPassword, requireAuth, setAuthCookie, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (typeof currentPassword !== "string" || !currentPassword || !newPassword) {
    return NextResponse.json({ error: "請輸入目前密碼與新密碼" }, { status: 400 });
  }
  if (typeof newPassword !== "string" || newPassword.length < 4) {
    return NextResponse.json({ error: "新密碼至少需要 4 個字元" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findById(auth.userId);
  if (!user) {
    return NextResponse.json({ error: "找不到帳號" }, { status: 404 });
  }

  if (!(await verifyPassword(currentPassword, user.password))) {
    return NextResponse.json({ error: "目前密碼不正確" }, { status: 401 });
  }

  user.password = await hashPassword(newPassword);
  // 改密碼後其他裝置都要重新登入(舊 token 的版本號會對不上);目前這台換發新版本號的 token,不會被登出
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await setAuthCookie({ userId: user._id.toString(), email: user.email, ver: user.tokenVersion });

  return NextResponse.json({ success: true });
}
