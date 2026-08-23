/**
 * TCGdex(ptcg 일본어 주 원천) 응답을 우리 스키마로 옮기는 순수 매핑.
 * 네트워크·DB 접근은 scripts/seed.ts가 담당하고 여기에는 두지 않는다 (plan P4).
 */

export interface TcgdexSet {
  id: string;
  name: string;
  releaseDate?: string | null;
}

interface TcgdexAbility {
  name?: string;
  effect?: string;
}

interface TcgdexAttack {
  name?: string;
  effect?: string;
  /** 매핑에는 쓰지 않지만 응답에 존재하는 필드 */
  damage?: number | string | null;
  cost?: string[];
}

export interface TcgdexCard {
  id: string;
  name: string;
  category?: string;
  rarity?: string | null;
  types?: string[];
  stage?: string | null;
  trainerType?: string | null;
  energyType?: string | null;
  effect?: string | null;
  /** 플레이버 텍스트. 검색 노이즈가 되므로 effect_text에 넣지 않는다. */
  description?: string | null;
  abilities?: TcgdexAbility[];
  attacks?: TcgdexAttack[];
  image?: string | null;
}

export interface MappedSet {
  code: string;
  name_ja: string;
  released_at: string | null;
}

export interface MappedCard {
  code: string;
  name_ja: string;
  rarity: string | null;
  attribute: string | null;
  card_type: string | null;
  sub_type: string | null;
  image_url: string | null;
  effect_text: string | null;
}

export function mapTcgdexSet(set: TcgdexSet): MappedSet {
  return {
    code: set.id,
    name_ja: set.name,
    released_at: set.releaseDate ?? null,
  };
}

/**
 * sub_type 규칙
 *  - Energy  : Basic → `basic_energy` (덱 매수 제한 면제 근거, plan §4.0)
 *  - Trainer : trainerType 소문자 (item / supporter / stadium / tool)
 *  - Pokemon : stage 소문자 (basic / stage1 / stage2)
 */
function resolveSubType(card: TcgdexCard): string | null {
  if (card.category === "Energy") {
    // TCGdex 어휘(실측): 기본 에너지는 "Normal", 특수 에너지는 "Special".
    // "Basic"이 아니다. 구세트(PMCG 등)는 값이 아예 없어 이름으로 판별해야 하며,
    // 일본어 기본 에너지는 예외 없이 「基本◯エネルギー」 형식이다.
    if (card.energyType === "Normal" || card.energyType === "Basic") {
      return "basic_energy";
    }
    if (card.energyType === "Special") {
      return "special_energy";
    }
    return card.name?.startsWith("基本") ? "basic_energy" : "special_energy";
  }
  if (card.category === "Trainer") {
    return card.trainerType?.toLowerCase() ?? null;
  }
  return card.stage?.toLowerCase() ?? null;
}

/**
 * effect_text에는 **기계적 텍스트만** 담는다.
 * description은 플레이버 텍스트라 키워드 태깅(T1.6e)과 전문검색에 노이즈가 된다.
 */
function resolveEffectText(card: TcgdexCard): string | null {
  if (card.category !== "Pokemon") {
    return card.effect?.trim() || null;
  }

  const lines = [...(card.abilities ?? []), ...(card.attacks ?? [])]
    .map((entry) => {
      const effect = entry.effect?.trim();
      if (!effect) return null;
      const name = entry.name?.trim();
      return name ? `${name}: ${effect}` : effect;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : null;
}

export function mapTcgdexCard(card: TcgdexCard): MappedCard {
  const name = card.name?.trim();
  if (!name) {
    throw new Error(`TCGdex 카드 ${card.id}에 이름이 없습니다 (name_ja는 NOT NULL)`);
  }

  return {
    code: card.id,
    name_ja: name,
    rarity: card.rarity?.trim() || null,
    attribute: card.category === "Pokemon" ? (card.types?.[0] ?? null) : null,
    card_type: card.category ?? null,
    sub_type: resolveSubType(card),
    // TCGdex 이미지는 확장자 없는 베이스 URL이라 화질·포맷을 붙여야 한다.
    image_url: card.image ? `${card.image}/high.webp` : null,
    effect_text: resolveEffectText(card),
  };
}
