import { describe, expect, it } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// 실제 네트워크 호출은 하지 않는다. 환경변수 로딩 → 클라이언트 생성까지의
// 배선이 끊기지 않았는지만 확인한다.
describe("createSupabaseBrowserClient", () => {
  it("환경변수로 Supabase 클라이언트를 생성한다", () => {
    const client = createSupabaseBrowserClient();

    expect(client.auth).toBeDefined();
    expect(typeof client.from).toBe("function");
  });
});
