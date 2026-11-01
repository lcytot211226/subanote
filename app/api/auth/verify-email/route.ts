import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { clearVerificationCode, consumeVerificationCode, OTP_MAX_ATTEMPTS } from "@/lib/security";

export async function POST(request: Request) {
  const { email, code } = await request.json();
  if (typeof email !== "string" || typeof code !== "string" || !email || !code) {
    return NextResponse.json({ error: "請輸入 email 與驗證碼" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await User.findOne({ email }, { emailVerified: 1 });
  if (existing?.emailVerified) {
    return NextResponse.json({ success: true });
  }

  // 每組驗證碼最多試 5 次(先原子地扣次數再比對,同時大量送也一樣);錯誤訊息不透露剩幾次,
  // 帳號不存在、過期、次數用完、輸錯都回同一句。
  const user = await consumeVerificationCode(email, code);
  if (!user) {
    return NextResponse.json(
      { error: `驗證碼錯誤或已失效(每組驗證碼最多可試 ${OTP_MAX_ATTEMPTS} 次),請重新寄送` },
      { status: 400 }
    );
  }

  user.emailVerified = true;
  clearVerificationCode(user);
  await user.save();

  return NextResponse.json({ success: true });
}
