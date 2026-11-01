import RateLimit from "@/lib/models/RateLimit";

export type RateLimitResult = { allowed: boolean; count: number; retryAfterSeconds: number };

function retryAfter(expiresAt: Date | undefined | null) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

/**
 * 對 key 計數一次並判斷是否超過上限(原子操作,同時大量請求也不會算錯)。
 * - 固定窗口(預設):第一次計數起算 windowMs,窗口過了就從 1 重新算。
 * - sliding:每計數一次就把到期時間重設為現在 + windowMs(用在登入失敗:最後一次失敗後再鎖 windowMs)。
 * allowed = 計數後仍 <= limit。
 */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  { sliding = false }: { sliding?: boolean } = {}
): Promise<RateLimitResult> {
  const now = new Date();
  const newExpiry = new Date(now.getTime() + windowMs);
  // TTL 刪除有延遲,已過期但還沒被刪的紀錄要當作重新開始
  const expired = { $or: [{ $eq: [{ $type: "$expiresAt" }, "missing"] }, { $lte: ["$expiresAt", now] }] };
  const doc = await RateLimit.findOneAndUpdate(
    { key },
    [
      {
        $set: {
          key,
          count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
          expiresAt: sliding ? newExpiry : { $cond: [expired, newExpiry, "$expiresAt"] },
        },
      },
    ],
    { upsert: true, new: true, updatePipeline: true }
  ).lean();
  const count = doc?.count ?? 1;
  return { allowed: count <= limit, count, retryAfterSeconds: retryAfter(doc?.expiresAt) };
}

/** 只查目前計數,不增加(登入前先看是不是已經被鎖)。 */
export async function peekRateLimit(key: string, limit: number): Promise<RateLimitResult> {
  const doc = await RateLimit.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
  const count = doc?.count ?? 0;
  return { allowed: count < limit, count, retryAfterSeconds: retryAfter(doc?.expiresAt) };
}

export async function clearRateLimit(key: string) {
  await RateLimit.deleteOne({ key });
}

/**
 * 取得請求來源 IP。部署在 Vercel 這類平台時 x-forwarded-for 由平台設定,第一個值是真正的使用者 IP;
 * 本機開發沒有這個 header 時退回 "unknown"(所有本機請求共用同一個 IP 計數)。
 */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 等待時間的顯示文字:滿 1 分鐘以上顯示「N 分鐘」(無條件進位),否則「N 秒」 */
export function formatWait(seconds: number) {
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `${m} 分鐘`;
  }
  return `${seconds} 秒`;
}
