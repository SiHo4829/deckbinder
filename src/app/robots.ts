import type { MetadataRoute } from "next";

import { clientEnv } from "@/lib/env";

/**
 * ⚠️ 어떤 user-agent에도 `Disallow: /`를 붙이지 말 것.
 * 검색 엔진이 페이지를 크롤하지 못하면 색인이 되지 않는다. `*` 규칙이
 * 이미 커버하므로 별도 그룹을 만들지 않는다
 * (별도 그룹을 만들면 `*` 규칙이 그 봇에 대해 대체되어 실수 여지가 생긴다).
 */
export default function robots(): MetadataRoute.Robots {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /binder는 인증이 필요한 개인 페이지라 색인 의미가 없다.
        disallow: ["/admin", "/api/", "/binder"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
