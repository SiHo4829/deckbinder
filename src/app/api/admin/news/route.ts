import { NextResponse } from "next/server";

import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { resolvePublishedAt } from "@/lib/news/publish";
import { revalidateNews } from "@/lib/news/revalidate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { newsPostInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const input = await requireAdminInput(request, newsPostInputSchema);
  if (!input.ok) return input.response;

  const { published, ...post } = input.data;

  const { data, error } = await createSupabaseAdminClient()
    .from("news_posts")
    .insert({ ...post, published_at: resolvePublishedAt(published, null) })
    .select("id,slug,title")
    .single();

  if (error) {
    return databaseError(error, "뉴스를 저장하지 못했습니다.", "POST /api/admin/news");
  }

  revalidateNews(data.slug);

  return NextResponse.json({ post: data }, { status: 201 });
}
