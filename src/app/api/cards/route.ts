import { NextResponse } from "next/server";

import { createSupabaseAnonClient } from "@/lib/supabase/public";
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

  // 공개 검색이라 쿠키가 필요 없다. 조회 계층과 같은 익명 클라이언트를 쓴다.
  const supabase = createSupabaseAnonClient();

  // 다음 페이지 존재 여부를 알기 위해 1건 더 받는다.
  const { data, error } = await supabase.rpc("search_cards", {
    // 생성된 DB 타입은 선택 인자를 undefined(생략)로 받는다. null은 타입 오류다.
    p_q: params.q,
    p_game_code: params.game,
    p_set_id: params.set,
    p_rarity: params.rarity,
    p_attribute: params.attribute,
    p_card_type: params.cardType,
    p_keyword_codes: params.keywords.length > 0 ? params.keywords : undefined,
    p_cursor: params.cursor,
    p_cursor_id: params.cursorId,
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

  const last = items.at(-1);

  return NextResponse.json({
    items,
    nextCursor: hasMore && last ? { code: last.code, id: last.id } : null,
  });
}
