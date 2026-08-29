import { NextResponse } from "next/server";

import type { Database } from "@/types/database";

import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cardInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const input = await requireAdminInput(request, cardInputSchema);
  if (!input.ok) return input.response;

  const { keyword_ids: keywordIds, ...card } = input.data;
  const db = createSupabaseAdminClient();

  // 🚨 T1.17(plan §4.8 ⓕ ★★): cardInputSchema는 name_ja를 name_ko와 상호
  // 대체 가능으로 완화했지만(nullable), 마이그레이션 008은 아직 로컬에만
  // 적용돼 있다 — src/types/database.ts는 db:types 재생성 전이라 여전히
  // name_ja: string(not null)이다. db:types 재생성과 원격 db:migrate는
  // 사용자 일감이다(CLAUDE.md B). 그 전까지 name_ja가 null인 요청이 오면 이
  // 캐스트를 통과해 DB로 가고, 원격은 23502(not null 위반)로 거부한다 —
  // databaseError()가 그 실패를 구조화된 에러로 넘기므로 조용히 삼켜지지 않는다.
  const { data, error } = await db
    .from("cards")
    .insert(card as Database["public"]["Tables"]["cards"]["Insert"])
    .select("id,code,name_ja,name_ko")
    .single();

  if (error) {
    return databaseError(error, "카드를 저장하지 못했습니다.", "POST /api/admin/cards");
  }

  if (keywordIds.length > 0) {
    const { error: linkError } = await db
      .from("card_keywords")
      .insert(keywordIds.map((keyword_id) => ({ card_id: data.id, keyword_id })));

    if (linkError) {
      // 카드는 이미 저장됐다. 되돌려서 "절반만 저장된 상태"를 남기지 않는다.
      await db.from("cards").delete().eq("id", data.id);
      return databaseError(
        linkError,
        "키워드를 연결하지 못했습니다.",
        "POST /api/admin/cards (keywords)",
      );
    }
  }

  return NextResponse.json({ card: data }, { status: 201 });
}
