import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * service_role 키를 쓰는 관리자 클라이언트. **RLS를 우회한다.**
 *
 * 사용 범위를 좁게 유지할 것:
 * - 시드 · 배치 수집(카드 마스터, 기준가 갱신)
 * - market_sessions 등 클라이언트 접근 금지 테이블 조작
 *
 * 사용자 요청을 대신 처리할 때는 절대 쓰지 말고 server.ts를 쓴다.
 * 여기서 처리하면 RLS 검사가 사라져 남의 데이터에 접근할 수 있다.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
