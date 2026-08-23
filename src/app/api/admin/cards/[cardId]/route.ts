import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/guard";
import { databaseError, invalidInput } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cardInputSchema } from "@/lib/validation/admin";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/cards/[cardId]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = cardInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error);

  const { cardId } = await ctx.params;
  // keyword_ids는 cards의 컬럼이 아니라 card_keywords로 관리한다.
  // 재태깅은 아직 구현하지 않았으므로, 조용히 무시하지 않고 명시적으로 거부한다.
  const { keyword_ids: keywordIds, ...card } = parsed.data;
  if (keywordIds.length > 0) {
    return NextResponse.json(
      { error: "키워드 재태깅은 아직 지원하지 않습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("cards")
    .update(card)
    .eq("id", cardId)
    .select("id,code")
    .maybeSingle();

  if (error) {
    return databaseError(error, "카드를 수정하지 못했습니다.", "PATCH /api/admin/cards");
  }
  if (!data) {
    return NextResponse.json({ error: "카드를 찾을 수 없습니다." }, { status: 404 });
  }
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
  return NextResponse.json({ ok: true });
}
