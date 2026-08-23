import "server-only";

import { createClient } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 쿠키를 읽지 않는 익명 읽기 클라이언트.
 *
 * `server.ts`는 `await cookies()`를 호출한다. `cookies()`는 Next의 Request-time API라
 * 이를 쓰는 세그먼트는 **강제로 동적 렌더링**된다 — `revalidate`를 붙여도 ISR이 성립하지 않는다.
 *
 * "누가 보든 결과가 같은" 공개 읽기(뉴스 · sitemap · 정적 생성)는 이 클라이언트를 쓴다.
 * anon 키이므로 RLS는 그대로 적용된다 (초안은 여전히 보이지 않는다).
 */
export function createSupabaseAnonClient() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
