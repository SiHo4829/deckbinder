import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CardDetail, CardListItem } from "@/types/card";

const DETAIL_COLUMNS =
  "id,code,base_code,name_ko,name_ja,name_en,rarity,attribute,card_type,sub_type,image_url,effect_text,set_id,game_id";

/** 상세 페이지용 카드 1건. 없으면 null. */
export async function fetchCardDetail(cardId: string): Promise<CardDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("cards")
    .select(
      `${DETAIL_COLUMNS},
       card_sets(code,name_ko,name_ja),
       games(code,name_ko),
       card_keywords(keywords(code,label_ko))`,
    )
    .eq("id", cardId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    set: data.card_sets
      ? {
          code: data.card_sets.code,
          label: data.card_sets.name_ko ?? data.card_sets.name_ja,
        }
      : null,
    game: data.games ? { code: data.games.code, label: data.games.name_ko } : null,
    keywords: (data.card_keywords ?? [])
      .map((row) => row.keywords)
      .filter((k): k is { code: string; label_ko: string } => k !== null)
      .map((k) => ({ code: k.code, label: k.label_ko })),
  } as CardDetail;
}

/**
 * 대체 카드 — 같은 게임에서 base_code가 같은 다른 인쇄본.
 * 게임상 동일한 카드이므로 가장 싼 것을 사면 된다 (plan §4.6).
 */
export async function fetchCardAlternatives(
  card: Pick<CardDetail, "id" | "game_id" | "base_code">,
): Promise<CardListItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("cards")
    .select("id,code,name_ko,name_ja,rarity,attribute,card_type,sub_type,image_url,set_id")
    .eq("game_id", card.game_id)
    .eq("base_code", card.base_code)
    .neq("id", card.id)
    .order("code");

  return data ?? [];
}
