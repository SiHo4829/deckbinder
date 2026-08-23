import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { clientEnv } from "@/lib/env";

/**
 * RSC · Route Handler · Server Action용 Supabase 클라이언트.
 * 사용자 세션 쿠키를 그대로 태우므로 RLS가 요청자 기준으로 적용된다.
 *
 * Next 16에서 cookies()는 비동기다 (plan §2.4).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 proxy.ts가 담당하므로 여기서는 무시해도 안전하다 (T3.1).
          }
        },
      },
    },
  );
}
