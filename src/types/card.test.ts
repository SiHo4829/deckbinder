import { describe, expect, it } from "vitest";

import { cardDisplayName } from "./card";

/**
 * T1.17(plan §4.8 ⓕ ★★)이 cards.name_ja를 nullable로 되돌렸다 —
 * 한국어명·일본어명 중 최소 하나만 있으면 된다(cards_name_present_ck).
 * cardDisplayName은 여전히 string을 돌려줘야 하므로 둘 다 null인
 * 경우까지 안전하게 다룬다.
 */
describe("cardDisplayName", () => {
  it("name_ko가 있으면 그것을 우선한다", () => {
    expect(cardDisplayName({ name_ko: "몽키 D 루피", name_ja: "モンキー・Ｄ・ルフィ" })).toBe(
      "몽키 D 루피",
    );
  });

  it("name_ko가 null이면 name_ja를 쓴다", () => {
    expect(cardDisplayName({ name_ko: null, name_ja: "モンキー・Ｄ・ルフィ" })).toBe(
      "モンキー・Ｄ・ルフィ",
    );
  });

  it("🚨 둘 다 null이어도 던지지 않고 빈 문자열을 돌려준다 — DB 체크 제약이 막는 경로지만 타입은 이걸 보장할 수 없다(plan §4.8 ⓗ)", () => {
    expect(cardDisplayName({ name_ko: null, name_ja: null })).toBe("");
  });
});
