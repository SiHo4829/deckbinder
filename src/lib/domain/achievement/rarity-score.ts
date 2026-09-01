// 자체 희귀도 점수 — 도메인 순수 함수 (plan §4.13 ⓒ · ⓓ · ⓓ-6).
//
// 카드 DB 타입을 import하지 않는다 (§4.7 ⓓ · eslint.config.mjs의 src/lib/domain/**
// 블록이 문다). 입력은 전부 원시값이고, 컬럼명 번역은 호출부(T2.15)의 몫이다.
//
// 이 파일의 숫자는 "설계가 정한 진리"가 아니라 "지금 있는 실측으로 정한
// 출발점"이다. 무엇을 고쳐도 되고 무엇을 고치면 안 되는지는 §4.13 ⓓ-6의 10이
// 가른다 — 값(가중치 여덟 · 상수 셋 · 밴드 경계)은 고쳐도 되고, 모양(축 셋 ·
// 최댓값 합 100 · 밴드 한 칸·무강등 · 모르면 null · 팝수 없이 성립 ·
// undecidable 열거형 둘)은 고치지 않는다. 그 강제는 테스트가 진다.

/** 한 인쇄본에 대해 우리가 아는 것. 모르는 것은 넣지 않는다 — 옵셔널로도. */
export interface PrintingFacts {
  /** 원천이 붙인 레어도 라벨. 실측 8종이나 도메인은 그 목록을 모른다 (§4.13 ⓓ-4). */
  readonly rarityLabel: string | null;
  /** 일러스트 구분(실측 "오리지널"·"원작"). 미관측 값이 올 수 있다. */
  readonly illustration: string | null;
  /** 같은 카드의 다른 인쇄본인가(§4.6). 도메인은 _P1 규칙을 모른다. */
  readonly isAlternatePrinting: boolean;
  /** 같은 그룹을 공유하는 인쇄본 수. 자기 자신을 포함한다. 1 이상. */
  readonly printingsInGroup: number;
  /** 같은 세트에서 같은 라벨을 가진 행 수. 자기 자신을 포함한다. 1 이상. */
  readonly peerCount: number;
  /** 그 세트의 총 행 수. 1 이상. "발매된 카드 수"가 아니라 우리가 가진 행 수다. */
  readonly setSize: number;
}

/** 팝수는 별개 인자다. 없어도 점수가 나온다 (§4.13 ⓕ). */
export interface PopulationFacts {
  readonly graded: number;
  readonly gem: number;
}

export type RarityBand = "common" | "uncommon" | "rare" | "scarce" | "trophy";

/** 왜 그 점수인지를 값으로 돌려준다. 화면이 문장을 지어내지 않게 한다 (§4.13 ⓖ-2). */
export type RarityReason =
  | { readonly kind: "rarity_label"; readonly label: string; readonly weight: number }
  | { readonly kind: "scarce_in_set"; readonly peerCount: number; readonly setSize: number }
  | { readonly kind: "alternate_printing"; readonly printingsInGroup: number }
  | { readonly kind: "illustration"; readonly label: string }
  | { readonly kind: "population"; readonly graded: number };

export interface RarityScore {
  /** 0~100. 모르면 null이다. 0이 아니다 — §4.13 ⓓ-4. */
  readonly score: number | null;
  /** 화면이 그리는 등급. score가 null이면 이것도 null이다. */
  readonly band: RarityBand | null;
  readonly reasons: readonly RarityReason[];
  /** score가 null일 때 왜인지. 그 외에는 null. */
  readonly undecidable: "rarity_unknown" | "set_unknown" | null;
}

/**
 * 1차 축 — 레어도 라벨의 가중치 (0~85).
 *
 * 원천이 붙인 서열 6단(C < UC < R < SR < L < SEC·SP)을 5~85 구간에 등간(16점)으로
 * 놓고 5의 배수로 반올림했다. 점유율은 값을 만들지 않았고 검산에만 썼다 —
 * 우리가 서열을 발명하지 않고 원천이 붙인 것에 눈금만 붙인 것이다 (§4.13 ⓓ 판정 1).
 *
 * P(프로모)만 사다리 밖의 60이다. 봉입이 아니라 배포 경로가 다른 라벨이라
 * 사다리 칸 위에 올리면 그 자체가 서열 주장이 된다. 이 표에서 신뢰도가 가장
 * 낮은 값이고, 실데이터를 볼 때 첫 번째로 고칠 값이다 (§4.13 ⓓ-6의 6).
 *
 * 모르는 라벨에 기본값을 주지 않는다 — null이다.
 */
export const RARITY_WEIGHTS: Readonly<Record<string, number>> = {
  C: 5,
  UC: 20,
  R: 35,
  SR: 55,
  L: 70,
  SEC: 85,
  SP: 85,
  P: 60,
};

/** 2차 축의 폭. 세트 안에서 얼마나 드문가 (§4.13 ⓓ 판정 2). */
export const SCARCITY_MAX_POINTS = 10;

/** 3차 축 — 이 인쇄본이 기본 인쇄본이 아니다. */
export const PRINTING_ALTERNATE_POINTS = 4;

/** 3차 축 — 이 카드에 인쇄본이 여럿이다(수집 축이 하나 더 있다). */
export const PRINTING_GROUP_POINTS = 1;

/**
 * 밴드 경계. 2·3차 축(최대 +15)이 어떤 라벨도 두 밴드 위로 올리지 못하게 잡았고,
 * 보너스가 전부 음이 아니므로 원천 라벨이 강등되는 일은 구조적으로 없다.
 *
 * 밴드가 라벨의 되풀이처럼 보이는 것은 의도다 — 판정 1이 라벨을 1차 축으로
 * 골랐으므로 밴드가 라벨을 대체로 따라가는 것은 그 선택의 결과다 (§4.13 ⓓ-6의 3).
 */
const BAND_CEILINGS: readonly { readonly band: RarityBand; readonly max: number }[] = [
  { band: "common", max: 14 },
  { band: "uncommon", max: 29 },
  { band: "rare", max: 49 },
  { band: "scarce", max: 79 },
  { band: "trophy", max: 100 },
];

const UNDECIDABLE = (reason: "rarity_unknown" | "set_unknown"): RarityScore => ({
  score: null,
  band: null,
  // 산출 불가인데 근거 목록이 차 있으면 화면이 "이유가 있는 점수"로 읽는다.
  reasons: [],
  undecidable: reason,
});

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * 라벨 조회. 정확 일치만 한다 — trim()도 대소문자 접기도 하지 않는다.
 *
 * §4.13 ⓐ-2가 "원문 그대로 저장. 좁히는 코드를 만들지 않는다"로 확정했고,
 * 정규화는 좁히는 코드의 첫 걸음이다. 대가는 원천이 표기를 바꾸면 그날 그
 * 카드들이 전부 "산출 불가"가 되는 것이고, 조용히 틀린 점수보다 낫다.
 */
export function rarityWeight(label: string | null): number | null {
  if (label === null) return null;

  return Object.prototype.hasOwnProperty.call(RARITY_WEIGHTS, label)
    ? RARITY_WEIGHTS[label]
    : null;
}

/**
 * 2차 축의 기여. 분모가 성립하지 않으면 null(= set_unknown)이다.
 *
 * 조용히 클램프하면 어댑터(T2.15)의 집계 버그가 점수에 묻힌다 — §4.7 ⓔ-2가
 * total === 0에 대해 "0/0을 1이나 0으로 만들지 않는다"로 세운 것과 같은 자리다.
 */
function scarcityPoints(peerCount: number, setSize: number): number | null {
  if (!isCount(peerCount) || !isCount(setSize)) return null;
  if (setSize < 1 || peerCount < 1 || peerCount > setSize) return null;

  return SCARCITY_MAX_POINTS * (1 - peerCount / setSize);
}

/**
 * 3차 축이 성립하는 입력인가.
 *
 * 성립하지 않아도 undecidable이 아니다 — 3차 축은 분모가 아니라 조건이라
 * "여럿이 아니다"로 답할 수 있고, undecidable 열거형은 §4.13 ⓓ가 고정했다.
 * 대가(어댑터 버그가 5점 안에 묻힌다)는 T2.15 ⓐ의 번역 테스트가 진다.
 */
function hasCoherentPrintings({ isAlternatePrinting, printingsInGroup }: PrintingFacts): boolean {
  if (!isCount(printingsInGroup) || printingsInGroup < 1) return false;

  // 다른 인쇄본인데 그룹에 자기 하나뿐이라는 것은 모순이다.
  return !(isAlternatePrinting && printingsInGroup < 2);
}

function bandOf(score: number): RarityBand {
  const hit = BAND_CEILINGS.find(({ max }) => score <= max);

  return hit ? hit.band : BAND_CEILINGS[BAND_CEILINGS.length - 1].band;
}

/**
 * 한 인쇄본의 희귀도 점수. 축 셋(라벨 · 세트 안 희소 · 인쇄본)의 합이고
 * 최댓값이 정확히 100이다.
 *
 * population은 선택 인자이고 점수에 0점 기여한다 — 데이터가 0행이라 어떤 값을
 * 넣어도 반증할 수 없다. 상수조차 만들지 않는 이유는 그 자리가 "채우기만 하면
 * 되는 칸"으로 보이면 안 되기 때문이다. 그 칸을 채우는 것은 사용자 결정이다
 * (백로그 A-8 · §4.13 ⓕ).
 */
export function rarityScore(facts: PrintingFacts, population?: PopulationFacts | null): RarityScore {
  const weight = rarityWeight(facts.rarityLabel);

  // 1차 축이 없으면 나머지를 볼 이유가 없다. 우선순위를 값으로 고정한다.
  if (weight === null) return UNDECIDABLE("rarity_unknown");

  const scarcity = scarcityPoints(facts.peerCount, facts.setSize);
  if (scarcity === null) return UNDECIDABLE("set_unknown");

  const coherent = hasCoherentPrintings(facts);
  const alternatePoints = coherent && facts.isAlternatePrinting ? PRINTING_ALTERNATE_POINTS : 0;
  const groupPoints = coherent && facts.printingsInGroup >= 2 ? PRINTING_GROUP_POINTS : 0;

  // 반올림은 마지막에 한 번. 클램프는 방어이지 설계가 아니다 — 최댓값 대조
  // (85 + 10 + 4 + 1 = 100)가 성립하면 발동하지 않는다.
  const score = Math.min(100, Math.max(0, Math.round(weight + scarcity + alternatePoints + groupPoints)));

  // 순서는 고정이다. 화면이 정렬을 다시 하지 않게 한다 (§4.13 ⓓ-6의 9).
  const reasons: RarityReason[] = [
    { kind: "rarity_label", label: facts.rarityLabel as string, weight },
  ];

  if (scarcity >= 1) {
    reasons.push({ kind: "scarce_in_set", peerCount: facts.peerCount, setSize: facts.setSize });
  }
  if (coherent && facts.isAlternatePrinting) {
    reasons.push({ kind: "alternate_printing", printingsInGroup: facts.printingsInGroup });
  }
  if (facts.illustration !== null) {
    reasons.push({ kind: "illustration", label: facts.illustration });
  }
  if (population && isCount(population.graded) && population.graded >= 1) {
    reasons.push({ kind: "population", graded: population.graded });
  }

  return { score, band: bandOf(score), reasons, undecidable: null };
}
