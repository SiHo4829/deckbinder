import { describe, expect, it } from "vitest";

import { composeGameRules } from "@/lib/domain/rules";
import { buildLibrary, drawOpeningHand, mulligan } from "@/lib/domain/simulator/draw";
import { createRng } from "@/lib/domain/simulator/shuffle";
import type { DeckSlot } from "@/types/game";

/** 수치는 케이스마다 주입한다 — 60/7 같은 실제 값을 테스트에 심지 않는다 (plan §4.7 ⓑ) */
const ptcg = (deckSize: number, handSize: number) =>
  composeGameRules({ deckSize, handSize, copyLimit: 4 }, "ptcg");
const opcg = (deckSize: number, handSize: number) =>
  composeGameRules({ deckSize, handSize, copyLimit: 4 }, "opcg");

const slot = (over: Partial<DeckSlot> & Pick<DeckSlot, "cardKey" | "count">): DeckSlot => ({
  zone: "main",
  ...over,
});

describe("buildLibrary", () => {
  it("count만큼 cardKey를 펼친다", () => {
    expect(buildLibrary([slot({ cardKey: "x", count: 3 })], "main")).toEqual(["x", "x", "x"]);
  });

  it("count가 0이면 아무것도 내지 않는다", () => {
    expect(buildLibrary([slot({ cardKey: "x", count: 0 })], "main")).toEqual([]);
  });

  // 던지지 않는다. 잘못된 매수의 판정은 validateDeck의 일이다 (plan §4.7 ⓔ-3).
  it("count가 음수여도 던지지 않고 0장을 낸다", () => {
    expect(buildLibrary([slot({ cardKey: "x", count: -1 })], "main")).toEqual([]);
  });

  it("다른 존은 섞이지 않는다", () => {
    const slots = [
      slot({ cardKey: "main-card", count: 2 }),
      slot({ cardKey: "leader-card", count: 1, zone: "leader" }),
      slot({ cardKey: "don-card", count: 10, zone: "don" }),
    ];
    expect(buildLibrary(slots, "main")).toEqual(["main-card", "main-card"]);
    expect(buildLibrary(slots, "leader")).toEqual(["leader-card"]);
  });
});

describe("drawOpeningHand", () => {
  // ★ 7·5를 직접 단언하면 그 테스트가 숫자를 코드에 다시 심는다 (plan §4.7 ⓖ).
  it("손패 매수가 rules.handSize를 따른다", () => {
    const slots = [slot({ cardKey: "x", count: 20 })];
    expect(drawOpeningHand(slots, ptcg(20, 3), createRng(1)).hand).toHaveLength(3);
    expect(drawOpeningHand(slots, ptcg(20, 6), createRng(1)).hand).toHaveLength(6);
  });

  it("손패 + 라이브러리가 덱 전체다", () => {
    const slots = [slot({ cardKey: "x", count: 10 })];
    const state = drawOpeningHand(slots, ptcg(10, 4), createRng(9));

    expect(state.hand).toHaveLength(4);
    expect(state.library).toHaveLength(6);
    expect(state.mulliganCount).toBe(0);
  });

  // 덱 크기 판정은 validateDeck의 일이다. 두 곳에서 같은 것을 검사하지 않는다.
  it("덱이 handSize보다 작으면 있는 만큼 뽑고 라이브러리가 빈다", () => {
    const state = drawOpeningHand([slot({ cardKey: "x", count: 2 })], ptcg(60, 7), createRng(1));

    expect(state.hand).toHaveLength(2);
    expect(state.library).toEqual([]);
  });

  it("시드를 고정하면 결과가 재현된다", () => {
    const slots = [slot({ cardKey: "a", count: 5 }), slot({ cardKey: "b", count: 5 })];
    expect(drawOpeningHand(slots, ptcg(10, 4), createRng(77))).toEqual(
      drawOpeningHand(slots, ptcg(10, 4), createRng(77)),
    );
  });
});

describe("mulligan", () => {
  const basic = (cardKey: string, count: number) =>
    slot({ cardKey, count, roles: ["basic_pokemon"] });
  const nonBasic = (cardKey: string, count: number) => slot({ cardKey, count, roles: ["trainer"] });

  it("opcg는 2회째에 limit_reached를 낸다", () => {
    const slots = [slot({ cardKey: "x", count: 10 })];
    const rules = opcg(10, 3);
    const first = drawOpeningHand(slots, rules, createRng(5));

    const once = mulligan(first, slots, rules, createRng(6));
    expect(once.kind).toBe("redrawn");
    if (once.kind !== "redrawn") return;

    expect(once.state.mulliganCount).toBe(1);
    expect(mulligan(once.state, slots, rules, createRng(7))).toEqual({
      kind: "not_allowed",
      reason: "limit_reached",
    });
  });

  it("ptcg는 손패에 해당 역할이 있으면 condition_not_met을 낸다", () => {
    const slots = [basic("basic", 10)];
    const rules = ptcg(10, 3);
    const state = drawOpeningHand(slots, rules, createRng(5));

    expect(mulligan(state, slots, rules, createRng(6))).toEqual({
      kind: "not_allowed",
      reason: "condition_not_met",
    });
  });

  it("ptcg는 손패에 해당 역할이 없으면 다시 뽑는다", () => {
    const slots = [nonBasic("trainer", 10)];
    const rules = ptcg(10, 3);
    const state = drawOpeningHand(slots, rules, createRng(5));
    const result = mulligan(state, slots, rules, createRng(6));

    expect(result.kind).toBe("redrawn");
    if (result.kind !== "redrawn") return;
    expect(result.state.mulliganCount).toBe(1);
  });

  // ★ plan §4.7 ⓗ-1 — 스키마에 「기본 포켓몬」 식별값이 없다.
  // 조용히 false를 주지 않고 화면까지 "판정 불가"를 끌고 나온다.
  it("ptcg에서 모든 슬롯의 roles가 비면 undecidable을 낸다", () => {
    const slots = [slot({ cardKey: "unknown", count: 10 })];
    const rules = ptcg(10, 3);
    const state = drawOpeningHand(slots, rules, createRng(5));

    expect(mulligan(state, slots, rules, createRng(6))).toEqual({
      kind: "undecidable",
      reason: "role_unknown",
    });
  });

  it("멀리건 뒤에도 손패 + 라이브러리의 다중집합이 덱과 같다", () => {
    const slots = [nonBasic("t", 6), slot({ cardKey: "e", count: 4, roles: ["energy"] })];
    const rules = ptcg(10, 3);
    const state = drawOpeningHand(slots, rules, createRng(11));
    const result = mulligan(state, slots, rules, createRng(12));

    expect(result.kind).toBe("redrawn");
    if (result.kind !== "redrawn") return;
    expect([...result.state.hand, ...result.state.library].sort()).toEqual(
      [...Array<string>(6).fill("t"), ...Array<string>(4).fill("e")].sort(),
    );
  });
});
