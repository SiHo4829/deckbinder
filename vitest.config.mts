import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // src/lib/admin/**은 `import "server-only"`로 시작한다. 실제 패키지는
      // jsdom 환경에서 import되는 즉시 throw하므로 빈 모듈로 치환한다(plan §2.7).
      "server-only": fileURLToPath(new URL("./vitest.server-only-mock.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // src/lib/env.ts는 모듈 로드 시 클라이언트 환경변수를 검증한다.
    // 테스트에서도 형식이 유효한 더미 값이 있어야 import가 성립한다.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      // src/lib/admin/**은 src/lib/supabase/admin.ts를 거쳐 env.server.ts를 로드한다.
      // service_role 키는 실제로 쓰이지 않지만(단위 테스트는 네트워크를 타지 않는다),
      // 모듈 로드 시점 검증을 통과시키는 더미 값이 필요하다.
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      ADMIN_TOKEN: "test-admin-token-1234567890",
    },
    // 단위 테스트는 소스 옆에 배치한다. E2E(tests/e2e)는 Playwright가 담당한다.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
