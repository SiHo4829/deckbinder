import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { UNAUTHORIZED } from "@/lib/admin/responses";
import { ADMIN_COOKIE, isValidAdminCookie } from "@/lib/admin/session";

/**
 * 관리자 API의 실제 인증 지점.
 * proxy.ts는 쿠키 존재만 보므로, 값 검증은 반드시 여기서 한다.
 * Next 16에서 cookies()는 비동기다 (plan §2.4).
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const store = await cookies();
  if (!isValidAdminCookie(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json(UNAUTHORIZED, { status: 401 });
  }
  return null;
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminCookie(store.get(ADMIN_COOKIE)?.value);
}
