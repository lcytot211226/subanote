import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { AUTH_COOKIE_NAME, requireAuth } from "@/lib/auth";

/**
 * 登出所有裝置:把 User.tokenVersion +1,所有已簽發的 token 版本號都對不上,
 * 其他裝置最晚在下一次確認(30 分鐘內)被登出;目前這台直接清掉 cookie 立即登出。
 */
export async function POST() {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  await connectToDatabase();
  await User.updateOne({ _id: auth.userId }, { $inc: { tokenVersion: 1 } });

  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
