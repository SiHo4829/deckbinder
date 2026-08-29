import { describe, expect, it } from "vitest";

import { distributeLifeCost, normalizeCard, type CardRowDraft } from "@/lib/catalog/normalize";
import type { NormalizedCard, NumericField } from "@/lib/validation/catalog";

/** "-"·""는 null, 그 밖의 숫자 문자열은 파싱값 — 픽스처 헬퍼. */
function num(value: number | null, raw = String(value ?? "-")): NumericField {
  return { value, invalid: false, raw };
}

function invalidNum(raw: string): NumericField {
  return { value: null, invalid: true, raw };
}

const base: NormalizedCard = {
  sourceSetLabel: "[TST-01] 테스트 세트 하나",
  code: "OP01-001",
  codeInvalid: false,
  codeMultipleUnderscoresWarning: false,
  nameKo: "테스트 카드",
  cardType: "캐릭터",
  colors: ["적색"],
  life: num(5000, "5000"),
  power: num(5000, "5000"),
  counter: num(1000, "1000"),
  attribute: "타격",
  traits: ["초신성"],
  rarity: "R",
  effectText: "효과 텍스트",
  triggerText: "",
  illustrationType: "오리지널",
  blockNumber: num(2, "2"),
  imageUrl: "https://onepiece-cardgame.kr/fileDownload?downname=abc",
  page: 1,
};

function card(overrides: Partial<NormalizedCard>): NormalizedCard {
  return { ...base, ...overrides };
}

describe("normalizeCard", () => {
  it("1. 정상 캐릭터 → 17필드가 매핑표대로 CardRowDraft에 앉는다(컬럼명 기준)", () => {
    const result = normalizeCard(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row: CardRowDraft = result.row;
    expect(row).toEqual({
      code: "OP01-001",
      name_ko: "테스트 카드",
      name_ja: null,
      card_type: "캐릭터",
      colors: ["적색"],
      life: null,
      cost: 5000, // lifeRaw는 캐릭터라 cost로 간다(ⓓ-2). power와 다른 값이다.
      power: 5000,
      counter: 1000,
      attribute: "타격",
      traits: ["초신성"],
      rarity: "R",
      effect_text: "효과 텍스트",
      trigger_text: null, // 빈 문자열 → null
      illustration_type: "오리지널",
      block_number: 2,
      source_image_url: "https://onepiece-cardgame.kr/fileDownload?downname=abc",
    });
  });

  it("2. 리더 → life에 값 · cost는 null", () => {
    const result = normalizeCard(card({ cardType: "리더", life: num(5, "5") }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.life).toBe(5);
    expect(result.row.cost).toBeNull();
  });

  it.each(["캐릭터", "이벤트", "스테이지"] as const)(
    "3. %s → cost에 값 · life는 null",
    (cardType) => {
      const result = normalizeCard(card({ cardType, life: num(3, "3") }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.row.cost).toBe(3);
      expect(result.row.life).toBeNull();
    },
  );

  it("4. 🚨 알 수 없는 cardType → ok:false · reason:card_type_unknown · 원문 보존", () => {
    const result = normalizeCard(card({ cardType: "몬스터" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([{ field: "cardType", reason: "card_type_unknown", raw: "몬스터" }]);
  });

  it("5. 🚨 cardType이 빈 문자열 → ok:false · reason:card_type_empty (실측 4건의 형태)", () => {
    const result = normalizeCard(card({ cardType: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual({ field: "cardType", reason: "card_type_empty", raw: "" });
  });

  it("6. code가 비었거나 공백 포함 → ok:false", () => {
    const empty = normalizeCard(card({ code: "", codeInvalid: true }));
    expect(empty.ok).toBe(false);

    const spaced = normalizeCard(card({ code: "OP01 001", codeInvalid: true }));
    expect(spaced.ok).toBe(false);
  });

  it("7. name_ko도 name_ja도 없으면 ok:false · reason:no_name (008 check와 같은 규칙)", () => {
    const result = normalizeCard(card({ nameKo: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual({ field: "nameKo", reason: "no_name", raw: "" });
  });

  it("8. name_ja가 항상 null이고, 넣으려 해도 타입이 막는다(타입 레벨 단언)", () => {
    const result = normalizeCard(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.name_ja).toBeNull();
    // @ts-expect-error — name_ja의 타입이 `null` 리터럴이라 값을 대입할 수 없다.
    const attempt: CardRowDraft = { ...result.row, name_ja: "카드명" };
    expect(attempt).toBeDefined();
  });

  it("9. colors — 1개 · 3개 · '다색' 포함 · 빈 값", () => {
    const one = normalizeCard(card({ colors: ["적색"] }));
    expect(one.ok && one.row.colors).toEqual(["적색"]);
    const three = normalizeCard(card({ colors: ["적색", "녹색", "청색"] }));
    expect(three.ok && three.row.colors).toEqual(["적색", "녹색", "청색"]);
    // 🚨 「다색」이 색 목록 안에 값으로 들어온다(ⓓ-4) — 번역하지 않고 원문 그대로.
    const multi = normalizeCard(card({ colors: ["적색", "녹색", "다색"] }));
    expect(multi.ok && multi.row.colors).toEqual(["적색", "녹색", "다색"]);
    const empty = normalizeCard(card({ colors: [] }));
    expect(empty.ok && empty.row.colors).toBeNull();
  });

  it("10. traits — 1·2·3개 · 빈 값", () => {
    const one = normalizeCard(card({ traits: ["초신성"] }));
    expect(one.ok && one.row.traits).toEqual(["초신성"]);
    const two = normalizeCard(card({ traits: ["초신성", "하트 해적단"] }));
    expect(two.ok && two.row.traits).toEqual(["초신성", "하트 해적단"]);
    const three = normalizeCard(card({ traits: ["초신성", "하트 해적단", "동물계"] }));
    expect(three.ok && three.row.traits).toEqual(["초신성", "하트 해적단", "동물계"]);
    const empty = normalizeCard(card({ traits: [] }));
    expect(empty.ok && empty.row.traits).toBeNull();
  });

  it("11. attribute — ''·'-' → null / '?' → '?' 보존 / '참격/특수' → 원문 보존", () => {
    const dash = normalizeCard(card({ attribute: "-" }));
    expect(dash.ok && dash.row.attribute).toBeNull();
    const question = normalizeCard(card({ attribute: "?" }));
    expect(question.ok && question.row.attribute).toBe("?");
    const compound = normalizeCard(card({ attribute: "참격/특수" }));
    expect(compound.ok && compound.row.attribute).toBe("참격/특수");
  });

  it("12. power '-' → null (0이 아니다)", () => {
    const result = normalizeCard(card({ power: num(null, "-") }));
    expect(result.ok).toBe(true);
    expect(result.ok && result.row.power).toBeNull();
    expect(result.ok && result.row.power).not.toBe(0);
  });

  it("13. 🚨 전각 '０' → 0 (NFKC — validation/catalog.ts가 이미 정규화한 값을 그대로 옮긴다)", () => {
    const result = normalizeCard(card({ power: num(0, "０") }));
    expect(result.ok).toBe(true);
    expect(result.ok && result.row.power).toBe(0);
  });

  it("14. '2.0' → 2 · '2.5' → invalid", () => {
    const dotZero = normalizeCard(card({ power: num(2, "2.0") }));
    expect(dotZero.ok).toBe(true);
    expect(dotZero.ok && dotZero.row.power).toBe(2);

    const dotFive = normalizeCard(card({ power: invalidNum("2.5") }));
    expect(dotFive.ok).toBe(false);
    expect(!dotFive.ok && dotFive.issues).toContainEqual({
      field: "power",
      reason: "non_numeric",
      raw: "2.5",
    });
  });

  it("15. '+1000' → 1000 · '-1000' → invalid", () => {
    const plus = normalizeCard(card({ counter: num(1000, "+1000") }));
    expect(plus.ok).toBe(true);
    expect(plus.ok && plus.row.counter).toBe(1000);

    const minus = normalizeCard(card({ counter: invalidNum("-1000") }));
    expect(minus.ok).toBe(false);
    expect(!minus.ok && minus.issues).toContainEqual({
      field: "counter",
      reason: "non_numeric",
      raw: "-1000",
    });
  });

  it("16. source_image_url이 절대 URL이고 image_url 키가 결과 객체에 존재하지 않는다", () => {
    const result = normalizeCard(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(() => new URL(result.row.source_image_url)).not.toThrow();
    expect(Object.keys(result.row)).not.toContain("image_url");
  });
});

describe("distributeLifeCost", () => {
  it("리더 → life", () => {
    const result = distributeLifeCost("리더", num(5, "5"));
    expect(result).toEqual({ life: 5, cost: null });
  });

  it("캐릭터·이벤트·스테이지 → cost", () => {
    expect(distributeLifeCost("캐릭터", num(3, "3"))).toEqual({ life: null, cost: 3 });
    expect(distributeLifeCost("이벤트", num(3, "3"))).toEqual({ life: null, cost: 3 });
    expect(distributeLifeCost("스테이지", num(1, "1"))).toEqual({ life: null, cost: 1 });
  });

  it("그 밖의 값 → NormalizeIssue(card_type_unknown)", () => {
    const result = distributeLifeCost("몬스터", num(1, "1"));
    expect(result).toEqual({ field: "cardType", reason: "card_type_unknown", raw: "몬스터" });
  });
});
