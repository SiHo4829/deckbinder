import { describe, expect, it } from "vitest";

import { mapTcgdexCard, mapTcgdexSet } from "@/lib/domain/ingest/tcgdex";

describe("mapTcgdexSet", () => {
  it("세트 코드와 일본어명을 매핑한다", () => {
    const result = mapTcgdexSet({
      id: "SV5M",
      name: "サイバージャッジ",
      releaseDate: "2024-01-26",
    });

    expect(result).toEqual({
      code: "SV5M",
      name_ja: "サイバージャッジ",
      released_at: "2024-01-26",
    });
  });

  it("발매일이 없으면 null로 둔다", () => {
    expect(mapTcgdexSet({ id: "M5", name: "アビスアイ" }).released_at).toBeNull();
  });
});

describe("mapTcgdexCard", () => {
  it("포켓몬 카드를 매핑한다", () => {
    const result = mapTcgdexCard({
      id: "SV5M-001",
      name: "ストライク",
      category: "Pokemon",
      rarity: "Common",
      types: ["Grass"],
      stage: "Basic",
      description: "両手の 鋭い カマは 硬いものを 切れば切るほど",
      attacks: [{ name: "きる", damage: 10, cost: ["Colorless"] }],
      image: "https://assets.tcgdex.net/ja/sv/SV5M/1",
    });

    expect(result.code).toBe("SV5M-001");
    expect(result.name_ja).toBe("ストライク");
    expect(result.card_type).toBe("Pokemon");
    expect(result.sub_type).toBe("basic");
    expect(result.attribute).toBe("Grass");
    expect(result.rarity).toBe("Common");
    expect(result.image_url).toBe("https://assets.tcgdex.net/ja/sv/SV5M/1/high.webp");
  });

  it("포켓몬의 effect_text는 기술·특성만 담고 플레이버 텍스트는 제외한다", () => {
    const result = mapTcgdexCard({
      id: "X-1",
      name: "テスト",
      category: "Pokemon",
      description: "플레이버 텍스트",
      abilities: [{ name: "とりひき", effect: "カードを1枚引く。" }],
      attacks: [{ name: "こうげき", effect: "エネルギーを加速する。" }],
    });

    expect(result.effect_text).toContain("とりひき");
    expect(result.effect_text).toContain("カードを1枚引く。");
    expect(result.effect_text).toContain("エネルギーを加速する。");
    expect(result.effect_text).not.toContain("플레이버");
  });

  it("기술·특성이 없는 포켓몬은 effect_text가 null이다", () => {
    const result = mapTcgdexCard({
      id: "X-2",
      name: "테스트",
      category: "Pokemon",
      description: "플레이버만 있는 카드",
    });

    expect(result.effect_text).toBeNull();
  });

  it("트레이너 카드는 trainerType을 sub_type으로 쓴다", () => {
    const result = mapTcgdexCard({
      id: "SV5M-069",
      name: "ベルのまごころ",
      category: "Trainer",
      trainerType: "Supporter",
      effect: "残りHPが「30」以下の自分のポケモン1匹のHPを、すべて回復する。",
    });

    expect(result.card_type).toBe("Trainer");
    expect(result.sub_type).toBe("supporter");
    expect(result.attribute).toBeNull();
    expect(result.effect_text).toContain("回復");
  });

  // TCGdex는 기본 에너지를 "Basic"이 아니라 "Normal"로 표기한다 (실측).
  it("energyType이 Normal이면 basic_energy다 (덱 매수 제한 면제 근거)", () => {
    expect(
      mapTcgdexCard({
        id: "SM1S-073",
        name: "基本鋼エネルギー",
        category: "Energy",
        energyType: "Normal",
      }).sub_type,
    ).toBe("basic_energy");
  });

  it("energyType이 Basic이어도 basic_energy로 받아준다 (방어적)", () => {
    expect(
      mapTcgdexCard({
        id: "SVE-001",
        name: "基本草エネルギー",
        category: "Energy",
        energyType: "Basic",
      }).sub_type,
    ).toBe("basic_energy");
  });

  // TCGdex 일본어 카드는 energyType을 채우지 않는다(실측). 이름으로 판별해야 한다.
  it("energyType이 없어도 「基本◯エネルギー」는 basic_energy로 판별한다", () => {
    expect(
      mapTcgdexCard({ id: "PMCG1-097", name: "基本草エネルギー", category: "Energy" })
        .sub_type,
    ).toBe("basic_energy");
    expect(
      mapTcgdexCard({ id: "S7D-090", name: "基本鋼エネルギー", category: "Energy" })
        .sub_type,
    ).toBe("basic_energy");
  });

  it("energyType이 없고 이름이 基本으로 시작하지 않으면 special_energy다", () => {
    expect(
      mapTcgdexCard({ id: "PMCG1-096", name: "ダブル無色エネルギー", category: "Energy" })
        .sub_type,
    ).toBe("special_energy");
  });

  it("energyType이 명시되면 이름 추정보다 우선한다", () => {
    expect(
      mapTcgdexCard({
        id: "X-9",
        name: "基本っぽい名前のエネルギー",
        category: "Energy",
        energyType: "Special",
      }).sub_type,
    ).toBe("special_energy");
  });

  it("특수 에너지는 basic_energy가 아니다", () => {
    const result = mapTcgdexCard({
      id: "SV5M-070",
      name: "ミストエネルギー",
      category: "Energy",
      energyType: "Special",
      effect: "このカードをつけているポケモンは…",
    });

    expect(result.sub_type).toBe("special_energy");
  });

  it("이미지가 없으면 image_url이 null이다", () => {
    expect(mapTcgdexCard({ id: "X-3", name: "노이미지", category: "Pokemon" }).image_url)
      .toBeNull();
  });

  it("이름이 없는 카드는 거부한다 (name_ja는 NOT NULL)", () => {
    expect(() => mapTcgdexCard({ id: "X-4", name: "", category: "Pokemon" })).toThrowError(
      /X-4/,
    );
  });
});
