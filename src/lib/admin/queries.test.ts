import { describe, expect, it } from "vitest";

import { sanitizeSearchTerm } from "@/lib/admin/queries";

/**
 * PostgREST `.or()`는 조건을 문자열로 이어 붙여 파싱한다(plan §2.7).
 * `,`는 조건 구분자, `(`/`)`는 그룹 문법이라 사용자 입력에 그대로 들어가면
 * 필터 문법이 깨지거나(400) 조용히 다른 뜻으로 파싱된다. 관리자 카드 검색이
 * 첫 사용처이므로 여기서 고정한다.
 */
describe("sanitizeSearchTerm", () => {
  it("쉼표를 제거한다 — .or() 조건 구분자와 충돌한다", () => {
    expect(sanitizeSearchTerm("a,b")).toBe("ab");
  });

  it("괄호를 제거한다 — .or() 그룹 문법과 충돌한다", () => {
    expect(sanitizeSearchTerm("a(b)c")).toBe("abc");
  });

  it("쉼표와 괄호가 섞여도 나머지 텍스트는 보존한다", () => {
    expect(sanitizeSearchTerm("OP01-001,(SR)")).toBe("OP01-001SR");
  });

  it("일반 텍스트는 그대로 둔다", () => {
    expect(sanitizeSearchTerm("OP01-001")).toBe("OP01-001");
  });

  it("앞뒤 공백을 다듬는다", () => {
    expect(sanitizeSearchTerm("  ルフィ  ")).toBe("ルフィ");
  });

  it("빈 문자열은 빈 문자열로 남는다", () => {
    expect(sanitizeSearchTerm("")).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
  });
});
