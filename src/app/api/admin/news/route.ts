import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { databaseError, invalidInput } from "@/lib/admin/responses";
import { resolvePublishedAt } from "@/lib/news/publish";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { newsPostInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = newsPostInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error);

  const { published, ...post } = parsed.data;

  const { data, error } = await createSupabaseAdminClient()
    .from("news_posts")
    .insert({ ...post, published_at: resolvePublishedAt(published, null) })
    .select("id,slug,title")
    .single();

  if (error) {
    return databaseError(error, "뉴스를 저장하지 못했습니다.", "POST /api/admin/news");
  }

  // ISR 캐시를 즉시 무효화한다. revalidate(300)만 두면 최대 5분 지연된다.
  revalidatePath("/news");
  revalidatePath(`/news/${data.slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ post: data }, { status: 201 });
}
