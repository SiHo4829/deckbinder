import { NextResponse } from "next/server";

import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { keywordInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const input = await requireAdminInput(request, keywordInputSchema);
  if (!input.ok) return input.response;

  const { data, error } = await createSupabaseAdminClient()
    .from("keywords")
    .insert(input.data)
    .select("id,code,label_ko")
    .single();

  if (error) {
    return databaseError(error, "키워드를 저장하지 못했습니다.", "POST /api/admin/keywords");
  }
  return NextResponse.json({ keyword: data }, { status: 201 });
}
