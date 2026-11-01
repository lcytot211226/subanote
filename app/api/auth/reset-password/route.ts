import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";
import { clearVerificationCode, consumeVerificationCode, OTP_MAX_ATTEMPTS } from "@/lib/security";

export async function POST(request: Request) {
  const { email, code, newPassword } = await request.json();
  if (
    typeof email !== "string" ||
    !email ||
    typeof code !== "string" ||
    !code ||
    typeof newPassword !== "string" ||
    newPassword.length < 4
  ) {
    return NextResponse.json({ error: "請完整填寫 email、驗證碼與新密碼(至少 4 個字元)" }, { status: 400 });
  }

  await connectToDatabase();
  // 每組驗證碼最多試 5 次(先原子地扣次數再比對),用完就作廢,擋暴力猜碼接管帳號
  const user = await consumeVerificationCode(email, code);
  if (!user) {
    return NextResponse.json(
      { error: `驗證碼錯誤或已失效(每組驗證碼最多可試 ${OTP_MAX_ATTEMPTS} 次),請重新寄送` },
      { status: 400 }
    );
  }

  user.password = await hashPassword(newPassword);
  // 能收到驗證碼代表確實擁有這個信箱,順便標記為已啟用。
  user.emailVerified = true;
  clearVerificationCode(user);
  // 重設密碼後,所有已登入的裝置都要重新登入(舊 token 的版本號會對不上)
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  return NextResponse.json({ success: true });
}
