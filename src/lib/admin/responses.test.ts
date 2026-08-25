import type { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { databaseError, invalidInput, UNAUTHORIZED } from "@/lib/admin/responses";

async function readJson(res: NextResponse): Promise<{ error?: string }> {
  return (await res.json()) as { error?: string };
}

describe("invalidInput", () => {
  it("첫 zod 이슈의 메시지를 400으로 돌려준다", async () => {
    const schema = z.object({ name: z.string().min(1, "이름은 필수입니다.") });
    const result = schema.safeParse({ name: "" });
    if (result.success) throw new Error("테스트 전제가 깨졌습니다.");

    const res = invalidInput(result.error);

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: "이름은 필수입니다." });
  });
});

describe("databaseError — Postgres 오류코드 매핑", () => {
  it("23505(unique_violation)는 409 · 중복 안내 문구", async () => {
    const res = databaseError({ code: "23505" }, "fallback", "ctx");

    expect(res.status).toBe(409);
    expect(await readJson(res)).toEqual({ error: "이미 등록된 코드입니다." });
  });

  it("23503(foreign_key_violation)는 409 · 세트 불일치 문구", async () => {
    const res = databaseError({ code: "23503" }, "fallback", "ctx");

    expect(res.status).toBe(409);
    expect(await readJson(res)).toEqual({
      error: "선택한 세트가 이 게임에 속하지 않습니다.",
    });
  });

  it("23502(not_null_violation)는 400 · 필수 항목 문구", async () => {
    const res = databaseError({ code: "23502" }, "fallback", "ctx");

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: "필수 항목이 비어 있습니다." });
  });

  it("알 수 없는 코드는 500이고 DB 원문이 응답 본문에 새지 않는다", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = databaseError(
      { code: "99999", message: "internal secret detail" },
      "일반 오류 문구",
      "ctx",
    );

    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body).toEqual({ error: "일반 오류 문구" });
    expect(JSON.stringify(body)).not.toContain("internal secret detail");

    consoleSpy.mockRestore();
  });

  it("code가 없는 오류도 500 · fallback 문구만 준다", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = databaseError({ message: "boom" }, "일반 오류 문구", "ctx");

    expect(res.status).toBe(500);
    expect(await readJson(res)).toEqual({ error: "일반 오류 문구" });

    consoleSpy.mockRestore();
  });
});

describe("UNAUTHORIZED", () => {
  it("고정된 문구를 갖는다", () => {
    expect(UNAUTHORIZED).toEqual({ error: "인증이 필요합니다." });
  });
});
