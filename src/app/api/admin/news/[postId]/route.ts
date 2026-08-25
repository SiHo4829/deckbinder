import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/guard";
import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { resolvePublishedAt } from "@/lib/news/publish";
import { revalidateNews } from "@/lib/news/revalidate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { newsPostInputSchema } from "@/lib/validation/admin";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/news/[postId]">,
) {
  const input = await requireAdminInput(request, newsPostInputSchema);
  if (!input.ok) return input.response;

  const { postId } = await ctx.params;
  const db = createSupabaseAdminClient();

  // 이미 발행된 글의 발행 시각을 보존하려면 기존 값이 필요하다.
  const { data: existing } = await db
    .from("news_posts")
    .select("slug,published_at")
    .eq("id", postId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
  }

  const { published, ...post } = input.data;

  const { data, error } = await db
    .from("news_posts")
    .update({ ...post, published_at: resolvePublishedAt(published, existing.published_at) })
    .eq("id", postId)
    .select("id,slug,title")
    .single();

  if (error) {
    return databaseError(error, "뉴스를 수정하지 못했습니다.", "PATCH /api/admin/news");
  }

  revalidateNews();

  return NextResponse.json({ post: data });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/news/[postId]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { postId } = await ctx.params;
  const db = createSupabaseAdminClient();

  const { data: existing } = await db
    .from("news_posts")
    .select("slug")
    .eq("id", postId)
    .maybeSingle();

  const { error } = await db.from("news_posts").delete().eq("id", postId);
  if (error) {
    return databaseError(error, "뉴스를 삭제하지 못했습니다.", "DELETE /api/admin/news");
  }

  if (existing) revalidateNews();
  else revalidatePath("/news");

  return NextResponse.json({ ok: true });
}
