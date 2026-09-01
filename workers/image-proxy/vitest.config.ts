import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // 🚨 `@/*` 전체가 아니라 이 별칭 하나만 공유한다 — tsconfig.json과 같은
      //    범위여야 한다. 넓히면 워커가 `@/lib/catalog`(로컬 스크립트 전용
      //    구획)를 테스트에서만 볼 수 있게 되고, 그러면 테스트와 런타임의
      //    경계가 갈린다.
      "@/lib/validation": fileURLToPath(new URL("../../src/lib/validation", import.meta.url)),
    },
  },
  test: {
    // 🚨 브라우저 환경이 필요 없다. 워커 코드는 Request/Response/crypto.subtle만
    //    쓰고 셋 다 Node 20에 전역으로 있다.
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
