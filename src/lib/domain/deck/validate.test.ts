import { describe, expect, it } from "vitest";

import { composeGameRules } from "@/lib/domain/rules";
import { validateDeck } from "@/lib/domain/deck/validate";
import type { DeckViolation } from "@/lib/domain/deck/validate";
import type { DeckSlot } from "@/types/game";

const ptcgRules = composeGameRules({ deckSize: 60, handSize: 7, copyLimit: 4 }, "ptcg");
const opcgRules = composeGameRules({ deckSize: 50, handSize: 5, copyLimit: 4 }, "opcg");

const slot = (over: Partial<DeckSlot> & Pick<DeckSlot, "cardKey" | "count">): DeckSlot => ({
  zone: "main",
  ...over,
});

/**
 * 서로 다른 cardKey로 총 `total`장을 채운다 — 매수 제한에 걸리지 않게 4장씩 나눈다.
 * opcg를 검증할 때는 `colors`를 줘야 한다. 주지 않으면 `color_unknown`이 걸리는 것이
 * 정상이다 (plan §4.7 ⓕ-3).
 */
function fillMain(total: number, colors?: string[]): DeckSlot[] {
  const slots: DeckSlot[] = [];
  for (let remaining = total, i = 0; remaining > 0; i += 1) {
    const count = Math.min(4, remaining);
    slots.push(slot({ cardKey: `card-${i}`, count, colors }));
    remaining -= count;
  }
  return slots;
}

const codes = (violations: readonly DeckViolation[]) => violations.map((v) => v.code);

describe("validateDeck — 덱 매수", () => {
  it("정확히 deckSize면 통과한다", () => {
    const result = validateDeck(fillMain(60), ptcgRules);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("59장 · 61장은 deck_size 위반이다", () => {
    expect(codes(validateDeck(fillMain(59), ptcgRules).violations)).toContain("deck_size");
    expect(codes(validateDeck(fillMain(61), ptcgRules).violations)).toContain("deck_size");
  });

  it("빈 덱은 deck_size 위반 하나이고 던지지 않는다", () => {
    const result = validateDeck([], ptcgRules);
    expect(result.violations).toEqual([
      { code: "deck_size", zone: "main", expected: 60, actual: 0 },
    ]);
  });

  it("매수가 0 이하거나 정수가 아니면 invalid_count다", () => {
    const result = validateDeck([...fillMain(60), slot({ cardKey: "bad", count: -1 })], ptcgRules);
    expect(codes(result.violations)).toContain("invalid_count");
  });
});

describe("validateDeck — 동일 카드 매수 제한", () => {
  it("정확히 copyLimit이면 통과하고 하나 넘으면 걸린다", () => {
    expect(validateDeck([...fillMain(56), slot({ cardKey: "x", count: 4 })], ptcgRules).ok).toBe(
      true,
    );
    expect(
      codes(validateDeck([...fillMain(55), slot({ cardKey: "x", count: 5 })], ptcgRules).violations),
    ).toContain("copy_limit");
  });

  // ★ 나눠 넣으면 통과하는 검증은 검증이 아니다 (plan §4.7 ⓕ-2).
  it("같은 cardKey가 두 슬롯에 나뉘어 있어도 합산한다", () => {
    const result = validateDeck(
      [...fillMain(55), slot({ cardKey: "x", count: 2 }), slot({ cardKey: "x", count: 3 })],
      ptcgRules,
    );
    expect(result.violations).toContainEqual({
      code: "copy_limit",
      cardKey: "x",
      limit: 4,
      actual: 5,
    });
  });

  it("copyLimitExempt 슬롯은 매수 제한에서 빠진다 (기본 에너지)", () => {
    const result = validateDeck(
      [...fillMain(52), slot({ cardKey: "basic-energy", count: 8, copyLimitExempt: true })],
      ptcgRules,
    );
    expect(result.ok).toBe(true);
  });
});

describe("validateDeck — 존", () => {
  it("opcg는 leader 1장 · don 10장이면 통과한다", () => {
    const result = validateDeck(
      [
        ...fillMain(50, ["red"]),
        slot({ cardKey: "leader", count: 1, zone: "leader", colors: ["red"] }),
        slot({ cardKey: "don", count: 10, zone: "don" }),
      ],
      composeGameRules({ deckSize: 50, handSize: 5, copyLimit: 4 }, "opcg"),
    );
    expect(result.ok).toBe(true);
  });

  it("leader가 0장 · 2장이면 deck_size 위반이다", () => {
    const withoutLeader = validateDeck(
      [...fillMain(50, ["red"]), slot({ cardKey: "don", count: 10, zone: "don" })],
      opcgRules,
    );
    expect(withoutLeader.violations).toContainEqual({
      code: "deck_size",
      zone: "leader",
      expected: 1,
      actual: 0,
    });

    const twoLeaders = validateDeck(
      [
        ...fillMain(50, ["red"]),
        slot({ cardKey: "l1", count: 1, zone: "leader", colors: ["red"] }),
        slot({ cardKey: "l2", count: 1, zone: "leader", colors: ["red"] }),
        slot({ cardKey: "don", count: 10, zone: "don" }),
      ],
      opcgRules,
    );
    expect(codes(twoLeaders.violations)).toContain("deck_size");
  });

  it("ptcg 덱에 leader 슬롯이 있으면 zone_not_allowed다", () => {
    const result = validateDeck(
      [...fillMain(60), slot({ cardKey: "leader", count: 1, zone: "leader" })],
      ptcgRules,
    );
    expect(result.violations).toContainEqual({ code: "zone_not_allowed", zone: "leader" });
  });
});

describe("validateDeck — opcg 리더 색상", () => {
  const withLeader = (leaderColors: string[] | undefined, mainColors?: string[]) =>
    validateDeck(
      [
        slot({ cardKey: "leader", count: 1, zone: "leader", colors: leaderColors }),
        slot({ cardKey: "don", count: 10, zone: "don" }),
        ...fillMain(46, ["red"]),
        slot({ cardKey: "tested", count: 4, colors: mainColors }),
      ],
      opcgRules,
    );

  it("리더 색과 같으면 통과한다", () => {
    expect(withLeader(["red"], ["red"]).ok).toBe(true);
  });

  it("리더 색에 없는 색이면 leader_color_mismatch다", () => {
    expect(codes(withLeader(["red"], ["green"]).violations)).toContain("leader_color_mismatch");
  });

  it("리더 색의 부분집합이 아니면 걸린다 (다색 카드)", () => {
    expect(codes(withLeader(["red"], ["red", "green"]).violations)).toContain(
      "leader_color_mismatch",
    );
  });

  // ⚠️ 조용히 넘기면 "검증했다"는 화면이 아무것도 검증하지 않은 상태를 덮는다.
  it("색을 모르면 통과가 아니라 color_unknown이다", () => {
    expect(codes(withLeader(["red"], undefined).violations)).toContain("color_unknown");
    expect(codes(withLeader(undefined, ["red"]).violations)).toContain("color_unknown");
  });

  it("ptcg는 색상을 보지 않는다", () => {
    expect(validateDeck(fillMain(60), ptcgRules).ok).toBe(true);
  });
});

// ★ 하나씩 고치게 하면 60장 덱에서 왕복이 수십 번이 된다 (plan §4.7 ⓕ-1).
describe("validateDeck — 위반을 모아서 낸다", () => {
  it("위반이 여러 개면 여러 개가 다 담긴다", () => {
    const result = validateDeck(
      [
        slot({ cardKey: "x", count: 5 }),
        slot({ cardKey: "y", count: -1 }),
        slot({ cardKey: "leader", count: 1, zone: "leader" }),
      ],
      ptcgRules,
    );

    expect(result.ok).toBe(false);
    expect(new Set(codes(result.violations))).toEqual(
      new Set(["invalid_count", "zone_not_allowed", "deck_size", "copy_limit"]),
    );
  });
});
