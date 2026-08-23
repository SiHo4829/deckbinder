import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/guard";
import { databaseError, invalidInput } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { keywordInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = keywordInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error);

  const { data, error } = await createSupabaseAdminClient()
    .from("keywords")
    .insert(parsed.data)
    .select("id,code,label_ko")
    .single();

  if (error) {
    return databaseError(error, "키워드를 저장하지 못했습니다.", "POST /api/admin/keywords");
  }
  return NextResponse.json({ keyword: data }, { status: 201 });
}
