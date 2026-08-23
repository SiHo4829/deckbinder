import "server-only";

import { createSupabaseAnonClient } from "@/lib/supabase/public";
import type { NewsListItem, NewsPost } from "@/types/news";

/**
 * 공개 뉴스 조회.
 *
 * 쿠키를 읽지 않는 익명 클라이언트를 쓴다. `server.ts`(cookies 사용)를 쓰면
 * 세그먼트가 강제로 동적 렌더링되어 ISR이 무효가 된다.
 *
 * 초안·예약 발행 차단은 RLS가 하므로 여기서 조건을 빠뜨려도 새어나가지 않는다
 * (마이그레이션 006).
 */

const LIST_COLUMNS = "id,slug,title,summary,thumbnail_url,published_at";

export async function fetchPublishedPosts(limit = 20): Promise<NewsListItem[]> {
  const supabase = createSupabaseAnonClient();

  const { data } = await supabase
    .from("news_posts")
    .select(LIST_COLUMNS)
    .order("published_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as NewsListItem[];
}

export async function fetchPostBySlug(slug: string): Promise<NewsPost | null> {
  const supabase = createSupabaseAnonClient();

  const { data } = await supabase
    .from("news_posts")
    .select(`${LIST_COLUMNS},content_md,author_name,updated_at`)
    .eq("slug", slug)
    .maybeSingle();

  return (data as NewsPost | null) ?? null;
}

/** generateStaticParams · sitemap 용. */
export async function fetchPublishedSlugs(): Promise<
  { slug: string; published_at: string; updated_at: string }[]
> {
  const supabase = createSupabaseAnonClient();

  const { data } = await supabase
    .from("news_posts")
    .select("slug,published_at,updated_at")
    .order("published_at", { ascending: false });

  return (data ?? []) as { slug: string; published_at: string; updated_at: string }[];
}
