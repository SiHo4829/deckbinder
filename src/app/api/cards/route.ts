import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCardSearchParams } from "@/lib/validation/card";

/** 도감 목록에 필요한 컬럼만 고른다. 상세는 /api/cards/[cardId]가 담당한다. */
const LIST_COLUMNS =
  "id,code,name_ko,name_ja,rarity,attribute,card_type,sub_type,image_url,set_id";

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

  // code는 (game_id, code) 유니크라 게임 내에서 고유하다.
  // 커서 기준으로 안정적인 정렬 키가 된다.
  let query = supabase
    .from("cards")
    .select(LIST_COLUMNS)
    .order("code", { ascending: true })
    .limit(params.limit + 1);

  if (params.game) {
    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("code", params.game)
      .maybeSingle();
    if (!game) {
      return NextResponse.json({ items: [], nextCursor: null });
    }
    query = query.eq("game_id", game.id);
  }

  if (params.set) query = query.eq("set_id", params.set);
  if (params.rarity) query = query.eq("rarity", params.rarity);
  if (params.attribute) query = query.eq("attribute", params.attribute);
  if (params.cardType) query = query.eq("card_type", params.cardType);
  if (params.cursor) query = query.gt("code", params.cursor);

  // 일본어는 공백이 없어 tsvector가 이름 전체를 토큰 하나로 잡는다.
  // 부분일치는 pg_trgm 인덱스를 타는 ilike가 실질적으로 유효하다 (plan §4.4).
  if (params.q) {
    const pattern = `%${params.q.replace(/[%_]/g, "\\$&")}%`;
    query = query.or(`name_ja.ilike.${pattern},name_ko.ilike.${pattern}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/cards]", error.message);
    return NextResponse.json(
      { error: "카드를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? (items.at(-1)?.code ?? null) : null,
  });
}
