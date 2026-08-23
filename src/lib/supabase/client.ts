import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

/** 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트. anon key만 사용한다. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
