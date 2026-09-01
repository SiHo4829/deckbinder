import { NextResponse } from "next/server";

import { withProxiedImage } from "@/lib/cards/image-src";
import { clientEnv } from "@/lib/env";
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
    items: await withSourceImages(supabase, items),
    nextCursor: hasMore && last ? { code: last.code, id: last.id } : null,
  });
}

/**
 * 목록 행에 프록시 URL을 채운다 — **2차 조회로.**
 *
 * ## 왜 조회를 한 번 더 하는가
 *
 * 🚨 **`search_cards` RPC의 반환에 `source_image_url`이 없다**(마이그레이션 007 ·
 * `database.ts`의 `Returns` 실측). 그래서 이 경로만 조회 계층(`lib/cards/queries.ts`)의
 * 파생층을 지나지 않는다 — **화면 넷 중 여기 하나만 다른 길로 온다.**
 *
 * ⚠️ **대안은 마이그레이션 012로 그 함수의 반환을 고치는 것이었고, 고르지 않았다**
 * (2026-09-01 사용자 결정 · plan §8 사용자 확인 5). 근거는 **되돌리기 비용의 종류**다:
 * 함수를 고치면 되돌리기가 `git revert` 하나에서 **DB 마이그레이션**으로 바뀌고
 * `db:reset → db:migrate → db:types` 한 사이클이 딸려 오며, **이 태스크가 내세우는
 * 「마이그레이션 0건」 성질이 사라진다.**
 *
 * 🚨 **대가를 적어 둔다: 목록 한 페이지당 쿼리가 1회 는다.** 페이지 크기가 작고
 * 기본 키 `in()` 조회라 싸지만 **0은 아니다.** ⚠️ **T2.15 ⓑ가 같은 자리에서 집계
 * 비용을 재기로 돼 있으므로 그때 함께 측정한다**(백로그 B-4).
 */
async function withSourceImages(
  supabase: ReturnType<typeof createSupabaseAnonClient>,
  items: CardListItem[],
): Promise<CardListItem[]> {
  if (items.length === 0) return items;

  const { data, error } = await supabase
    .from("cards")
    .select("id,source_image_url")
    .in(
      "id",
      items.map((item) => item.id),
    );

  // 🚨 2차 조회가 실패해도 목록은 내려보낸다. 이미지가 폴백이 될 뿐이고,
  //    그것 때문에 검색 결과 전체를 500으로 만들지 않는다.
  if (error) {
    console.error("[GET /api/cards] source_image_url 2차 조회 실패", error.message);
    return items;
  }

  const sourceById = new Map((data ?? []).map((row) => [row.id, row.source_image_url]));

  return items.map((item) =>
    withProxiedImage(
      { ...item, source_image_url: sourceById.get(item.id) ?? null },
      clientEnv.NEXT_PUBLIC_IMAGE_PROXY_BASE,
    ),
  );
}
