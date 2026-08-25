import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/guard";
import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { fetchSetCardCount } from "@/lib/admin/queries";
import { revalidateCards } from "@/lib/cards/revalidate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setInputSchema } from "@/lib/validation/admin";

/**
 * 23503(foreign_key_violation)의 기본 문구는 **카드 등록** 상황의 말이라
 * ("선택한 세트가 이 게임에 속하지 않습니다") 세트 삭제 실패에 그대로 나오면
 * 원인이 설명되지 않는다. 같은 코드가 호출부마다 다른 뜻을 갖는 경우다
 * (plan T1.15a ⓑ).
 */
const DELETE_OVERRIDES = {
  "23503": "이 세트를 사용하는 카드가 있어 삭제할 수 없습니다. 카드를 먼저 옮기거나 지우세요.",
};

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/sets/[setId]">) {
  const input = await requireAdminInput(request, setInputSchema);
  if (!input.ok) return input.response;

  const { setId } = await ctx.params;

  const { data, error } = await createSupabaseAdminClient()
    .from("card_sets")
    .update(input.data)
    .eq("id", setId)
    .select("id,code")
    .maybeSingle();

  if (error) {
    return databaseError(error, "세트를 수정하지 못했습니다.", "PATCH /api/admin/sets");
  }
  if (!data) {
    return NextResponse.json({ error: "세트를 찾을 수 없습니다." }, { status: 404 });
  }

  // 홈의 fetchCatalogStats가 card_sets를 센다. 카드 상세는 동적이라 무관하지만
  // 홈은 여전히 ISR(10분)이다. **키워드(T1.15b)에는 이걸 붙이지 않는다** — 키워드를
  // ISR로 읽는 곳이 없다. 이 비대칭은 의도된 것이니 습관으로 복사하지 말 것.
  revalidateCards();

  return NextResponse.json({ set: data });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/sets/[setId]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { setId } = await ctx.params;

  // 사전 카운트로 원인을 설명하는 409를 먼저 준다. **경합은 막지 않는다** —
  // 이 확인과 아래 delete 사이에 카드가 새로 붙을 수 있고, 그때는 DB의
  // on delete restrict가 최종 판정을 한다(그래서 아래 override도 함께 둔다).
  // 카운트는 사용자에게 이유를 보여주기 위한 것이지 방벽이 아니다.
  const cardCount = await fetchSetCardCount(setId);
  if (cardCount > 0) {
    return NextResponse.json(
      { error: `이 세트를 쓰는 카드가 ${cardCount}장 있어 삭제할 수 없습니다.` },
      { status: 409 },
    );
  }

  const { error } = await createSupabaseAdminClient()
    .from("card_sets")
    .delete()
    .eq("id", setId);

  if (error) {
    return databaseError(
      error,
      "세트를 삭제하지 못했습니다.",
      "DELETE /api/admin/sets",
      DELETE_OVERRIDES,
    );
  }

  revalidateCards();

  return NextResponse.json({ ok: true });
}
