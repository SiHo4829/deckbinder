import type { DeckSlot, DeckZone, GameRules } from "@/types/game";

export type DeckViolation =
  | { readonly code: "deck_size"; readonly zone: DeckZone; readonly expected: number; readonly actual: number }
  | { readonly code: "copy_limit"; readonly cardKey: string; readonly limit: number; readonly actual: number }
  | { readonly code: "invalid_count"; readonly cardKey: string; readonly actual: number }
  | { readonly code: "zone_not_allowed"; readonly zone: DeckZone }
  | {
      readonly code: "leader_color_mismatch";
      readonly cardKey: string;
      readonly cardColors: readonly string[];
      readonly leaderColors: readonly string[];
    }
  | { readonly code: "color_unknown"; readonly cardKey: string };

export interface DeckValidation {
  readonly ok: boolean;
  readonly violations: readonly DeckViolation[];
}

/** `buildLibrary`와 같은 기준. 쓸 수 없는 매수는 0장으로 친다. */
function usableCount(count: number): number {
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function checkCounts(slots: readonly DeckSlot[]): DeckViolation[] {
  return slots
    .filter((slot) => usableCount(slot.count) === 0)
    .map((slot) => ({ code: "invalid_count", cardKey: slot.cardKey, actual: slot.count }));
}

function checkZones(slots: readonly DeckSlot[], rules: GameRules): DeckViolation[] {
  const allowed = new Set<DeckZone>(["main", ...rules.extraZones.map((zone) => zone.zone)]);
  const offending = new Set(slots.map((slot) => slot.zone).filter((zone) => !allowed.has(zone)));

  return [...offending].map((zone) => ({ code: "zone_not_allowed", zone }));
}

function totalIn(slots: readonly DeckSlot[], zone: DeckZone): number {
  return slots.reduce((sum, slot) => (slot.zone === zone ? sum + usableCount(slot.count) : sum), 0);
}

function checkSizes(slots: readonly DeckSlot[], rules: GameRules): DeckViolation[] {
  const expectations: readonly { zone: DeckZone; expected: number }[] = [
    { zone: "main", expected: rules.deckSize },
    ...rules.extraZones.map((zone) => ({ zone: zone.zone, expected: zone.size })),
  ];

  return expectations
    .map(({ zone, expected }) => ({ zone, expected, actual: totalIn(slots, zone) }))
    .filter(({ expected, actual }) => expected !== actual)
    .map(({ zone, expected, actual }) => ({ code: "deck_size", zone, expected, actual }));
}

/**
 * 동일 카드 매수 제한. **`cardKey`로 합산한다** — 같은 카드가 두 슬롯에 나뉘어
 * 있어도(2 + 3 = 5) 걸린다. 나눠 넣으면 통과하는 검증은 검증이 아니다.
 */
function checkCopyLimit(slots: readonly DeckSlot[], rules: GameRules): DeckViolation[] {
  const counted = new Map<DeckZone, boolean>([["main", true]]);
  for (const zone of rules.extraZones) counted.set(zone.zone, zone.countsTowardCopyLimit);

  const totals = new Map<string, number>();
  for (const slot of slots) {
    if (slot.copyLimitExempt || !counted.get(slot.zone)) continue;
    totals.set(slot.cardKey, (totals.get(slot.cardKey) ?? 0) + usableCount(slot.count));
  }

  return [...totals]
    .filter(([, actual]) => actual > rules.copyLimit)
    .map(([cardKey, actual]) => ({ code: "copy_limit", cardKey, limit: rules.copyLimit, actual }));
}

/**
 * 리더 색상 일치. 메인 덱 카드의 색은 **리더 색의 부분집합**이어야 한다.
 *
 * ⚠️ 색을 모르는 슬롯을 조용히 넘기지 않는다 — 그러면 "검증했다"는 화면이
 * 아무것도 검증하지 않은 상태를 덮는다 (plan §4.7 ⓕ-3).
 */
function checkLeaderColors(slots: readonly DeckSlot[], rules: GameRules): DeckViolation[] {
  if (!rules.leaderColorMatch) return [];

  const leaders = slots.filter((slot) => slot.zone === "leader");
  const unknownLeaders = leaders.filter((slot) => !slot.colors);
  if (unknownLeaders.length > 0) {
    // 리더 색을 모르면 메인 카드와 견줄 기준이 없다. 여기서 멈춘다.
    return unknownLeaders.map((slot) => ({ code: "color_unknown", cardKey: slot.cardKey }));
  }

  const leaderColors = [...new Set(leaders.flatMap((slot) => slot.colors ?? []))];

  return slots
    .filter((slot) => slot.zone === "main")
    .flatMap<DeckViolation>((slot) => {
      if (!slot.colors) return [{ code: "color_unknown", cardKey: slot.cardKey }];
      if (slot.colors.every((color) => leaderColors.includes(color))) return [];
      return [
        {
          code: "leader_color_mismatch",
          cardKey: slot.cardKey,
          cardColors: slot.colors,
          leaderColors,
        },
      ];
    });
}

/**
 * 덱 검증. **위반을 전부 모아서 돌려준다 — 첫 번째에서 멈추지 않는다.**
 * 덱 빌더는 목록으로 보여 줘야 하고, 하나씩 고치게 하면 60장 덱에서 왕복이
 * 수십 번이 된다 (plan §4.7 ⓕ-1).
 */
export function validateDeck(slots: readonly DeckSlot[], rules: GameRules): DeckValidation {
  const violations = [
    ...checkCounts(slots),
    ...checkZones(slots, rules),
    ...checkSizes(slots, rules),
    ...checkCopyLimit(slots, rules),
    ...checkLeaderColors(slots, rules),
  ];

  return { ok: violations.length === 0, violations };
}
