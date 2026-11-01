import User from "@/lib/models/User";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { generateOtp, OTP_TTL_MS } from "@/lib/otp";
import { hitRateLimit, peekRateLimit, clearRateLimit, type RateLimitResult } from "@/lib/rateLimit";

/**
 * 帳號安全相關的限制數字與共用邏輯(驗證碼防暴力破解、寄信頻率、登入鎖定)。
 * 數字集中在這裡,要調整只改這個檔案。
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** 一組驗證碼最多可以嘗試幾次,用完就作廢,必須重新寄送 */
export const OTP_MAX_ATTEMPTS = 5;

/** 寄信:同一個 email 重寄要間隔多久、每小時最多幾封;同一個 IP 每小時最多觸發幾封 */
export const MAIL_COOLDOWN_MS = MINUTE;
export const MAIL_PER_EMAIL_PER_HOUR = 5;
export const MAIL_PER_IP_PER_HOUR = 20;

/** 登入:同一個 email + IP 連續輸錯幾次就鎖、鎖多久(從最後一次失敗起算) */
export const LOGIN_FAIL_LIMIT = 3;
export const LOGIN_LOCK_MS = 10 * MINUTE;
/** 登入:同一個 email 不分 IP,每小時最多錯幾次(擋換 IP 暴力破解) */
export const LOGIN_FAIL_PER_EMAIL_PER_HOUR = 20;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// ---------- 寄信頻率 ----------

/**
 * 寄驗證碼信之前呼叫:依序檢查「重寄間隔 → 同 email 每小時 → 同 IP 每小時」,任一項超過就不寄。
 * 回傳 allowed = false 時附上要等幾秒。
 */
export async function checkMailQuota(email: string, ip: string): Promise<RateLimitResult> {
  const key = normalizeEmail(email);
  const checks: [string, number, number][] = [
    [`mail:cooldown:${key}`, 1, MAIL_COOLDOWN_MS],
    [`mail:hour:${key}`, MAIL_PER_EMAIL_PER_HOUR, HOUR],
    [`mail:ip:${ip}`, MAIL_PER_IP_PER_HOUR, HOUR],
  ];
  let last: RateLimitResult = { allowed: true, count: 0, retryAfterSeconds: 0 };
  for (const [k, limit, windowMs] of checks) {
    last = await hitRateLimit(k, limit, windowMs);
    if (!last.allowed) return last;
  }
  return last;
}

// ---------- 驗證碼 ----------

/** 產生新驗證碼並寫進使用者資料(嘗試次數歸零),回傳明碼給呼叫端寄信。 */
export async function issueVerificationCode(user: InstanceType<typeof User>) {
  const code = generateOtp();
  user.verificationCodeHash = await hashPassword(code);
  user.verificationCodeExpires = new Date(Date.now() + OTP_TTL_MS);
  user.verificationAttempts = 0;
  await user.save();
  return code;
}

/**
 * 驗證使用者輸入的驗證碼。先「原子地」把嘗試次數 +1(只在驗證碼存在、未過期、次數未滿時才成功),
 * 再比對雜湊——這樣就算同時送出大量請求,每組驗證碼最多也只會被比對 OTP_MAX_ATTEMPTS 次。
 * 次數用完就把驗證碼清掉,必須重新寄送。
 * 回傳比對成功的使用者(呼叫端自己決定成功後要更新什麼,並清掉驗證碼);失敗回傳 null。
 */
export async function consumeVerificationCode(email: string, code: string) {
  const user = await User.findOneAndUpdate(
    {
      email,
      verificationCodeHash: { $ne: null },
      verificationCodeExpires: { $gt: new Date() },
      $or: [{ verificationAttempts: { $exists: false } }, { verificationAttempts: { $lt: OTP_MAX_ATTEMPTS } }],
    },
    { $inc: { verificationAttempts: 1 } },
    { new: true }
  );
  if (!user || !user.verificationCodeHash) return null;

  if (await verifyPassword(code, user.verificationCodeHash)) return user;

  if ((user.verificationAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    await User.updateOne(
      { _id: user._id },
      { verificationCodeHash: null, verificationCodeExpires: null, verificationAttempts: 0 }
    );
  }
  return null;
}

/** 驗證成功後清掉驗證碼 */
export function clearVerificationCode(user: InstanceType<typeof User>) {
  user.verificationCodeHash = null;
  user.verificationCodeExpires = null;
  user.verificationAttempts = 0;
}

// ---------- 登入鎖定 ----------

function loginKeys(email: string, ip: string) {
  const key = normalizeEmail(email);
  return { pair: `login:fail:${key}:${ip}`, email: `login:fail:${key}` };
}

/** 登入前檢查是否被鎖(不增加計數)。被鎖時 allowed = false,附上剩餘秒數。 */
export async function checkLoginLock(email: string, ip: string): Promise<RateLimitResult> {
  const keys = loginKeys(email, ip);
  const pair = await peekRateLimit(keys.pair, LOGIN_FAIL_LIMIT);
  if (!pair.allowed) return pair;
  return peekRateLimit(keys.email, LOGIN_FAIL_PER_EMAIL_PER_HOUR);
}

/** 登入失敗時呼叫:email + IP 的連續失敗(每次失敗都重新計時 10 分鐘),以及 email 每小時總失敗次數。 */
export async function recordLoginFailure(email: string, ip: string) {
  const keys = loginKeys(email, ip);
  await hitRateLimit(keys.pair, LOGIN_FAIL_LIMIT, LOGIN_LOCK_MS, { sliding: true });
  await hitRateLimit(keys.email, LOGIN_FAIL_PER_EMAIL_PER_HOUR, HOUR);
}

/** 登入成功:清掉這個 email + IP 的連續失敗計數。email 每小時總數不清,它是用來擋換 IP 暴力破解的,不因某一處登入成功就歸零。 */
export async function clearLoginFailures(email: string, ip: string) {
  await clearRateLimit(loginKeys(email, ip).pair);
}
