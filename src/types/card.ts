export interface CardListItem {
  id: string;
  code: string;
  name_ko: string | null;
  name_ja: string;
  rarity: string | null;
  attribute: string | null;
  card_type: string | null;
  sub_type: string | null;
  image_url: string | null;
  set_id: string | null;
}

export interface CardListResponse {
  items: CardListItem[];
  nextCursor: string | null;
}

/**
 * 표기 이름. 한국어명 커버리지가 부분적이라 없으면 일본어명을 그대로 쓴다.
 * 임의 번역을 만들지 않는다 (plan §4.4).
 */
export function cardDisplayName(card: Pick<CardListItem, "name_ko" | "name_ja">): string {
  return card.name_ko ?? card.name_ja;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface CardFacets {
  rarity: FacetValue[];
  attribute: FacetValue[];
  cardType: FacetValue[];
  sets: { id: string; code: string; label: string }[];
  /** 효과 키워드. 여러 개를 고르면 **모두** 가진 카드만 남는다 (AND). */
  keywords: { code: string; label: string }[];
}
