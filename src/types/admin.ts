/** 관리자 화면이 다루는 참조 데이터. UI 컴포넌트가 아니라 여기서 정의한다. */

export interface GameOption {
  id: string;
  code: string;
  name_ko: string;
}

export interface SetOption {
  id: string;
  code: string;
  name_ja: string;
  game_id: string;
}

export interface AdminSetDetail {
  id: string;
  code: string;
  game_id: string;
  name_ja: string;
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
