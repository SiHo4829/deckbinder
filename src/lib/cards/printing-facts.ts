import type { PrintingFacts } from "@/lib/domain/achievement/rarity-score";

/**
 * DB 컬럼 → 도메인 필드 번역의 순수 부분 (plan §4.13 ⓒ · T2.15 ⓐ).
 *
 * 🚨 이 파일은 `server-only`도 Supabase도 import하지 않는다 — DB 왕복은
 * `src/lib/cards/queries.ts`의 몫이고, 여기는 "행 + 집계값 → PrintingFacts"만
 * 한다. 그래야 번역 로직을 Supabase 없이 단위 테스트할 수 있다
 * (§4.13 ⓓ "대가는 T2.15 ⓐ의 번역 테스트가 진다").
 */

/** `cards` 테이블에서 번역에 필요한 원시 컬럼. */
export interface PrintingFactsRow {
  /** `cards.rarity`. 원문 그대로 — trim()도 대소문자 접기도 하지 않는다. */
  readonly rarity: string | null;
  /** `cards.illustration_type`. */
  readonly illustration_type: string | null;
  /** `cards.code`. */
  readonly code: string;
  /** `cards.base_code`. */
  readonly base_code: string;
}

/**
 * 같은 그룹(같은 `game_id` + 같은 `base_code`)의 인쇄본 수 — 자기 자신 포함.
 *
 * `fetchCardAlternatives(card).length + 1`을 그대로 넘긴다. 같은 조회를
 * 두 번 하지 않는다 (§4.13 T2.15 ⓑ).
 */
export interface PrintingGroupAggregate {
  readonly printingsInGroup: number;
}

/**
 * 세트 안 집계. `set_id`를 알 때만 존재한다.
 * `set_id`가 `null`이면 이 값 자체를 만들지 않고 `null`을 넘긴다 —
 * 지어내지 않고 도메인의 `set_unknown` 경로로 보낸다.
 */
export interface SetPeerAggregate {
  /** 같은 `set_id`에서 같은 `rarity`인 행 수. 자기 자신 포함. */
  readonly peerCount: number;
  /** 그 `set_id`의 총 행 수. */
  readonly setSize: number;
}

/**
 * 행 + 집계값 → `PrintingFacts`.
 *
 * `setPeers`가 `null`이면(= `set_id`를 모르거나 세트 집계를 구하지 않았다)
 * `peerCount`/`setSize`에 0을 채운다 — 지어낸 값이 아니라 도메인의
 * `scarcityPoints`가 `setSize < 1`에서 곧장 `null`(→ `set_unknown`)로
 * 떨어지게 만드는 신호값이다.
 */
export function toPrintingFacts(
  row: PrintingFactsRow,
  group: PrintingGroupAggregate,
  setPeers: SetPeerAggregate | null,
): PrintingFacts {
  return {
    rarityLabel: row.rarity,
    illustration: row.illustration_type,
    isAlternatePrinting: row.code !== row.base_code,
    printingsInGroup: group.printingsInGroup,
    peerCount: setPeers ? setPeers.peerCount : 0,
    setSize: setPeers ? setPeers.setSize : 0,
  };
}
