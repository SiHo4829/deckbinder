import { describe, expect, it } from "vitest";

import { createRng, shuffle } from "@/lib/domain/simulator/shuffle";

const DECK = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("createRng", () => {
  it("[0, 1) 범위를 낸다", () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("같은 시드면 같은 순열이 나온다", () => {
    expect(shuffle(DECK, createRng(42))).toEqual(shuffle(DECK, createRng(42)));
  });

  // 시드를 고정해 단언한다. 무작위 시드로 "다르다"를 단언하면 flaky해진다.
  it("다른 시드면 다른 순열이 나온다", () => {
    expect(shuffle(DECK, createRng(1))).not.toEqual(shuffle(DECK, createRng(2)));
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const original = [...DECK];
    shuffle(DECK, createRng(7));
    expect(DECK).toEqual(original);
  });

  // 카드가 사라지지도 늘지도 않는다.
  it("다중집합을 보존한다", () => {
    const withDuplicates = ["a", "a", "b", "b", "b", "c"];
    expect([...shuffle(withDuplicates, createRng(3))].sort()).toEqual([...withDuplicates].sort());
  });

  it("길이 0 · 1에서도 동작한다", () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(["only"], createRng(1))).toEqual(["only"]);
  });
});
