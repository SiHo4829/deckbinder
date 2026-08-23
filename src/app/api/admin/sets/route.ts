import { NextResponse } from "next/server";

import { requireAdminInput } from "@/lib/admin/input";
import { databaseError } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const input = await requireAdminInput(request, setInputSchema);
  if (!input.ok) return input.response;

  const { data, error } = await createSupabaseAdminClient()
    .from("card_sets")
    .insert(input.data)
    .select("id,code,name_ja")
    .single();

  if (error) {
    return databaseError(error, "세트를 저장하지 못했습니다.", "POST /api/admin/sets");
  }
  return NextResponse.json({ set: data }, { status: 201 });
}
