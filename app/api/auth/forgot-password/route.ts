import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { sendPasswordResetEmail } from "@/lib/email";
import { clientIp } from "@/lib/rateLimit";
import { checkMailQuota, issueVerificationCode } from "@/lib/security";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (typeof email !== "string" || !email) {
    return NextResponse.json({ error: "請輸入 email" }, { status: 400 });
  }

  await connectToDatabase();

  // 寄信頻率限制不論帳號是否存在都照樣計數;超過限制時一樣回傳成功、只是不寄,
  // 避免從「有沒有被限制」看出 email 是否已註冊。
  const quota = await checkMailQuota(email, clientIp(request));
  if (!quota.allowed) {
    return NextResponse.json({ success: true });
  }

  const user = await User.findOne({ email });
  // 不論帳號是否存在都回傳成功,避免洩漏 email 是否已註冊;只有帳號存在時才真的寄信。
  if (user) {
    const code = await issueVerificationCode(user);
    try {
      await sendPasswordResetEmail(email, code);
    } catch (err) {
      console.error("Failed to send password reset email", err);
      return NextResponse.json({ error: "驗證信寄送失敗,請稍後再試" }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true });
}
