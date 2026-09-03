export interface CardListItem {
  id: string;
  code: string;
  name_ko: string | null;
  name_ja: string | null;
  rarity: string | null;
  attribute: string | null;
  card_type: string | null;
  sub_type: string | null;
  image_url: string | null;
  set_id: string | null;
}

/**
 * 다음 페이지의 시작점.
 *
 * cards의 유니크 제약은 `(game_id, code)`라 **code만으로는 정렬 키가 유일하지 않다.**
 * 게임 필터 없이 훑을 때 두 게임에 같은 code가 있으면 `code > cursor`가 뒤 카드를
 * 통째로 건너뛴다. id를 함께 실어 (code, id)로 비교한다 (마이그레이션 007).
 */
export interface CardCursor {
  code: string;
  id: string;
}

export interface CardListResponse {
  items: CardListItem[];
  nextCursor: CardCursor | null;
}

/**
 * 표기 이름. 한국어명 커버리지가 부분적이라 없으면 일본어명을 그대로 쓴다.
 * 임의 번역을 만들지 않는다 (plan §4.4).
 *
 * 🚨 T1.17이 name_ja를 nullable로 되돌리면서(cards_name_present_ck — 둘 중
 * 하나만 있으면 된다) 이 함수가 "항상 값이 있다"를 타입으로 보장할 수 없게
 * 됐다. 둘 다 null인 행은 DB 체크 제약이 막지만, 그 보장은 런타임의 것이지
 * 컴파일 타임의 것이 아니다 — 빈 문자열로 안전하게 떨어진다(plan §4.8 ⓗ).
 */
export function cardDisplayName(card: Pick<CardListItem, "name_ko" | "name_ja">): string {
  return card.name_ko ?? card.name_ja ?? "";
}

export interface CardDetail {
  id: string;
  code: string;
  /** 인쇄본 접미사를 뗀 코드. 대체 카드 판정 기준 (plan §4.6) */
  base_code: string;
  game_id: string;
  set_id: string | null;
  name_ko: string | null;
  name_ja: string | null;
  name_en: string | null;
  rarity: string | null;
  attribute: string | null;
  card_type: string | null;
  sub_type: string | null;
  /** 일러스트 구분(실측 "오리지널"·"원작"). 희귀도 점수(T2.15)의 번역 입력. */
  illustration_type: string | null;
  image_url: string | null;
  effect_text: string | null;
  set: { code: string; label: string } | null;
  game: { code: string; label: string } | null;
  keywords: { code: string; label: string }[];
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
