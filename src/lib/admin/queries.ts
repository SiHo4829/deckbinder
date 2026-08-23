import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AdminCardRow,
  GameOption,
  KeywordOption,
  SetOption,
} from "@/types/admin";
import type { AdminNewsRow } from "@/types/news";

/**
 * 관리자 화면이 쓰는 조회.
 *
 * PostgREST는 서버 설정(db-max-rows, 기본 1000)에서 응답을 잘라낸다.
 * 세트가 1000개를 넘길 일은 당분간 없지만, 넘기면 조용히 truncate 되므로
 * 그때는 Range 헤더 페이지네이션이 필요하다.
 */

export async function fetchGames(): Promise<GameOption[]> {
  const { data } = await createSupabaseAdminClient()
    .from("games")
    .select("id,code,name_ko")
    .order("code");
  return data ?? [];
}

export async function fetchSets(): Promise<SetOption[]> {
  const { data } = await createSupabaseAdminClient()
    .from("card_sets")
    .select("id,code,name_ja,game_id")
    .order("code");
  return data ?? [];
}

export async function fetchKeywords(): Promise<KeywordOption[]> {
  const { data } = await createSupabaseAdminClient()
    .from("keywords")
    .select("id,code,label_ko,game_id")
    .order("label_ko");
  return data ?? [];
}

/** 초안 포함. 공개 조회는 RLS가 막으므로 admin 클라이언트를 쓴다. */
export async function fetchNewsPosts(limit = 50): Promise<AdminNewsRow[]> {
  const { data } = await createSupabaseAdminClient()
    .from("news_posts")
    .select("id,slug,title,published_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchNewsPost(postId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("news_posts")
    .select("id,slug,title,summary,content_md,thumbnail_url,author_name,published_at")
    .eq("id", postId)
    .maybeSingle();
  return data;
}

export async function fetchCounts(): Promise<{ sets: number; cards: number }> {
  const db = createSupabaseAdminClient();
  const [sets, cards] = await Promise.all([
    db.from("card_sets").select("id", { count: "exact", head: true }),
    db.from("cards").select("id", { count: "exact", head: true }),
  ]);
  return { sets: sets.count ?? 0, cards: cards.count ?? 0 };
}

export async function fetchRecentCards(limit = 20): Promise<AdminCardRow[]> {
  const { data } = await createSupabaseAdminClient()
    .from("cards")
    .select("id,code,name_ja,name_ko,rarity,card_type")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
