import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * 관리자 API의 공통 응답 처리.
 * 라우트마다 같은 매핑을 반복하면 문구와 상태 코드가 어긋나기 쉽다.
 */

/** Postgres 오류 코드 → 사용자에게 보여줄 문구 */
const PG_ERROR: Record<string, { message: string; status: number }> = {
  // unique_violation — 같은 게임에 같은 코드가 이미 있다.
  "23505": { message: "이미 등록된 코드입니다.", status: 409 },
  // foreign_key_violation — 세트가 카드와 다른 게임일 때도 여기로 온다.
  "23503": { message: "선택한 세트가 이 게임에 속하지 않습니다.", status: 409 },
  // not_null_violation
  "23502": { message: "필수 항목이 비어 있습니다.", status: 400 },
};

export function invalidInput(error: z.ZodError): NextResponse {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? "입력이 올바르지 않습니다." },
    { status: 400 },
  );
}

export function databaseError(
  error: { code?: string; message?: string },
  fallback: string,
  context: string,
): NextResponse {
  const known = error.code ? PG_ERROR[error.code] : undefined;
  if (known) {
    return NextResponse.json({ error: known.message }, { status: known.status });
  }

  // 예상 못 한 오류는 원문을 서버에만 남기고 클라이언트에는 일반 문구를 준다.
  console.error(`[${context}]`, error.code, error.message);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export const UNAUTHORIZED = { error: "인증이 필요합니다." } as const;
