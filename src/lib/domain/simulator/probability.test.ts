import { describe, expect, it } from "vitest";

import { atLeast, exactly } from "@/lib/domain/simulator/probability";

// 손으로 검산되는 소형 값으로 단언한다. 60장 덱 값을 넣으면 기댓값을
// 계산기로 만들어야 하고, 그러면 테스트가 구현을 베낀 것이 된다 (plan §4.7 ⓖ).
describe("atLeast", () => {
  it("N=4 K=2 n=2에서 1장 이상은 5/6이다", () => {
    expect(atLeast({ populationSize: 4, successCount: 2, sampleSize: 2 })).toBeCloseTo(5 / 6, 12);
  });

  it("원하는 카드가 0장이면 0이다", () => {
    expect(atLeast({ populationSize: 60, successCount: 0, sampleSize: 7 })).toBe(0);
  });

  it("덱이 전부 원하는 카드면 1이다", () => {
    expect(atLeast({ populationSize: 60, successCount: 60, sampleSize: 7 })).toBeCloseTo(1, 12);
  });

  it("한 장도 뽑지 않으면 0이다", () => {
    expect(atLeast({ populationSize: 60, successCount: 4, sampleSize: 0 })).toBe(0);
  });

  it("minHits가 보유 매수보다 크면 0이다", () => {
    expect(atLeast({ populationSize: 60, successCount: 2, sampleSize: 7, minHits: 3 })).toBe(0);
  });

  // 호출부의 버그가 아니라 사용자의 중간 상태다. 던지지 않고 "산출 불가"를 낸다
  // (plan §4.7 ⓔ-1 — §4.3의 sample_size < 3, §2.8 규칙 1과 같은 규칙).
  it("산출할 수 없는 입력에는 null을 낸다", () => {
    expect(atLeast({ populationSize: 5, successCount: 2, sampleSize: 7 })).toBeNull();
    expect(atLeast({ populationSize: 5, successCount: 9, sampleSize: 2 })).toBeNull();
    expect(atLeast({ populationSize: -1, successCount: 1, sampleSize: 1 })).toBeNull();
    expect(atLeast({ populationSize: 60, successCount: 4, sampleSize: 2.5 })).toBeNull();
  });

  // 조합수 오버플로는 작은 값 테스트만으로는 잡히지 않는다.
  it("큰 입력에서도 유한하고 0..1 범위다", () => {
    const value = atLeast({ populationSize: 300, successCount: 40, sampleSize: 60 });

    expect(value).not.toBeNull();
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});

describe("exactly", () => {
  it("N=4 K=2 n=2에서 정확히 2장은 1/6이다", () => {
    expect(exactly({ populationSize: 4, successCount: 2, sampleSize: 2, hits: 2 })).toBeCloseTo(
      1 / 6,
      12,
    );
  });

  it("모든 hits의 확률을 더하면 1이다", () => {
    const total = [0, 1, 2].reduce(
      (sum, hits) =>
        sum + (exactly({ populationSize: 4, successCount: 2, sampleSize: 2, hits }) ?? 0),
      0,
    );
    expect(total).toBeCloseTo(1, 12);
  });

  it("뽑는 매수나 보유 매수를 넘는 hits는 0이다", () => {
    expect(exactly({ populationSize: 60, successCount: 4, sampleSize: 7, hits: 5 })).toBe(0);
    expect(exactly({ populationSize: 60, successCount: 4, sampleSize: 2, hits: 3 })).toBe(0);
  });

  it("산출할 수 없는 입력에는 null을 낸다", () => {
    expect(exactly({ populationSize: 5, successCount: 2, sampleSize: 7, hits: 1 })).toBeNull();
    expect(exactly({ populationSize: 60, successCount: 4, sampleSize: 7, hits: -1 })).toBeNull();
  });
});
