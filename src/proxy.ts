import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE } from "@/lib/admin/session";

/**
 * Next 16에서 middleware는 proxy로 이름이 바뀌었다 (plan §2.4).
 * 런타임은 nodejs 고정이며 edge를 쓸 수 없다.
 *
 * 여기서는 쿠키 "존재" 여부만 본다. 값 검증은 각 라우트에서
 * requireAdmin()이 수행한다 — 인증 판단을 한 곳에만 두면
 * proxy를 우회하는 경로가 생겼을 때 그대로 뚫리기 때문이다.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();

  if (!request.cookies.get(ADMIN_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
