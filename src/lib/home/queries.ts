import "server-only";

import { withProxiedImage } from "@/lib/cards/image-src";
import { clientEnv } from "@/lib/env";
import { createSupabaseAnonClient } from "@/lib/supabase/public";
import type { CardListItem } from "@/types/card";

const SHOWCASE_COLUMNS =
  "id,code,name_ko,name_ja,rarity,attribute,card_type,sub_type,image_url,source_image_url,set_id";

/**
 * 홈에 진열할 카드. 일러스트가 주인공이므로 이미지 있는 것을 우선한다.
 *
 * ★★★ **T1.31 (2026-09-01): 우선 조건을 `image_url` → `source_image_url`로 바꿨다.**
 *
 * 🚨 **바꾸기 전 이 필터는 0행을 맞히고 있었다.** 이미지 전달이 리버스 프록시로
 * 바뀌면서(§9.4 ⓖ) `image_url`은 **의도적으로 전량 `null`**이고 원천 URL은
 * `source_image_url`에 3,139행이 들어 있다. ⚠️ **그런데 화면은 정상으로 보였다** —
 * 아래 폴백 쿼리가 조용히 받아 주기 때문이다. **「이미지 있는 카드 우선」이라는
 * 기능만 죽어 있고 아무도 모르는 상태였다.**
 *
 * ⚠️ **폴백 쿼리는 남긴다.** 되돌릴 갈래(§9.4 ⓖ-9)나 원천이 URL을 안 주는 카드가
 * 생기면 그때 다시 일한다 — **0건이 정상인 경로를 지우지 않는다.**
 */
export async function fetchShowcaseCards(limit = 10): Promise<CardListItem[]> {
  const supabase = createSupabaseAnonClient();

  const { data } = await supabase
    .from("cards")
    .select(SHOWCASE_COLUMNS)
    .not("source_image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (data && data.length > 0) return data.map(toShowcaseCard);

  // 이미지 있는 카드가 아직 없으면 최근 등록분을 그대로 보여준다.
  const { data: fallback } = await supabase
    .from("cards")
    .select(SHOWCASE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (fallback ?? []).map(toShowcaseCard);
}

function toShowcaseCard(row: { image_url: string | null; source_image_url?: string | null }) {
  return withProxiedImage(row, clientEnv.NEXT_PUBLIC_IMAGE_PROXY_BASE) as CardListItem;
}

export async function fetchCatalogStats(): Promise<{ cards: number; sets: number }> {
  const supabase = createSupabaseAnonClient();

  const [cards, sets] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }),
    supabase.from("card_sets").select("id", { count: "exact", head: true }),
  ]);

  return { cards: cards.count ?? 0, sets: sets.count ?? 0 };
}
