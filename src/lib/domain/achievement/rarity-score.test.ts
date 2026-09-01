import { describe, expect, it } from "vitest";

import {
  PRINTING_ALTERNATE_POINTS,
  PRINTING_GROUP_POINTS,
  RARITY_WEIGHTS,
  SCARCITY_MAX_POINTS,
  rarityScore,
  rarityWeight,
  type PrintingFacts,
  type RarityBand,
} from "@/lib/domain/achievement/rarity-score";

// 이 파일은 점수 리터럴을 손으로 적지 않는다 (plan §4.13 ⓓ-6의 10).
// 값(RARITY_WEIGHTS · 상수 셋 · 밴드 경계)은 실데이터를 보고 고치라고 남긴
// 자리이고, 고쳐도 아래 단언은 살아 있어야 한다. 반대로 모양(축 셋 · 합 100 ·
// 밴드 한 칸 · null 규칙 · 팝수 무인자)을 깨면 반드시 깨져야 한다.
// images.ts가 "조각 검사를 두 벌로 두면 언젠가 하나만 고쳐진다"로 세운 자세와 같다.

const BASE: PrintingFacts = {
  rarityLabel: "R",
  illustration: null,
  isAlternatePrinting: false,
  printingsInGroup: 1,
  peerCount: 1,
  setSize: 100,
};

function facts(overrides: Partial<PrintingFacts> = {}): PrintingFacts {
  return { ...BASE, ...overrides };
}

/** 밴드의 서열. "한 칸만 오른다 · 내려가지 않는다"를 세려면 순서가 필요하다. */
const BAND_ORDER: readonly RarityBand[] = ["common", "uncommon", "rare", "scarce", "trophy"];

function bandIndex(band: RarityBand | null): number {
  expect(band).not.toBeNull();
  return BAND_ORDER.indexOf(band as RarityBand);
}

const LABELS = Object.keys(RARITY_WEIGHTS);

describe("RARITY_WEIGHTS — 모양 (plan §4.13 ⓓ-6)", () => {
  // 합 = 100. 값을 고치다 이 합을 넘기면 그 자리에서 깨진다.
  it("최댓값 합이 정확히 100이다", () => {
    const topLabel = Math.max(...Object.values(RARITY_WEIGHTS));

    expect(topLabel + SCARCITY_MAX_POINTS + PRINTING_ALTERNATE_POINTS + PRINTING_GROUP_POINTS).toBe(
      100,
    );
  });

  // 원천이 붙인 서열(C < UC < R < SR < L ≤ SEC = SP)에 눈금을 붙인 것이지
  // 우리가 서열을 발명한 것이 아니다 (plan §4.13 ⓓ 판정 1).
  it("원천의 서열을 뒤집지 않는다", () => {
    const { C, UC, R, SR, L, SEC, SP } = RARITY_WEIGHTS;

    expect(C).toBeLessThan(UC);
    expect(UC).toBeLessThan(R);
    expect(R).toBeLessThan(SR);
    expect(SR).toBeLessThan(L);
    expect(L).toBeLessThanOrEqual(SEC);
    expect(SEC).toBe(SP);
  });

  it("rarityWeight는 표에 없는 라벨과 null에 null을 낸다", () => {
    expect(rarityWeight("R")).toBe(RARITY_WEIGHTS.R);
    expect(rarityWeight("아무거나")).toBeNull();
    expect(rarityWeight(null)).toBeNull();
  });

  // ⓓ-6의 8 — 정확 일치만 한다. 정규화는 "좁히는 코드"의 첫 걸음이다 (§4.13 ⓐ-2).
  it("공백·대소문자를 접지 않는다", () => {
    expect(rarityWeight(" R ")).toBeNull();
    expect(rarityWeight("r")).toBeNull();
  });
});

describe("rarityScore — 라벨 축", () => {
  it("표의 라벨 전부가 점수를 낸다", () => {
    for (const label of LABELS) {
      const result = rarityScore(facts({ rarityLabel: label }));

      expect(result.score).not.toBeNull();
      expect(result.band).not.toBeNull();
      expect(result.undecidable).toBeNull();
      expect(result.reasons[0]).toEqual({
        kind: "rarity_label",
        label,
        weight: RARITY_WEIGHTS[label],
      });
    }
  });

  // 0이 아니다. 0점은 "가장 흔한 카드"라는 주장이 된다 (plan §4.13 ⓓ-4).
  it("모르는 라벨은 0이 아니라 null이다", () => {
    const result = rarityScore(facts({ rarityLabel: "존재하지-않는-라벨" }));

    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.undecidable).toBe("rarity_unknown");
    // 산출 불가인데 근거 목록이 차 있으면 화면이 "이유가 있는 점수"로 읽는다.
    expect(result.reasons).toEqual([]);
  });

  it("rarityLabel이 null이어도 같은 결과다", () => {
    const result = rarityScore(facts({ rarityLabel: null }));

    expect(result.score).toBeNull();
    expect(result.undecidable).toBe("rarity_unknown");
    expect(result.reasons).toEqual([]);
  });
});

describe("rarityScore — 세트 안 희소 축", () => {
  // setSize는 나눗셈의 분모다. 조용히 클램프하면 어댑터(T2.15)의 집계 버그가
  // 점수에 묻힌다 (plan §4.13 ⓓ-6의 9).
  it("분모가 성립하지 않으면 set_unknown이다", () => {
    for (const broken of [
      { peerCount: 1, setSize: 0 },
      { peerCount: 0, setSize: 10 },
      { peerCount: 11, setSize: 10 },
    ]) {
      const result = rarityScore(facts(broken));

      expect(result.score).toBeNull();
      expect(result.band).toBeNull();
      expect(result.undecidable).toBe("set_unknown");
      expect(result.reasons).toEqual([]);
    }
  });

  // 1차 축이 없으면 나머지를 볼 이유가 없다. 우선순위를 값으로 고정한다.
  it("둘 다 걸리면 rarity_unknown이 이긴다", () => {
    const result = rarityScore(facts({ rarityLabel: null, setSize: 0 }));

    expect(result.undecidable).toBe("rarity_unknown");
  });

  // 전부 같은 레어도인 세트에서 2차 축은 점수를 흔들지 않는다.
  it("peerCount === setSize면 2차 축 기여가 정확히 0이다", () => {
    const result = rarityScore(facts({ peerCount: 40, setSize: 40 }));

    expect(result.score).toBe(RARITY_WEIGHTS.R);
    expect(result.reasons.some((reason) => reason.kind === "scarce_in_set")).toBe(false);
  });

  it("드물수록 점수가 높다", () => {
    const rare = rarityScore(facts({ peerCount: 1, setSize: 200 }));
    const common = rarityScore(facts({ peerCount: 100, setSize: 200 }));

    expect(rare.score).toBeGreaterThan(common.score as number);
    expect(rare.reasons).toContainEqual({
      kind: "scarce_in_set",
      peerCount: 1,
      setSize: 200,
    });
  });
});

describe("rarityScore — 인쇄본 축", () => {
  it("패러렐이 원본보다 낮지 않다", () => {
    const alternate = rarityScore(facts({ isAlternatePrinting: true, printingsInGroup: 2 }));
    const original = rarityScore(facts({ isAlternatePrinting: false, printingsInGroup: 2 }));

    expect(alternate.score).toBeGreaterThanOrEqual(original.score as number);
    expect(alternate.reasons).toContainEqual({
      kind: "alternate_printing",
      printingsInGroup: 2,
    });
    expect(original.reasons.some((reason) => reason.kind === "alternate_printing")).toBe(false);
  });

  // 두 조각이 서로 다른 것을 센다. 한 조각으로 둘을 다 만족시키면
  // printingsInGroup이 사실상 안 쓰이는 인자가 된다 (plan §4.13 ⓓ-6의 2).
  it("printingsInGroup이 1인 것과 여럿인 것이 갈린다", () => {
    const alone = rarityScore(facts({ printingsInGroup: 1 }));
    const grouped = rarityScore(facts({ printingsInGroup: 2 }));

    expect((grouped.score as number) - (alone.score as number)).toBe(PRINTING_GROUP_POINTS);
  });

  // undecidable을 늘리지 않는다. 3차 축은 분모가 아니라 조건이라
  // "여럿이 아니다"로 답할 수 있다 (plan §4.13 ⓓ-6의 9).
  it("인쇄본 수가 모순이면 산출 불가가 아니라 3차 축이 0이다", () => {
    const contradictory = rarityScore(facts({ isAlternatePrinting: true, printingsInGroup: 1 }));
    const plain = rarityScore(facts({ isAlternatePrinting: false, printingsInGroup: 1 }));

    expect(contradictory.undecidable).toBeNull();
    expect(contradictory.score).toBe(plain.score);
    expect(contradictory.reasons.some((reason) => reason.kind === "alternate_printing")).toBe(
      false,
    );
  });
});

describe("rarityScore — 점수에 더하지 않는 것 둘 (plan §4.13 ⓓ-6의 7)", () => {
  it("일러스트는 점수를 바꾸지 않고 reasons에만 나온다", () => {
    const withIllustration = rarityScore(facts({ illustration: "오리지널" }));
    const without = rarityScore(facts({ illustration: null }));

    expect(withIllustration.score).toBe(without.score);
    expect(withIllustration.reasons).toContainEqual({
      kind: "illustration",
      label: "오리지널",
    });
    expect(without.reasons.some((reason) => reason.kind === "illustration")).toBe(false);
  });

  // "PSA 자리만 만들었다"의 유일한 증거다 (plan §4.13 ⓕ · §8 T2.14 ⓕ).
  // 이 파일의 다른 케이스도 대부분 population을 넘기지 않는다.
  it("population 인자를 아예 넘기지 않아도 점수가 나온다", () => {
    for (const label of LABELS) {
      expect(rarityScore(facts({ rarityLabel: label })).score).not.toBeNull();
    }

    expect(rarityScore(facts(), null).score).toBe(rarityScore(facts()).score);
    expect(rarityScore(facts(), undefined).score).toBe(rarityScore(facts()).score);
  });

  it("population은 더해질 뿐 다른 reasons를 지우지 않는다", () => {
    const input = facts({ illustration: "원작", isAlternatePrinting: true, printingsInGroup: 3 });
    const without = rarityScore(input);
    const withPopulation = rarityScore(input, { graded: 12, gem: 3 });

    expect(withPopulation.score).toBe(without.score);
    for (const reason of without.reasons) {
      expect(withPopulation.reasons).toContainEqual(reason);
    }
    expect(withPopulation.reasons).toContainEqual({ kind: "population", graded: 12 });
  });

  it("팝수가 0건이면 population reason을 내지 않는다", () => {
    const result = rarityScore(facts(), { graded: 0, gem: 0 });

    expect(result.reasons.some((reason) => reason.kind === "population")).toBe(false);
  });
});

describe("rarityScore — 불변식", () => {
  // 2·3차 축이 어떤 라벨도 두 밴드 위로 올리지 못한다. 그리고 내려가지 않는다.
  it("밴드는 최대 한 칸만 오르고 내려가지 않는다", () => {
    for (const label of LABELS) {
      const floor = rarityScore(facts({ rarityLabel: label, peerCount: 40, setSize: 40 }));
      const ceiling = rarityScore(
        facts({
          rarityLabel: label,
          peerCount: 1,
          setSize: 100_000,
          isAlternatePrinting: true,
          printingsInGroup: 9,
          illustration: "오리지널",
        }),
      );

      const lift = bandIndex(ceiling.band) - bandIndex(floor.band);

      expect(lift).toBeGreaterThanOrEqual(0);
      expect(lift).toBeLessThanOrEqual(1);
    }
  });

  it("어떤 경계 입력에서도 점수가 0~100을 벗어나지 않는다", () => {
    const edges: PrintingFacts[] = [
      facts({
        rarityLabel: "SEC",
        peerCount: 1,
        setSize: Number.MAX_SAFE_INTEGER,
        isAlternatePrinting: true,
        printingsInGroup: Number.MAX_SAFE_INTEGER,
      }),
      facts({ rarityLabel: "C", peerCount: 1, setSize: 1 }),
      facts({ peerCount: Number.NaN, setSize: Number.NaN }),
      facts({ peerCount: 1, setSize: Number.POSITIVE_INFINITY }),
      facts({ printingsInGroup: Number.NaN }),
      facts({ printingsInGroup: -5 }),
    ];

    for (const input of edges) {
      const { score } = rarityScore(input);

      if (score !== null) {
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  // 점수의 실질 하한은 5다. 0은 ⓓ-4가 "주장"이라고 부른 값이고, 라벨을 아는
  // 카드에는 그 값을 주지 않는다. 모르면 0이 아니라 null이다 — 두 상태가 값에서도 갈린다.
  it("라벨을 아는 카드에는 0점을 주지 않는다", () => {
    for (const label of LABELS) {
      const result = rarityScore(facts({ rarityLabel: label, peerCount: 40, setSize: 40 }));

      expect(result.score).toBeGreaterThan(0);
    }
  });

  // 화면이 정렬을 다시 하지 않게 한다 (plan §4.13 ⓓ-6의 9).
  it("reasons 순서가 고정이다", () => {
    const result = rarityScore(
      facts({
        peerCount: 1,
        setSize: 200,
        isAlternatePrinting: true,
        printingsInGroup: 4,
        illustration: "원작",
      }),
      { graded: 5, gem: 1 },
    );

    expect(result.reasons.map((reason) => reason.kind)).toEqual([
      "rarity_label",
      "scarce_in_set",
      "alternate_printing",
      "illustration",
      "population",
    ]);
  });

  it("같은 입력이 같은 출력을 낸다", () => {
    const input = facts({ rarityLabel: "SR", peerCount: 3, setSize: 77, printingsInGroup: 2 });

    expect(rarityScore(input)).toEqual(rarityScore(input));
  });
});
