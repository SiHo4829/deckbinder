import { describe, expect, it } from "vitest";

import { summarizeDeck } from "@/lib/domain/deck/stats";
import type { DeckSlot } from "@/types/game";

const slot = (over: Partial<DeckSlot> & Pick<DeckSlot, "cardKey" | "count">): DeckSlot => ({
  zone: "main",
  ...over,
});

describe("summarizeDeck", () => {
  it("빈 덱은 전 존이 0이다", () => {
    const stats = summarizeDeck([]);
    expect(stats.byZone).toEqual({ main: 0, leader: 0, don: 0 });
    expect(stats.distinctCards).toBe(0);
    expect(stats.groups).toEqual([]);
  });

  // 슬롯 수가 아니라 count 합이다.
  it("byZone은 매수를 더한다", () => {
    const stats = summarizeDeck([
      slot({ cardKey: "a", count: 4 }),
      slot({ cardKey: "b", count: 3 }),
      slot({ cardKey: "leader", count: 1, zone: "leader" }),
      slot({ cardKey: "don", count: 10, zone: "don" }),
    ]);

    expect(stats.byZone).toEqual({ main: 7, leader: 1, don: 10 });
    expect(stats.distinctCards).toBe(4);
  });

  it("같은 cardKey가 두 슬롯에 있어도 distinctCards는 1이다", () => {
    const stats = summarizeDeck([
      slot({ cardKey: "a", count: 2 }),
      slot({ cardKey: "a", count: 2 }),
    ]);
    expect(stats.distinctCards).toBe(1);
    expect(stats.byZone.main).toBe(4);
  });

  // 도메인은 "카드 종류"라는 개념을 갖지 않는다 — 축을 주입받는다 (plan §4.7 ⓓ-4).
  it("groupBy를 주지 않으면 groups가 비어 있다", () => {
    expect(summarizeDeck([slot({ cardKey: "a", count: 4 })]).groups).toEqual([]);
  });

  it("groupBy가 준 축으로 매수를 모은다", () => {
    const stats = summarizeDeck(
      [
        slot({ cardKey: "a", count: 4, roles: ["pokemon"] }),
        slot({ cardKey: "b", count: 3, roles: ["pokemon"] }),
        slot({ cardKey: "c", count: 2, roles: ["trainer"] }),
      ],
      (s) => s.roles?.[0] ?? null,
    );

    expect(stats.groups).toEqual([
      { key: "pokemon", count: 7 },
      { key: "trainer", count: 2 },
    ]);
  });

  it("groupBy가 null을 낸 슬롯은 버려지지 않고 null 버킷에 모인다", () => {
    const stats = summarizeDeck(
      [
        slot({ cardKey: "a", count: 4, roles: ["pokemon"] }),
        slot({ cardKey: "b", count: 2 }),
        slot({ cardKey: "c", count: 1 }),
      ],
      (s) => s.roles?.[0] ?? null,
    );

    expect(stats.groups).toContainEqual({ key: null, count: 3 });
  });

  it("쓸 수 없는 매수는 0으로 친다 — 총계가 음수가 되지 않는다", () => {
    const stats = summarizeDeck([
      slot({ cardKey: "a", count: 4 }),
      slot({ cardKey: "bad", count: -3 }),
    ]);
    expect(stats.byZone.main).toBe(4);
  });
});
