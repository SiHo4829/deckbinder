import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCardSearchParams } from "@/lib/validation/card";
import type { CardListItem } from "@/types/card";

/**
 * 도감 검색.
 *
 * 필터 조합을 SQL 함수(search_cards)에 맡긴다. 키워드 "조합" 검색은
 * 선택한 키워드를 모두 가진 카드를 찾는 AND 교집합인데, PostgREST 쿼리
 * 빌더로는 표현할 수 없다(임베드 필터는 OR가 된다). 마이그레이션 004 참조.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  let params;
  try {
    params = parseCardSearchParams(url.searchParams);
  } catch {
    return NextResponse.json(
      { error: "검색 조건이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  // 다음 페이지 존재 여부를 알기 위해 1건 더 받는다.
  const { data, error } = await supabase.rpc("search_cards", {
    p_q: params.q ?? null,
    p_game_code: params.game ?? null,
    p_set_id: params.set ?? null,
    p_rarity: params.rarity ?? null,
    p_attribute: params.attribute ?? null,
    p_card_type: params.cardType ?? null,
    p_keyword_codes: params.keywords.length > 0 ? params.keywords : null,
    p_cursor: params.cursor ?? null,
    p_limit: params.limit + 1,
  });

  if (error) {
    console.error("[GET /api/cards]", error.message);
    return NextResponse.json(
      { error: "카드를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as CardListItem[];
  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? (items.at(-1)?.code ?? null) : null,
  });
}
