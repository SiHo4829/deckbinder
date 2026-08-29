import { NextResponse } from "next/server";

import type { Database } from "@/types/database";

import { requireAdmin } from "@/lib/admin/guard";
import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { revalidateCards } from "@/lib/cards/revalidate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cardInputSchema } from "@/lib/validation/admin";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/cards/[cardId]">,
) {
  const input = await requireAdminInput(request, cardInputSchema);
  if (!input.ok) return input.response;

  const { cardId } = await ctx.params;
  // keyword_ids는 cards의 컬럼이 아니라 card_keywords로 관리한다. PATCH는 태그를
  // 전량 교체한다 — 넘기지 않으면 스키마 기본값(빈 배열)이 적용되어 기존 태그가
  // 모두 지워진다. CardForm은 등록·수정 모두에서 이 필드를 항상 함께 보낸다.
  const { keyword_ids: keywordIds, ...card } = input.data;
  const db = createSupabaseAdminClient();

  // 🚨 T1.17(plan §4.8 ⓕ ★★) — POST 핸들러의 캐스트와 같은 이유·같은 임시
  // 상태다. name_ja를 nullable로 완화한 것은 cardInputSchema뿐이고,
  // src/types/database.ts는 db:types 재생성 전까지 name_ja를 여전히
  // not null로 본다.
  const { data, error } = await db
    .from("cards")
    .update(card as Database["public"]["Tables"]["cards"]["Update"])
    .eq("id", cardId)
    .select("id,code")
    .maybeSingle();

  if (error) {
    return databaseError(error, "카드를 수정하지 못했습니다.", "PATCH /api/admin/cards");
  }
  if (!data) {
    return NextResponse.json({ error: "카드를 찾을 수 없습니다." }, { status: 404 });
  }

  // 키워드 재태깅 — 앱 레벨 보상 트랜잭션 (§5.1). DB 트랜잭션(RPC)을 쓰지 않으므로
  // 이전 목록을 먼저 읽어 두고 delete → insert 하며, insert가 실패하면 읽어 둔
  // 목록을 되돌려 넣는다. POST가 연결 실패 시 카드 자체를 되돌리는 것과 같은
  // 패턴이고, 되돌릴 대상이 "이전 태그 목록"이라는 점만 다르다.
  const { data: previousLinks, error: previousError } = await db
    .from("card_keywords")
    .select("keyword_id")
    .eq("card_id", cardId);

  if (previousError) {
    return databaseError(
      previousError,
      "기존 키워드를 확인하지 못했습니다.",
      "PATCH /api/admin/cards (keywords read)",
    );
  }

  const { error: deleteError } = await db
    .from("card_keywords")
    .delete()
    .eq("card_id", cardId);

  if (deleteError) {
    return databaseError(
      deleteError,
      "키워드를 갱신하지 못했습니다.",
      "PATCH /api/admin/cards (keywords delete)",
    );
  }

  if (keywordIds.length > 0) {
    const { error: insertError } = await db
      .from("card_keywords")
      .insert(keywordIds.map((keyword_id) => ({ card_id: cardId, keyword_id })));

    if (insertError) {
      const previousKeywordIds = (previousLinks ?? []).map((row) => row.keyword_id);
      // 새 태그를 넣지 못했다. 지워 둔 이전 목록을 되돌려 "절반만 바뀐 상태"를 남기지 않는다.
      if (previousKeywordIds.length > 0) {
        await db
          .from("card_keywords")
          .insert(previousKeywordIds.map((keyword_id) => ({ card_id: cardId, keyword_id })));
      }
      return databaseError(
        insertError,
        "키워드를 연결하지 못했습니다.",
        "PATCH /api/admin/cards (keywords insert)",
      );
    }
  }

  // `/cards/[cardId]`는 ISR(revalidate=3600)이라 캐시가 자연 만료될 때까지
  // 낡은 내용이 남는다. news의 revalidateNews와 같은 패턴으로 즉시 비운다.
  revalidateCards();

  return NextResponse.json({ card: data });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/cards/[cardId]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { cardId } = await ctx.params;
  const { error } = await createSupabaseAdminClient()
    .from("cards")
    .delete()
    .eq("id", cardId);

  if (error) {
    return databaseError(error, "카드를 삭제하지 못했습니다.", "DELETE /api/admin/cards");
  }

  // 삭제 후에도 ISR 캐시가 남아 있으면 지운 카드가 계속 200으로 보인다.
  revalidateCards();

  return NextResponse.json({ ok: true });
}
