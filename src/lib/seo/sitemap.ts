import type { MetadataRoute } from "next";

/** 인증이 필요하거나 개인화된 경로는 넣지 않는다. */
const STATIC_PATHS = [
  { path: "/", priority: 1 },
  { path: "/cards", priority: 0.8 },
  { path: "/decks", priority: 0.6 },
  { path: "/news", priority: 0.8 },
  { path: "/privacy", priority: 0.3 },
  { path: "/disclaimer", priority: 0.3 },
] as const;

export interface SitemapSources {
  base: string;
  posts: { slug: string; updated_at: string }[];
  cards: { id: string; updated_at: string }[];
}

/**
 * sitemap 엔트리 조립. 순수 함수로 두어 단위 테스트가 가능하다.
 *
 * changeFrequency·priority는 Google이 사실상 무시하므로 카드처럼 수가 많은
 * 항목에는 붙이지 않는다. lastModified만 준다.
 */
export function buildSitemapEntries({
  base,
  posts,
  cards,
}: SitemapSources): MetadataRoute.Sitemap {
  const origin = base.replace(/\/$/, "");

  return [
    ...STATIC_PATHS.map((s) => ({
      url: `${origin}${s.path}`,
      lastModified: new Date(),
      priority: s.priority,
    })),
    ...posts.map((p) => ({
      url: `${origin}/news/${p.slug}`,
      lastModified: new Date(p.updated_at),
    })),
    ...cards.map((c) => ({
      url: `${origin}/cards/${c.id}`,
      lastModified: new Date(c.updated_at),
    })),
  ];
}
