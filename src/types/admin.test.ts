import { describe, expect, it } from "vitest";

import { setDisplayName } from "@/types/admin";

/**
 * 009(card_sets.name_ja nullable 복귀 · 사용자 일감 4d) 이후 세트 표기 이름 판정.
 * cards의 cardDisplayName(src/types/card.test.ts)과 같은 자리에 있는 함수지만
 * **떨어지는 값이 다르다** — 세트는 code가 not null이라 빈 문자열로 떨어질 이유가
 * 없다. 그 차이가 이 파일이 따로 있는 이유다.
 */
describe("setDisplayName", () => {
  const base = { code: "OPK-01" };

  it("한국어 세트명이 있으면 그것을 쓴다 (유일 원천이 주는 것이 이쪽이다)", () => {
    expect(setDisplayName({ ...base, name_ko: "[OPK-01]", name_ja: "ROMANCE DAWN" })).toBe(
      "[OPK-01]",
    );
  });

  it("한국어명이 없으면 일본어명으로 떨어진다", () => {
    expect(setDisplayName({ ...base, name_ko: null, name_ja: "ROMANCE DAWN" })).toBe(
      "ROMANCE DAWN",
    );
  });

  it("둘 다 없으면 세트 코드로 떨어진다 — 빈 문자열이 아니다", () => {
    expect(setDisplayName({ ...base, name_ko: null, name_ja: null })).toBe("OPK-01");
  });
});
