import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/guard";
import { databaseError, invalidInput } from "@/lib/admin/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setInputSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = setInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error);

  const { data, error } = await createSupabaseAdminClient()
    .from("card_sets")
    .insert(parsed.data)
    .select("id,code,name_ja")
    .single();

  if (error) {
    return databaseError(error, "세트를 저장하지 못했습니다.", "POST /api/admin/sets");
  }
  return NextResponse.json({ set: data }, { status: 201 });
}
