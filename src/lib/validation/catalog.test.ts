import { describe, expect, it } from "vitest";

import type { CollectedCard } from "@/lib/catalog/types";

import { CATALOG_ORIGIN, normalizedCardSchema } from "./catalog";

const base: CollectedCard = {
  sourceSetLabel: "[TST-01] 테스트 세트 하나",
  code: "TST-001",
  nameKo: "테스트카드가",
  cardType: "리더",
  colorRaw: "가색",
  lifeRaw: "5",
  powerRaw: "5000",
  counterRaw: "-",
  attribute: "속성가",
  traitsRaw: "특징가/특징나",
  rarity: "L",
  effectText: "효과 텍스트",
  triggerText: "",
  illustrationType: "오리지널",
  blockNumberRaw: "4",
  imagePath: "/fileDownload?downname=abc",
  page: 1,
};

function normalize(overrides: Partial<CollectedCard>) {
  return normalizedCardSchema.parse({ ...base, ...overrides });
}

describe("normalizedCardSchema", () => {
  it("1. power '-' → null · '' → null · '5000' → 5000", () => {
    expect(normalize({ powerRaw: "-" }).power).toEqual({ value: null, invalid: false, raw: "-" });
    expect(normalize({ powerRaw: "" }).power).toEqual({ value: null, invalid: false, raw: "" });
    expect(normalize({ powerRaw: "5000" }).power).toEqual({ value: 5000, invalid: false, raw: "5000" });
  });

  it('2. 🚨 power "5,000"처럼 알 수 없는 문자열 → invalid + 원문 보존', () => {
    const result = normalize({ powerRaw: "5,000" });
    expect(result.power.invalid).toBe(true);
    expect(result.power.value).toBeNull();
    expect(result.power.raw).toBe("5,000");
  });

  it("3. counter '-' → null", () => {
    expect(normalize({ counterRaw: "-" }).counter).toEqual({ value: null, invalid: false, raw: "-" });
  });

  it("4. colors — 단색 1개 · 2색 2개 · 빈 값 [] · 양끝 공백 제거", () => {
    expect(normalize({ colorRaw: "적색" }).colors).toEqual(["적색"]);
    expect(normalize({ colorRaw: "녹색,황색" }).colors).toEqual(["녹색", "황색"]);
    expect(normalize({ colorRaw: "" }).colors).toEqual([]);
    expect(normalize({ colorRaw: " 적색 , 황색 " }).colors).toEqual(["적색", "황색"]);
  });

  it("5. traits — 슬래시 다치 · 단일 · 빈 값 []", () => {
    expect(normalize({ traitsRaw: "초신성/하트 해적단" }).traits).toEqual(["초신성", "하트 해적단"]);
    expect(normalize({ traitsRaw: "단일특징" }).traits).toEqual(["단일특징"]);
    expect(normalize({ traitsRaw: "" }).traits).toEqual([]);
  });

  it("6. code 빈 값 → invalid / 공백 포함 → invalid", () => {
    expect(normalize({ code: "" }).codeInvalid).toBe(true);
    expect(normalize({ code: "OP14 001" }).codeInvalid).toBe(true);
    expect(normalize({ code: "OP14-001" }).codeInvalid).toBe(false);
  });

  it("7. code에 _가 둘 이상 → 경고 플래그(차단하지 않는다)", () => {
    const one = normalize({ code: "OP06-022_P3" });
    expect(one.codeMultipleUnderscoresWarning).toBe(false);
    expect(one.codeInvalid).toBe(false);

    const two = normalize({ code: "OP06_022_P3" });
    expect(two.codeMultipleUnderscoresWarning).toBe(true);
    expect(two.codeInvalid).toBe(false);
  });

  it("8. effectText의 \\r\\n → \\n (중간 파일은 원문, DB는 통일 — ⓚ-4)", () => {
    const result = normalize({ effectText: "첫 줄\r\n둘째 줄", triggerText: "트리거\r\n둘째" });
    expect(result.effectText).toBe("첫 줄\n둘째 줄");
    expect(result.triggerText).toBe("트리거\n둘째");
  });

  it("9. 상대 이미지 경로 → 절대 URL이고 호스트가 화이트리스트 상수와 같다", () => {
    const result = normalize({ imagePath: "/fileDownload?downname=abc" });
    const url = new URL(result.imageUrl);
    expect(url.host).toBe(new URL(CATALOG_ORIGIN).host);
    expect(result.imageUrl.startsWith(CATALOG_ORIGIN)).toBe(true);
  });

  it("attribute 빈 문자열 → null (power의 '-'와 다른 표기지만 둘 다 null로 만든다)", () => {
    expect(normalize({ attribute: "" }).attribute).toBeNull();
    expect(normalize({ attribute: "속성가" }).attribute).toBe("속성가");
  });
});

// 🚨 plan §4.11 ⓕ — 전량 실측에서 나온 수치 표기 3종(전각 · 소수점 `.0` · 부호
// `+`)을 가산한다. 기존 케이스(위)는 하나도 고치지 않는다.
describe("normalizedCardSchema — 수치 표기 4종 (plan §4.11 ⓕ)", () => {
  it("전각 숫자 '０'~'９' → NFKC로 반각 정수", () => {
    expect(normalize({ powerRaw: "３０００" }).power).toEqual({
      value: 3000,
      invalid: false,
      raw: "３０００",
    });
  });

  it("소수점 '2.0' → 2 (정수화) · '2000.0' → 2000", () => {
    expect(normalize({ powerRaw: "2.0" }).power).toEqual({ value: 2, invalid: false, raw: "2.0" });
    expect(normalize({ counterRaw: "2000.0" }).counter).toEqual({
      value: 2000,
      invalid: false,
      raw: "2000.0",
    });
  });

  it("🚨 0이 아닌 소수 '2.5'는 여전히 invalid다", () => {
    const result = normalize({ powerRaw: "2.5" });
    expect(result.power.invalid).toBe(true);
    expect(result.power.value).toBeNull();
    expect(result.power.raw).toBe("2.5");
  });

  it("부호 접두 '+1000' → 1000 (선행 + 1개 제거)", () => {
    expect(normalize({ counterRaw: "+1000" }).counter).toEqual({
      value: 1000,
      invalid: false,
      raw: "+1000",
    });
    expect(normalize({ counterRaw: "+2000" }).counter).toEqual({
      value: 2000,
      invalid: false,
      raw: "+2000",
    });
  });

  it("🚨 음수 표기 '-1000'은 관측되지 않았고, 나오면 invalid다(부호를 해석하지 않는다)", () => {
    const result = normalize({ counterRaw: "-1000" });
    expect(result.counter.invalid).toBe(true);
    expect(result.counter.value).toBeNull();
    expect(result.counter.raw).toBe("-1000");
  });

  it("blockNumberRaw도 같은 규칙을 쓴다 — '-' → null · '1' → 1", () => {
    expect(normalize({ blockNumberRaw: "-" }).blockNumber).toEqual({
      value: null,
      invalid: false,
      raw: "-",
    });
    expect(normalize({ blockNumberRaw: "1" }).blockNumber).toEqual({
      value: 1,
      invalid: false,
      raw: "1",
    });
  });
});
