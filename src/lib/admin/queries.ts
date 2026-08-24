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

const ADMIN_CARDS_PAGE_SIZE = 20;

/**
 * PostgREST `.or()`는 조건을 문자열로 이어 붙여 파싱하는 API다.
 * `,`는 조건 구분자, `(`/`)`는 그룹 문법이라 사용자 입력에 그대로 들어가면
 * 필터 문법이 깨지거나(400) 최악의 경우 조용히 다른 조건으로 파싱된다(plan §2.7).
 * 조립 전에 반드시 이 함수를 거친다.
 */
export function sanitizeSearchTerm(input: string): string {
  return input.replace(/[,()]/g, "").trim();
}

export interface AdminCardsPage {
  cards: AdminCardRow[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * `/admin/cards` 목록 조회.
 *
 * `search_cards` RPC를 쓰지 않는다 — code가 검색 대상에서 빠져 있고,
 * `security invoker`라 anon RLS 기준으로 실행되며, total을 주지 않는다.
 * 관리자 클라이언트로 code · name_ja · name_ko를 직접 훑는다(plan §8 T1.12-1).
 */
export async function fetchAdminCards({
  q,
  page = 1,
}: {
  q?: string;
  page?: number;
} = {}): Promise<AdminCardsPage> {
  const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (currentPage - 1) * ADMIN_CARDS_PAGE_SIZE;
  const to = from + ADMIN_CARDS_PAGE_SIZE - 1;

  let query = createSupabaseAdminClient()
    .from("cards")
    .select("id,code,name_ja,name_ko,rarity,card_type", { count: "exact" })
    .order("code")
    .range(from, to);

  const term = q ? sanitizeSearchTerm(q) : "";
  if (term.length > 0) {
    query = query.or(
      `code.ilike.%${term}%,name_ja.ilike.%${term}%,name_ko.ilike.%${term}%`,
    );
  }

  const { data, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_CARDS_PAGE_SIZE));

  return { cards: data ?? [], total, page: currentPage, totalPages };
}

export interface AdminCardDetail {
  id: string;
  code: string;
  game_id: string;
  set_id: string | null;
  name_ja: string;
  name_ko: string | null;
  name_en: string | null;
  rarity: string | null;
  attribute: string | null;
  card_type: string | null;
  sub_type: string | null;
  image_url: string | null;
  effect_text: string | null;
  /** 태깅된 효과 키워드 id. 없으면 빈 배열. */
  keywordIds: string[];
}

/** `/admin/cards/[cardId]` 수정 화면용 단건 조회. 없으면 null. */
export async function fetchAdminCard(cardId: string): Promise<AdminCardDetail | null> {
  const { data } = await createSupabaseAdminClient()
    .from("cards")
    .select(
      "id,code,game_id,set_id,name_ja,name_ko,name_en,rarity,attribute,card_type,sub_type,image_url,effect_text,card_keywords(keyword_id)",
    )
    .eq("id", cardId)
    .maybeSingle();

  if (!data) return null;

  const { card_keywords: cardKeywords, ...card } = data;
  return { ...card, keywordIds: (cardKeywords ?? []).map((k) => k.keyword_id) };
}
