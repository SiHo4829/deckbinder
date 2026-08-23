import { describe, expect, it } from "vitest";

import { cardSearchParamsSchema, parseCardSearchParams } from "@/lib/validation/card";

describe("cardSearchParamsSchema", () => {
  it("빈 입력에 기본값을 채운다", () => {
    const result = cardSearchParamsSchema.parse({});

    expect(result.limit).toBe(40);
    expect(result.keywords).toEqual([]);
    expect(result.q).toBeUndefined();
    expect(result.cursor).toBeUndefined();
  });

  it("limit 상한을 강제한다 (대량 스크래핑 방지)", () => {
    expect(cardSearchParamsSchema.parse({ limit: "500" }).limit).toBe(100);
    expect(cardSearchParamsSchema.parse({ limit: "0" }).limit).toBe(1);
  });

  it("게임 코드는 지원 목록만 허용한다", () => {
    expect(cardSearchParamsSchema.parse({ game: "ptcg" }).game).toBe("ptcg");
    expect(() => cardSearchParamsSchema.parse({ game: "ygo" })).toThrowError();
  });

  it("공백만 있는 검색어는 없는 것으로 본다", () => {
    expect(cardSearchParamsSchema.parse({ q: "   " }).q).toBeUndefined();
  });

  it("검색어 앞뒤 공백을 제거한다", () => {
    expect(cardSearchParamsSchema.parse({ q: "  ストライク " }).q).toBe("ストライク");
  });
});

describe("parseCardSearchParams", () => {
  it("URLSearchParams의 반복 키를 배열로 모은다", () => {
    const params = new URLSearchParams();
    params.append("keywords", "draw");
    params.append("keywords", "search");
    params.set("game", "ptcg");

    const result = parseCardSearchParams(params);

    expect(result.keywords).toEqual(["draw", "search"]);
    expect(result.game).toBe("ptcg");
  });

  it("쉼표로 구분된 keywords도 배열로 받는다", () => {
    const params = new URLSearchParams({ keywords: "draw,search" });

    expect(parseCardSearchParams(params).keywords).toEqual(["draw", "search"]);
  });

  it("빈 문자열 필터는 무시한다", () => {
    const params = new URLSearchParams({ rarity: "", attribute: "" });
    const result = parseCardSearchParams(params);

    expect(result.rarity).toBeUndefined();
    expect(result.attribute).toBeUndefined();
  });
});
