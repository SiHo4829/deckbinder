import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/guard";
import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { keywordInputSchema } from "@/lib/validation/admin";

/**
 * 세트(`/api/admin/sets/[setId]`)와 달리 **사전 카운트로 막지 않는다.**
 * `card_keywords.keyword_id`가 `on delete cascade`라 삭제는 어차피 성공하고,
 * 막을 제약도 없다. 방어는 오직 화면 쪽 경고뿐이다 — `/admin/keywords/[keywordId]`가
 * `AdminDeleteButton`의 `description`으로 "카드 N장" 을 보여준다(plan T1.15a ⓑ).
 *
 * **`revalidateCards()`도 부르지 않는다.** 세트는 홈의 `fetchCatalogStats`가
 * `card_sets`를 세기 때문에 붙였지만, 키워드를 ISR로 읽는 곳은 없다
 * (카드 상세·도감은 동적이거나 Route Handler다). 이 비대칭은 의도된 것이니
 * 세트 라우트를 복사하면서 이 줄까지 가져오지 말 것.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/keywords/[keywordId]">,
) {
  const input = await requireAdminInput(request, keywordInputSchema);
  if (!input.ok) return input.response;

  const { keywordId } = await ctx.params;

  const { data, error } = await createSupabaseAdminClient()
    .from("keywords")
    .update(input.data)
    .eq("id", keywordId)
    .select("id,code")
    .maybeSingle();

  if (error) {
    return databaseError(error, "키워드를 수정하지 못했습니다.", "PATCH /api/admin/keywords");
  }
  if (!data) {
    return NextResponse.json({ error: "키워드를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ keyword: data });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/keywords/[keywordId]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { keywordId } = await ctx.params;
  const { error } = await createSupabaseAdminClient()
    .from("keywords")
    .delete()
    .eq("id", keywordId);

  if (error) {
    return databaseError(error, "키워드를 삭제하지 못했습니다.", "DELETE /api/admin/keywords");
  }

  return NextResponse.json({ ok: true });
}
