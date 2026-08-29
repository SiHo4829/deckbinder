/** 관리자 화면이 다루는 참조 데이터. UI 컴포넌트가 아니라 여기서 정의한다. */

export interface GameOption {
  id: string;
  code: string;
  name_ko: string;
}

export interface SetOption {
  id: string;
  code: string;
  name_ja: string | null;
  name_ko: string | null;
  game_id: string;
}

export interface AdminSetDetail {
  id: string;
  code: string;
  game_id: string;
  name_ja: string | null;
  name_ko: string | null;
  released_at: string | null;
}

export interface AdminKeywordDetail {
  id: string;
  code: string;
  game_id: string;
  label_ko: string;
  label_ja: string | null;
}

export interface KeywordOption {
  id: string;
  code: string;
  label_ko: string;
  game_id: string;
}

export interface AdminCardRow {
  id: string;
  code: string;
  // T1.17(plan §4.8 ⓕ ★★)이 cards.name_ja를 nullable로 되돌렸다 —
  // cards_name_present_ck가 name_ko와 상호 대체를 보장한다.
  name_ja: string | null;
  name_ko: string | null;
  rarity: string | null;
  card_type: string | null;
}

/**
 * 세트의 표기 이름. cardDisplayName(src/types/card.ts)과 같은 판정을 세트에 적용한다.
 *
 * 🚨 009가 card_sets.name_ja를 nullable로 되돌리면서(card_sets_name_present_ck —
 * 둘 중 하나만 있으면 된다) "일본어 세트명은 항상 있다"가 타입으로 보장되지
 * 않는다. 유일 원천이 주는 것은 한국어 라벨 쪽이다(plan §4.11 ⓔ · 사용자 일감 4d).
 * 둘 다 null인 행은 체크 제약이 막지만 그 보장은 런타임의 것이므로, 카드와 달리
 * 빈 문자열이 아니라 **코드**로 떨어진다 — 세트는 코드가 not null이고, 코드가
 * 곧 사람이 읽는 식별자이기 때문이다.
 */
export function setDisplayName(
  set: Pick<SetOption, "code" | "name_ko" | "name_ja">,
): string {
  return set.name_ko ?? set.name_ja ?? set.code;
}
