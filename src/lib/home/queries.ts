import "server-only";

import { createSupabaseAnonClient } from "@/lib/supabase/public";
import type { CardListItem } from "@/types/card";

const SHOWCASE_COLUMNS =
  "id,code,name_ko,name_ja,rarity,attribute,card_type,sub_type,image_url,set_id";

/** 홈에 진열할 카드. 일러스트가 주인공이므로 이미지 있는 것을 우선한다. */
export async function fetchShowcaseCards(limit = 10): Promise<CardListItem[]> {
  const supabase = createSupabaseAnonClient();

  const { data } = await supabase
    .from("cards")
    .select(SHOWCASE_COLUMNS)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (data && data.length > 0) return data;

  // 이미지 있는 카드가 아직 없으면 최근 등록분을 그대로 보여준다.
  const { data: fallback } = await supabase
    .from("cards")
    .select(SHOWCASE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  return fallback ?? [];
}

export async function fetchCatalogStats(): Promise<{ cards: number; sets: number }> {
  const supabase = createSupabaseAnonClient();

  const [cards, sets] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }),
    supabase.from("card_sets").select("id", { count: "exact", head: true }),
  ]);

  return { cards: cards.count ?? 0, sets: sets.count ?? 0 };
}
