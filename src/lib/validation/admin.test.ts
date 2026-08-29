import { describe, expect, it } from "vitest";

import {
  cardInputSchema,
  keywordInputSchema,
  setInputSchema,
} from "@/lib/validation/admin";

const validCard = {
  game_id: "3f6c1d2e-0000-4000-8000-000000000001",
  code: "OP01-001",
  name_ja: "モンキー・Ｄ・ルフィ",
};

describe("setInputSchema", () => {
  it("코드와 일본어명만 있으면 통과한다", () => {
    const result = setInputSchema.parse({
      game_id: validCard.game_id,
      code: "OP01",
      name_ja: "ROMANCE DAWN",
    });

    expect(result.name_ko).toBeNull();
    expect(result.released_at).toBeNull();
  });

  it("코드는 공백만으로는 안 된다", () => {
    expect(() =>
      setInputSchema.parse({ game_id: validCard.game_id, code: "  ", name_ja: "x" }),
    ).toThrowError();
  });

  it("빈 문자열 선택 항목은 null로 정규화한다", () => {
    const result = setInputSchema.parse({
      game_id: validCard.game_id,
      code: "OP01",
      name_ja: "x",
      name_ko: "",
      released_at: "",
    });

    expect(result.name_ko).toBeNull();
    expect(result.released_at).toBeNull();
  });

  it("발매일은 YYYY-MM-DD 형식만 받는다", () => {
    expect(
      setInputSchema.parse({ ...validCard, code: "OP01", released_at: "2022-07-22" })
        .released_at,
    ).toBe("2022-07-22");
    expect(() =>
      setInputSchema.parse({ ...validCard, code: "OP01", released_at: "2022/07/22" }),
    ).toThrowError();
  });

  it("한국어 세트명만 있어도 통과한다 (009 — 유일 원천이 한국어 라벨만 준다, plan §4.11 ⓔ)", () => {
    const result = setInputSchema.parse({
      game_id: validCard.game_id,
      code: "OPK-01",
      name_ko: "[OPK-01]",
    });

    expect(result.name_ja).toBeNull();
    expect(result.name_ko).toBe("[OPK-01]");
  });

  it("name_ko와 name_ja가 둘 다 없으면 거부한다 (009 — card_sets_name_present_ck와 같은 규칙)", () => {
    expect(() =>
      setInputSchema.parse({
        game_id: validCard.game_id,
        code: "OPK-01",
        name_ja: "",
        name_ko: "",
      }),
    ).toThrowError(/name_ko|name_ja/);
  });
});

describe("cardInputSchema", () => {
  it("필수값만으로 통과하고 나머지는 null이 된다", () => {
    const result = cardInputSchema.parse(validCard);

    expect(result.code).toBe("OP01-001");
    expect(result.name_ja).toBe("モンキー・Ｄ・ルフィ");
    expect(result.name_ko).toBeNull();
    expect(result.set_id).toBeNull();
    expect(result.rarity).toBeNull();
  });

  it("name_ja와 name_ko가 둘 다 없으면 거부한다 (T1.17 — name_ko와 상호 대체 가능, plan §4.8 ⓕ)", () => {
    expect(() =>
      cardInputSchema.parse({ ...validCard, name_ja: "", name_ko: "" }),
    ).toThrowError(/name_ko|name_ja/);
  });

  it("name_ja가 없어도 name_ko만 있으면 통과한다 (원천이 일본어명을 주지 않는 카드가 실측됐다, plan §4.8 ⓙ-1)", () => {
    const result = cardInputSchema.parse({
      game_id: validCard.game_id,
      code: validCard.code,
      name_ja: "",
      name_ko: "몽키 D 루피",
    });

    expect(result.name_ja).toBeNull();
    expect(result.name_ko).toBe("몽키 D 루피");
  });

  it("name_ko는 선택이다 (name_ja만 있어도 통과한다)", () => {
    expect(cardInputSchema.parse({ ...validCard, name_ko: "몽키 D 루피" }).name_ko).toBe(
      "몽키 D 루피",
    );
    expect(cardInputSchema.parse(validCard).name_ko).toBeNull();
  });

  it("코드 앞뒤 공백을 제거한다", () => {
    expect(cardInputSchema.parse({ ...validCard, code: "  OP01-002 " }).code).toBe(
      "OP01-002",
    );
  });

  it("game_id는 UUID여야 한다", () => {
    expect(() => cardInputSchema.parse({ ...validCard, game_id: "ptcg" })).toThrowError();
  });

  it("이미지 URL은 형식을 검사한다", () => {
    expect(() =>
      cardInputSchema.parse({ ...validCard, image_url: "not-a-url" }),
    ).toThrowError();
    expect(
      cardInputSchema.parse({ ...validCard, image_url: "https://x.test/a.png" }).image_url,
    ).toBe("https://x.test/a.png");
  });

  it("기본 에너지 표시는 sub_type으로 넣는다 (덱 매수 제한 면제 근거)", () => {
    expect(cardInputSchema.parse({ ...validCard, sub_type: "basic_energy" }).sub_type).toBe(
      "basic_energy",
    );
  });
});

describe("keywordInputSchema", () => {
  const base = { game_id: "3f6c1d2e-0000-4000-8000-000000000001" };

  it("코드 · 한국어 표기가 있으면 통과한다", () => {
    const result = keywordInputSchema.parse({
      ...base,
      code: "draw",
      label_ko: "드로우",
    });

    expect(result.code).toBe("draw");
    expect(result.label_ja).toBeNull();
  });

  it("코드에 대문자나 공백은 쓸 수 없다 (URL·검색 함수에 쓰이는 식별자)", () => {
    for (const code of ["Draw", "energy accel", "드로우", "draw-2"]) {
      expect(() =>
        keywordInputSchema.parse({ ...base, code, label_ko: "x" }),
      ).toThrowError();
    }
  });

  it("밑줄과 숫자는 허용한다", () => {
    expect(
      keywordInputSchema.parse({ ...base, code: "energy_accel2", label_ko: "에너지 가속" })
        .code,
    ).toBe("energy_accel2");
  });

  it("한국어 표기는 필수다", () => {
    expect(() =>
      keywordInputSchema.parse({ ...base, code: "draw", label_ko: "" }),
    ).toThrowError();
  });
});

describe("cardInputSchema — 키워드", () => {
  const validCard = {
    game_id: "3f6c1d2e-0000-4000-8000-000000000001",
    code: "OP01-001",
    name_ja: "ルフィ",
  };

  it("키워드를 주지 않으면 빈 배열이다", () => {
    expect(cardInputSchema.parse(validCard).keyword_ids).toEqual([]);
  });

  it("키워드 id 배열을 받는다", () => {
    const ids = [
      "3f6c1d2e-0000-4000-8000-00000000000a",
      "3f6c1d2e-0000-4000-8000-00000000000b",
    ];
    expect(cardInputSchema.parse({ ...validCard, keyword_ids: ids }).keyword_ids).toEqual(ids);
  });

  it("UUID가 아닌 키워드 id는 거부한다", () => {
    expect(() =>
      cardInputSchema.parse({ ...validCard, keyword_ids: ["draw"] }),
    ).toThrowError();
  });
});
