import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { clientIp, formatWait } from "@/lib/rateLimit";
import { checkMailQuota, issueVerificationCode } from "@/lib/security";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "請輸入 email 與密碼" }, { status: 400 });
  }

  await connectToDatabase();

  const existingUser = await User.findOne({ email });
  if (existingUser?.emailVerified) {
    return NextResponse.json({ error: "此 email 已被註冊" }, { status: 409 });
  }

  // 註冊會寄驗證信:同一個 email 重寄間隔 60 秒、每小時 5 封,同一個 IP 每小時 20 封(見 lib/security.ts)
  const quota = await checkMailQuota(email, clientIp(request));
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `寄信太頻繁,請 ${formatWait(quota.retryAfterSeconds)}後再試` },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } }
    );
  }

  const passwordHash = await hashPassword(password);
  // 尚未啟用過的帳號重新註冊:視為重新寄送驗證碼,並套用這次填的新密碼。
  const user =
    existingUser ??
    new User({ email, createDate: new Date(), emailVerified: false });
  user.password = passwordHash;
  const code = await issueVerificationCode(user);

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error("Failed to send verification email", err);
    return NextResponse.json(
      { success: true, email, error: "帳號已建立,但驗證信寄送失敗,請到下一步頁面重新寄送" },
      { status: 201 }
    );
  }

  return NextResponse.json({ success: true, email }, { status: 201 });
}
