import { describe, expect, it } from "vitest";

import { completion } from "@/lib/domain/achievement/completion";

// 묶음의 단위는 셋이다 — 세트 · 게임 · 그룹. completion()은 그중 무엇인지
// 모른다. universe를 받을 뿐이고 호출부가 정한다 (plan §4.13 ⓔ).

describe("completion", () => {
  it("가진 것과 전체의 비율을 낸다", () => {
    const result = completion({ universe: ["a", "b", "c", "d"], owned: ["a", "c"] });

    expect(result.total).toBe(4);
    expect(result.ownedCount).toBe(2);
    expect(result.ratio).toBe(0.5);
  });

  // 0/0을 1이나 0으로 만들지 않는다. §4.3의 sample_size < 3, §4.7 ⓔ-1의
  // 확률, 희귀도의 rarity_unknown과 같은 규칙이다 (plan §4.13 ⓔ).
  it("universe가 비면 ratio가 null이다", () => {
    const result = completion({ universe: [], owned: [] });

    expect(result.total).toBe(0);
    expect(result.ownedCount).toBe(0);
    expect(result.ratio).toBeNull();
  });

  it("아무것도 안 가졌으면 0이다", () => {
    const result = completion({ universe: ["a", "b"], owned: [] });

    expect(result.ratio).toBe(0);
    expect(result.missing).toEqual(["a", "b"]);
  });

  it("owned에 중복이 있어도 ownedCount가 부풀지 않는다", () => {
    const result = completion({ universe: ["a", "b"], owned: ["a", "a", "a"] });

    expect(result.ownedCount).toBe(1);
    expect(result.ratio).toBe(0.5);
  });

  it("universe에 중복이 있어도 total이 부풀지 않는다", () => {
    const result = completion({ universe: ["a", "a", "b"], owned: ["a"] });

    expect(result.total).toBe(2);
    expect(result.missing).toEqual(["b"]);
  });

  // 카탈로그가 늘거나 줄면 생긴다(세트 재적재 · A-7의 커버리지 구멍).
  // 조용히 지우면 사용자의 체크가 이유 없이 사라지고 그 사고는 늦게 발견된다
  // (plan §4.13 ⓔ-4 — purge.ts의 "0건은 초록이 아니다"와 같은 종류).
  it("universe 밖의 소유 표시를 버리지 않고 센다", () => {
    const result = completion({ universe: ["a", "b"], owned: ["a", "사라진-카드"] });

    expect(result.strays).toEqual(["사라진-카드"]);
    expect(result.ownedCount).toBe(1);
    expect(result.total).toBe(2);
  });

  it("missing이 total - ownedCount와 맞는다", () => {
    const result = completion({
      universe: ["a", "b", "c", "d", "e"],
      owned: ["b", "e", "universe-밖"],
    });

    expect(result.missing).toHaveLength(result.total - result.ownedCount);
    expect(result.missing).toEqual(["a", "c", "d"]);
  });
});
