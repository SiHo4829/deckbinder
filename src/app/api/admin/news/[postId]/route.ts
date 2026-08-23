import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { databaseError, invalidInput } from "@/lib/admin/responses";
import { resolvePublishedAt } from "@/lib/news/publish";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { newsPostInputSchema } from "@/lib/validation/admin";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/news/[postId]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = newsPostInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error);

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

  const { published, ...post } = parsed.data;

  const { data, error } = await db
    .from("news_posts")
    .update({ ...post, published_at: resolvePublishedAt(published, existing.published_at) })
    .eq("id", postId)
    .select("id,slug,title")
    .single();

  if (error) {
    return databaseError(error, "뉴스를 수정하지 못했습니다.", "PATCH /api/admin/news");
  }

  revalidatePath("/news");
  revalidatePath(`/news/${data.slug}`);
  // 슬러그를 바꿨다면 예전 경로도 함께 비운다.
  if (existing.slug !== data.slug) revalidatePath(`/news/${existing.slug}`);
  revalidatePath("/sitemap.xml");

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

  revalidatePath("/news");
  if (existing) revalidatePath(`/news/${existing.slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ ok: true });
}
