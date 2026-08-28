import { shuffle, type Rng } from "@/lib/domain/simulator/shuffle";
import type { DeckSlot, DeckZone, GameRules } from "@/types/game";

export interface HandState {
  readonly hand: readonly string[];
  readonly library: readonly string[];
  readonly mulliganCount: number;
}

export type MulliganResult =
  | { readonly kind: "redrawn"; readonly state: HandState }
  | { readonly kind: "not_allowed"; readonly reason: "limit_reached" | "condition_not_met" }
  | { readonly kind: "undecidable"; readonly reason: "role_unknown" };

/** 매수로 쓸 수 있는 값인가. 아니면 0장으로 친다 — 판정은 `validateDeck`의 일이다. */
function usableCount(count: number): number {
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/**
 * 슬롯을 낱장으로 펼친다. **던지지 않는다** — 음수·비정수 매수는 0장이 된다.
 * 잘못된 매수를 여기서도 검사하면 `validateDeck`과 두 곳에서 같은 것을 보게 된다
 * (plan §4.7 ⓔ-3).
 */
export function buildLibrary(slots: readonly DeckSlot[], zone: DeckZone): string[] {
  const cards: string[] = [];

  for (const slot of slots) {
    if (slot.zone !== zone) continue;
    for (let i = 0; i < usableCount(slot.count); i += 1) cards.push(slot.cardKey);
  }

  return cards;
}

/** 섞은 라이브러리에서 `handSize`만큼 뽑는다. 덱이 더 작으면 있는 만큼만 뽑는다. */
function deal(library: readonly string[], handSize: number, mulliganCount: number): HandState {
  const size = Math.max(0, Math.min(handSize, library.length));
  return {
    hand: library.slice(0, size),
    library: library.slice(size),
    mulliganCount,
  };
}

export function drawOpeningHand(
  slots: readonly DeckSlot[],
  rules: GameRules,
  rng: Rng,
): HandState {
  return deal(shuffle(buildLibrary(slots, "main"), rng), rules.handSize, 0);
}

/** `cardKey` → 역할. 어느 슬롯도 `roles`를 갖지 않으면 판정 재료가 없다는 뜻이다. */
function collectRoles(slots: readonly DeckSlot[]): Map<string, readonly string[]> {
  const roles = new Map<string, readonly string[]>();

  for (const slot of slots) {
    if (slot.roles) roles.set(slot.cardKey, slot.roles);
  }

  return roles;
}

/**
 * 멀리건. 결과가 **3갈래**인 것이 이 함수의 요점이다 (plan §4.7 ⓔ-2).
 *
 * ptcg의 「기본 포켓몬 0장」 판정에 필요한 값이 우리 스키마에 없다(§4.7 ⓗ-1).
 * 재료가 없을 때 조용히 `not_allowed`를 내면 **아무것도 판정하지 않은 상태가
 * 판정한 것처럼 보인다** — `undecidable`로 화면까지 끌고 나온다.
 */
export function mulligan(
  state: HandState,
  slots: readonly DeckSlot[],
  rules: GameRules,
  rng: Rng,
): MulliganResult {
  const redraw = (): MulliganResult => ({
    kind: "redrawn",
    state: deal(shuffle(buildLibrary(slots, "main"), rng), rules.handSize, state.mulliganCount + 1),
  });

  if (rules.mulligan.kind === "redraw_once") {
    return state.mulliganCount >= 1 ? { kind: "not_allowed", reason: "limit_reached" } : redraw();
  }

  const { role, maxRedraws } = rules.mulligan;
  const roles = collectRoles(slots);

  if (roles.size === 0) return { kind: "undecidable", reason: "role_unknown" };
  if (state.hand.some((cardKey) => roles.get(cardKey)?.includes(role))) {
    return { kind: "not_allowed", reason: "condition_not_met" };
  }
  if (state.mulliganCount >= maxRedraws) {
    return { kind: "not_allowed", reason: "limit_reached" };
  }

  return redraw();
}
