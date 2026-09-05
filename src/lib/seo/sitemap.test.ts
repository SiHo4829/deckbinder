import { describe, expect, it } from "vitest";

import { buildSitemapEntries } from "@/lib/seo/sitemap";

const base = "https://deckbinder.test";
const sources = {
  base,
  posts: [{ slug: "op17-release", updated_at: "2026-08-01T00:00:00.000Z" }],
  cards: [{ id: "11111111-1111-4111-8111-111111111111", updated_at: "2026-08-02T00:00:00.000Z" }],
};

describe("buildSitemapEntries", () => {
  it("모든 URL이 절대 경로다", () => {
    for (const entry of buildSitemapEntries(sources)) {
      expect(entry.url.startsWith(`${base}/`) || entry.url === `${base}/`).toBe(true);
    }
  });

  it("뉴스와 카드 상세를 포함한다", () => {
    const urls = buildSitemapEntries(sources).map((e) => e.url);

    expect(urls).toContain(`${base}/news/op17-release`);
    expect(urls).toContain(`${base}/cards/11111111-1111-4111-8111-111111111111`);
  });

  it("정책 페이지를 포함한다 (검색 색인에서 접근 가능해야 한다)", () => {
    const urls = buildSitemapEntries(sources).map((e) => e.url);

    expect(urls).toContain(`${base}/privacy`);
    expect(urls).toContain(`${base}/disclaimer`);
  });

  it("관리자와 개인화 경로는 넣지 않는다", () => {
    const urls = buildSitemapEntries(sources).map((e) => e.url);

    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
    expect(urls.some((u) => u.includes("/binder"))).toBe(false);
    expect(urls.some((u) => u.includes("/api"))).toBe(false);
  });

  it("URL이 중복되지 않는다", () => {
    const urls = buildSitemapEntries(sources).map((e) => e.url);

    expect(new Set(urls).size).toBe(urls.length);
  });

  it("base 끝의 슬래시를 중복시키지 않는다", () => {
    const urls = buildSitemapEntries({ ...sources, base: `${base}/` }).map((e) => e.url);

    expect(urls).toContain(`${base}/news/op17-release`);
    expect(urls.some((u) => u.includes("//news"))).toBe(false);
  });
});
