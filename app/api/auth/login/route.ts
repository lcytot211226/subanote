import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { setAuthCookie, verifyPassword } from "@/lib/auth";
import { clientIp, formatWait } from "@/lib/rateLimit";
import { checkLoginLock, clearLoginFailures, recordLoginFailure } from "@/lib/security";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "請輸入 email 與密碼" }, { status: 400 });
  }

  await connectToDatabase();
  const ip = clientIp(request);

  // 同一個 email + IP 連續輸錯 3 次鎖 10 分鐘;同一個 email 不分 IP 每小時錯 20 次也鎖(見 lib/security.ts)。
  // 被鎖時連密碼都不比對,鎖定期間的嘗試也不會延長鎖定。
  const lock = await checkLoginLock(email, ip);
  if (!lock.allowed) {
    return NextResponse.json(
      { error: `密碼錯誤次數過多,請 ${formatWait(lock.retryAfterSeconds)}後再試` },
      { status: 429, headers: { "Retry-After": String(lock.retryAfterSeconds) } }
    );
  }

  const user = await User.findOne({ email });
  if (!user || !(await verifyPassword(password, user.password))) {
    // 帳號不存在也一樣計數,避免從鎖不鎖看出帳號是否存在
    await recordLoginFailure(email, ip);
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }

  await clearLoginFailures(email, ip);

  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "帳號尚未啟用,請輸入驗證碼", needsVerification: true, email: user.email },
      { status: 403 }
    );
  }

  await setAuthCookie({ userId: user._id.toString(), email: user.email, ver: user.tokenVersion ?? 0 });
  return NextResponse.json({ success: true });
}
