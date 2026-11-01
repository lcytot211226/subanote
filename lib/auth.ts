import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/lib/models/User";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable in .env.local");
}

const secretKey = new TextEncoder().encode(JWT_SECRET);

/** 唯一能使用 /admin 後台功能(例如發送系統通知)的帳號。 */
export const ADMIN_EMAIL = "lcytot211226@gmail.com";

export const AUTH_COOKIE_NAME = "auth_token";
// Session TTL 拉長,並在 proxy.ts 內每次請求時滑動延長(sliding session),
// 只要使用者在效期內有造訪過,登入就會一直維持,達到「自動保持登入」的效果。
const TOKEN_TTL = "30d";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE,
};

/**
 * 登入狀態多久跟資料庫比對一次版本號(秒)。token 只靠簽章驗證的話,被偷走或改密碼後舊 token 仍然有效;
 * 所以 token 裡記錄 ver(簽發時的 User.tokenVersion)與 chk(上次跟資料庫確認的時間),
 * 超過這個間隔才查一次資料庫比對 ver,對不上(改過密碼 / 登出所有裝置)就視為登出。
 */
export const SESSION_RECHECK_SECONDS = 30 * 60;

export type AuthTokenPayload = {
  userId: string;
  email: string;
  /** 簽發時的 User.tokenVersion */
  ver: number;
  /** 上次跟資料庫確認版本的時間(epoch 秒) */
  chk: number;
};

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email, ver: payload.ver, chk: payload.chk })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey);
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    // 加入撤銷機制之前簽發的舊 token 沒有 ver / chk:ver 視為 0,chk 視為 0(下一次一定會去資料庫確認)
    const ver = typeof payload.ver === "number" ? payload.ver : 0;
    const chk = typeof payload.chk === "number" ? payload.chk : 0;
    return { userId: payload.sub, email: payload.email, ver, chk };
  } catch {
    return null;
  }
}

/**
 * 驗證登入 token:先驗簽章與效期(不碰資料庫);距離上次確認超過 SESSION_RECHECK_SECONDS 才查資料庫比對版本號。
 * - 回傳 null:token 無效、過期,或版本號對不上(已被撤銷)。
 * - refreshedToken:這次有去資料庫確認過,chk 更新成現在的新 token,呼叫端應寫回 cookie;沒查資料庫則為 null。
 *   注意:沒查資料庫時不能自己更新 chk 換發,否則偷來的 token 只要一直使用就永遠不會被檢查。
 */
export async function validateSession(
  token: string
): Promise<{ user: AuthTokenPayload; refreshedToken: string | null } | null> {
  const payload = await verifyAuthToken(token);
  if (!payload) return null;

  const now = nowSeconds();
  if (now - payload.chk < SESSION_RECHECK_SECONDS) {
    return { user: payload, refreshedToken: null };
  }

  try {
    await connectToDatabase();
    const doc = await User.findById(payload.userId, { email: 1, tokenVersion: 1 }).lean();
    if (!doc || (doc.tokenVersion ?? 0) !== payload.ver) return null;
    const user: AuthTokenPayload = { ...payload, email: doc.email, chk: now };
    return { user, refreshedToken: await signAuthToken(user) };
  } catch {
    return null;
  }
}

/**
 * 供 Server Component / Route Handler 使用,讀取目前登入的使用者(未登入或已被撤銷則回傳 null)。
 * 有去資料庫確認時會嘗試把新 token 寫回 cookie:Route Handler 寫得進去;Server Component 不能寫 cookie,
 * 會直接略過——頁面請求在 proxy.ts 就已經確認並換發過,這裡通常不需要再查。
 */
export async function getCurrentUser(): Promise<AuthTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await validateSession(token);
  if (!result) return null;
  if (result.refreshedToken) {
    try {
      cookieStore.set(AUTH_COOKIE_NAME, result.refreshedToken, AUTH_COOKIE_OPTIONS);
    } catch {
      // Server Component 裡不能設定 cookie,忽略即可
    }
  }
  return result.user;
}

/** 登入 / 改密碼後簽發新 token 並寫進 cookie(chk = 現在)。 */
export async function setAuthCookie(user: { userId: string; email: string; ver: number }) {
  const token = await signAuthToken({ ...user, chk: nowSeconds() });
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
}

/** 供 API Route 使用,未登入時回傳 null,呼叫端應回應 401。 */
export async function requireAuth(): Promise<AuthTokenPayload | null> {
  return getCurrentUser();
}
