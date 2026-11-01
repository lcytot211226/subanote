import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, signAuthToken, validateSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login", "/register", "/verify-email", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // 驗簽章與效期;距離上次確認超過 30 分鐘才查資料庫比對版本號(見 lib/auth.ts 的 validateSession)
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const result = token ? await validateSession(token) : null;

  if (!result) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    // 已被撤銷 / 無效的 token 順便清掉
    if (token) response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // 每次請求都重新簽發並延長 cookie 效期(sliding session),只要 30 天內有造訪就一直維持登入。
  // 有查資料庫確認時用確認過的新 token(chk 更新);沒查時沿用原本的 chk,只延長效期——
  // 不能在沒確認的情況下更新 chk,否則偷來的 token 只要一直用就永遠不會被檢查。
  const refreshedToken = result.refreshedToken ?? (await signAuthToken(result.user));

  // 新 token 也帶進這次請求本身,頁面的 Server Component(getCurrentUser)讀到的就是剛確認過的 token,
  // 不會因為 chk 還是舊的而再查一次資料庫。
  request.cookies.set(AUTH_COOKIE_NAME, refreshedToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(AUTH_COOKIE_NAME, refreshedToken, AUTH_COOKIE_OPTIONS);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
