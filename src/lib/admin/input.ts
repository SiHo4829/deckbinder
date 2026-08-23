import "server-only";

import type { NextResponse } from "next/server";
import type { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { invalidInput } from "@/lib/admin/responses";

type Guarded<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * 관리자 라우트의 공통 앞단 — 인증 + 본문 파싱.
 *
 * 6개 라우트가 `requireAdmin()` → `safeParse` → `invalidInput`을 그대로 반복하고 있었다.
 * 특히 `request.json()`은 본문이 깨졌을 때 **던진다.** `.catch(() => null)`을 빠뜨린
 * 라우트는 400이 아니라 500을 내는데, 손으로 반복하는 한 언젠가 빠뜨린다.
 *
 * 래퍼(handler를 감싸는 형태)가 아니라 가드 절로 둔 이유: 라우트의 export 시그니처를
 * 그대로 남겨야 Next 16이 생성하는 `RouteContext<"...">` 타입 검사가 성립한다.
 *
 * 인증 판단은 늘리지 않는다 — `requireAdmin()`이 여전히 유일한 검증 지점이다.
 */
export async function requireAdminInput<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<Guarded<z.infer<S>>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, response: denied };

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { ok: false, response: invalidInput(parsed.error) };

  return { ok: true, data: parsed.data as z.infer<S> };
}
