import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 관리자 인증 (임시).
 *
 * 관리자 화면은 service_role로 쓰기를 수행하므로 RLS 보호를 받지 않는다.
 * 따라서 반드시 서버에서 막아야 한다. 지금은 환경변수 토큰 1개를 쓰고,
 * 계정 기반 권한 분리는 T3.1(OAuth) 이후로 미룬다.
 */
export const ADMIN_COOKIE = "deckbinder_admin";

function adminToken(): string {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 16) {
    throw new Error(
      "ADMIN_TOKEN이 없거나 너무 짧습니다(16자 이상). .env.local을 확인하세요.",
    );
  }
  return token;
}

/** 쿠키에는 토큰 원문이 아니라 해시를 넣는다. */
export function adminCookieValue(): string {
  return createHash("sha256").update(adminToken()).digest("hex");
}

/** 길이가 달라도 예외를 던지지 않고, 비교 시간이 입력에 의존하지 않게 한다. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isValidAdminToken(input: string): boolean {
  return safeEqual(input, adminToken());
}

export function isValidAdminCookie(value: string | undefined): boolean {
  if (!value) return false;
  return safeEqual(value, adminCookieValue());
}
