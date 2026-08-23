import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GAME_CODES } from "@/lib/validation/card";
import type { CardFacets } from "@/types/card";

/**
 * 도감 필터 선택지.
 * 레어도·속성·종류는 DISTINCT가 필요해 SQL 함수(card_facets)로 얻고,
 * 세트와 키워드는 일반 테이블 조회로 얻는다.
 */
export async function GET(request: Request) {
  const gameParam = new URL(request.url).searchParams.get("game");
  const game = GAME_CODES.find((c) => c === gameParam);

  const supabase = await createSupabaseServerClient();

  const [facetsRes, setsRes, keywordsRes] = await Promise.all([
    supabase.rpc("card_facets", { p_game_code: game }),
    game
      ? supabase
          .from("card_sets")
          .select("id,code,name_ko,name_ja,games!inner(code)")
          .eq("games.code", game)
          .order("code")
      : supabase.from("card_sets").select("id,code,name_ko,name_ja").order("code"),
    game
      ? supabase
          .from("keywords")
          .select("code,label_ko,games!inner(code)")
          .eq("games.code", game)
          .order("label_ko")
      : supabase.from("keywords").select("code,label_ko").order("label_ko"),
  ]);

  const failed = facetsRes.error ?? setsRes.error ?? keywordsRes.error;
  if (failed) {
    console.error("[GET /api/cards/facets]", failed.message);
    return NextResponse.json(
      { error: "필터 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const rows = (facetsRes.data ?? []) as {
    facet: string;
    value: string;
    card_count: number;
  }[];
  const pick = (facet: string) =>
    rows.filter((r) => r.facet === facet).map((r) => ({ value: r.value, count: r.card_count }));

  const body: CardFacets = {
    rarity: pick("rarity"),
    attribute: pick("attribute"),
    cardType: pick("card_type"),
    sets: (setsRes.data ?? []).map((s) => ({
      id: s.id,
      code: s.code,
      label: s.name_ko ?? s.name_ja,
    })),
    keywords: (keywordsRes.data ?? []).map((k) => ({ code: k.code, label: k.label_ko })),
  };

  return NextResponse.json(body);
}
