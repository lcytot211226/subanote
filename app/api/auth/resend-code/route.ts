import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { sendVerificationEmail } from "@/lib/email";
import { clientIp, formatWait } from "@/lib/rateLimit";
import { checkMailQuota, issueVerificationCode } from "@/lib/security";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (typeof email !== "string" || !email) {
    return NextResponse.json({ error: "請輸入 email" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email });
  if (!user) {
    return NextResponse.json({ error: "找不到帳號" }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ error: "帳號已啟用,請直接登入" }, { status: 400 });
  }

  const quota = await checkMailQuota(email, clientIp(request));
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `寄信太頻繁,請 ${formatWait(quota.retryAfterSeconds)}後再試` },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } }
    );
  }

  const code = await issueVerificationCode(user);

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error("Failed to resend verification email", err);
    return NextResponse.json({ error: "驗證信寄送失敗,請稍後再試" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
