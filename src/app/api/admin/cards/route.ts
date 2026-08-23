import { NextResponse } from "next/server";

import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cardInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const input = await requireAdminInput(request, cardInputSchema);
  if (!input.ok) return input.response;

  const { keyword_ids: keywordIds, ...card } = input.data;
  const db = createSupabaseAdminClient();

  const { data, error } = await db
    .from("cards")
    .insert(card)
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
