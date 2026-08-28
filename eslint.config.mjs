import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // supabase CLI 생성물. .gitignore에 있지만 flat config는 그것을 보지 않는다.
    "supabase/.temp/**",
  ]),
  {
    // plan §3.3 규칙 2 · §4.7 ⓓ-2 — 도메인은 카드 DB · 프레임워크에 의존하지 않는다.
    // 지금까지 이 규칙은 Reviewer의 눈으로만 지켜졌다. `npm run lint`로 옮긴다.
    files: ["src/lib/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/types/database",
                "@/types/card",
                "@/lib/supabase",
                "@/lib/supabase/*",
                "@supabase/*",
                "next",
                "next/*",
                "react",
                "react-dom",
                "server-only",
              ],
              message:
                "도메인은 카드 DB와 프레임워크에 의존하지 않는다 (plan §4.7 ⓓ). 카드 표현은 @/types/game 의 DeckSlot 하나이고, 컬럼명 번역은 호출부의 몫이다.",
            },
          ],
        },
      ],
    },
  },
  {
    // plan §4.8 ⓒ — 카탈로그 수집기는 로컬 스크립트 전용이다. parse.ts가
    // jsdom(devDependency)을 쓰는데, src/lib/ 아래에 있으면 「lib에 있으니
    // 써도 되겠지」로 읽힌다. 사람 눈이 아니라 npm run lint로 옮긴다.
    files: ["src/app/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/catalog", "@/lib/catalog/*"],
              message:
                "카탈로그 수집기는 로컬 스크립트 전용이다 (plan §4.8 ⓒ). jsdom이 서버 번들에 들어간다.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
