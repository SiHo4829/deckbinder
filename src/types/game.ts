/**
 * 게임 룰과 덱 슬롯의 타입 (plan §4.7 ⓒ).
 *
 * **이 파일은 카드 DB 타입을 import 하지 않는다.** `src/lib/domain/**`이
 * 카드에 대해 아는 전부가 `DeckSlot`이고, 그 필드는 전부 원시값이다.
 * 카탈로그를 호스팅하지 않는 갈래(plan §9.11 ⓓ-2)에서도 그대로 살아남게 하는
 * 것이 목적이다.
 */

export type GameCode = "ptcg" | "opcg";

/** T2.3의 `deck_cards.zone` enum과 값이 일치해야 한다 (plan §4.1) */
export type DeckZone = "main" | "leader" | "don";

/**
 * DB `games` 행에서 오는 수치. **이 세 값을 코드에 다시 쓰지 않는다** (plan §4.7 ⓑ).
 * 같은 숫자를 도메인에 심는 순간 출처가 둘이 되어 조용히 어긋난다.
 */
export interface GameRuleNumbers {
  readonly deckSize: number;
  readonly handSize: number;
  readonly copyLimit: number;
}

export interface ExtraZoneRule {
  readonly zone: Exclude<DeckZone, "main">;
  readonly size: number;
  /** 리더 · DON!!은 동일 카드 매수 제한 합산에서 빠진다 */
  readonly countsTowardCopyLimit: boolean;
}

export type MulliganRule =
  /**
   * ptcg — 손패에 해당 역할이 0장이면 다시 뽑는다.
   * 실제 룰에 재시도 상한이 없어 `maxRedraws`는 `Infinity`가 들어간다 (rules.ts).
   */
  | { readonly kind: "redraw_while_missing_role"; readonly role: string; readonly maxRedraws: number }
  /** opcg — 조건 없이 1회만 */
  | { readonly kind: "redraw_once" };

export interface GameRules extends GameRuleNumbers {
  readonly code: GameCode;
  readonly extraZones: readonly ExtraZoneRule[];
  readonly leaderColorMatch: boolean;
  readonly mulligan: MulliganRule;
}

/**
 * 덱 한 칸. **도메인이 카드에 대해 아는 전부다.**
 *
 * `cards` 테이블의 컬럼명을 하나도 쓰지 않는다 — 채우는 것은 호출부의 몫이다
 * (`sub_type` → `copyLimitExempt`, `attribute` → `colors`; plan §4.7 ⓓ-3).
 */
export interface DeckSlot {
  /**
   * 동일성 식별자. **UUID일 필요가 없다.**
   * 브랜디드 타입으로 좁히면 "우리 DB의 id"라는 뜻이 붙어 이 타입의 목적이
   * 사라진다 — 넓은 채로 둔다 (plan §4.7 ⓓ).
   */
  readonly cardKey: string;
  readonly count: number;
  readonly zone: DeckZone;
  /** ptcg 기본 에너지 — 매수 제한 예외 (plan §4.0) */
  readonly copyLimitExempt?: boolean;
  /** opcg 리더 색상 일치용. 다색 카드가 있어 배열이다 (plan §4.7 ⓗ-2) */
  readonly colors?: readonly string[];
  /** ptcg 멀리건 판정용(예: `"basic_pokemon"`). 스키마에 원천이 없다 (plan §4.7 ⓗ-1) */
  readonly roles?: readonly string[];
}
