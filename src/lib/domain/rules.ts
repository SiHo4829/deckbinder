import type { ExtraZoneRule, GameCode, GameRuleNumbers, GameRules, MulliganRule } from "@/types/game";

/**
 * 구조 룰 — **수치는 여기 두지 않는다** (plan §4.7 ⓑ).
 *
 * 메인 덱 매수 · 첫 손패 · 동일 카드 매수 제한은 DB `games` 행에서만 온다.
 * 여기 있는 것은 DB에 컬럼이 없는 것들뿐이다: 존 구성 · 리더 색상 일치 · 멀리건 방식.
 * 컬럼을 지금 만들지 않는 근거는 §9.4의 코스트·파워와 같다 — 게임 2종으로
 * 스키마를 정하면 추측이 된다.
 */
interface StructuralRules {
  readonly extraZones: readonly ExtraZoneRule[];
  readonly leaderColorMatch: boolean;
  readonly mulligan: MulliganRule;
}

const STRUCTURAL: Readonly<Record<GameCode, StructuralRules>> = {
  ptcg: {
    extraZones: [],
    leaderColorMatch: false,
    mulligan: {
      kind: "redraw_while_missing_role",
      role: "basic_pokemon",
      // 실제 룰에 재시도 상한이 없다. 유한한 수를 적으면 그것이 근거 없는 룰이 된다.
      maxRedraws: Number.POSITIVE_INFINITY,
    },
  },
  opcg: {
    extraZones: [
      { zone: "leader", size: 1, countsTowardCopyLimit: false },
      { zone: "don", size: 10, countsTowardCopyLimit: false },
    ],
    leaderColorMatch: true,
    mulligan: { kind: "redraw_once" },
  },
};

/**
 * DB에서 온 수치와 구조 룰을 합쳐 도메인이 쓰는 룰 하나로 만든다.
 *
 * **넘어온 수치를 손대지 않는다.** 이 함수가 기본값을 채우기 시작하면 DB의
 * `deck_size`는 아무도 읽지 않는 컬럼이 된다 (plan §4.7 ⓑ).
 */
export function composeGameRules(numbers: GameRuleNumbers, code: GameCode): GameRules {
  return {
    code,
    deckSize: numbers.deckSize,
    handSize: numbers.handSize,
    copyLimit: numbers.copyLimit,
    ...STRUCTURAL[code],
  };
}
