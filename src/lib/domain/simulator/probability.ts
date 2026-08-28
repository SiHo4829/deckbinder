export interface HypergeometricInput {
  /** 덱 매수 */
  readonly populationSize: number;
  /** 원하는 카드의 매수 */
  readonly successCount: number;
  /** 뽑는 매수 */
  readonly sampleSize: number;
  /** 기본 1 */
  readonly minHits?: number;
}

/**
 * `log(n!)`. 누적합을 필요할 때까지만 늘린다.
 *
 * **로그 공간에서 계산하는 이유**는 조합수가 곧바로 넘치기 때문이다 —
 * `C(300, 60)`은 배정밀도 범위 밖이라 비율로 직접 계산하면 `Infinity/Infinity`가
 * 되어 `NaN`이 나온다. 작은 값 테스트만으로는 잡히지 않는 유형이다.
 */
const LOG_FACTORIAL: number[] = [0];

function logFactorial(n: number): number {
  for (let i = LOG_FACTORIAL.length; i <= n; i += 1) {
    LOG_FACTORIAL[i] = LOG_FACTORIAL[i - 1] + Math.log(i);
  }
  return LOG_FACTORIAL[n];
}

function logChoose(n: number, k: number): number {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * 계산이 성립하는 입력인가.
 *
 * **성립하지 않으면 던지지 않고 `null`을 낸다.** 덱 빌더는 덱이 완성되기 전에도
 * 열려 있어 `sampleSize > populationSize`가 정상적으로 나온다 — 호출부의 버그가
 * 아니라 사용자의 중간 상태다 (plan §4.7 ⓔ-1).
 */
function isComputable({ populationSize, successCount, sampleSize }: HypergeometricInput): boolean {
  return (
    isCount(populationSize) &&
    isCount(successCount) &&
    isCount(sampleSize) &&
    successCount <= populationSize &&
    sampleSize <= populationSize
  );
}

/** 정확히 `hits`장이 들어올 확률. 산출 불가면 `null`. */
export function exactly(input: HypergeometricInput & { hits: number }): number | null {
  const { populationSize: N, successCount: K, sampleSize: n, hits } = input;

  if (!isComputable(input) || !isCount(hits)) return null;
  if (hits > K || hits > n || n - hits > N - K) return 0;

  return Math.exp(logChoose(K, hits) + logChoose(N - K, n - hits) - logChoose(N, n));
}

/** `minHits`장 이상이 들어올 확률. 산출 불가면 `null`. */
export function atLeast(input: HypergeometricInput): number | null {
  const { populationSize: N, successCount: K, sampleSize: n, minHits = 1 } = input;

  if (!isComputable(input) || !Number.isInteger(minHits)) return null;
  if (minHits <= 0) return 1;

  const maxHits = Math.min(K, n);
  if (minHits > maxHits) return 0;

  let total = 0;
  for (let hits = minHits; hits <= maxHits; hits += 1) {
    total += exactly({ populationSize: N, successCount: K, sampleSize: n, hits }) ?? 0;
  }

  // 부동소수 누적으로 1을 아주 조금 넘길 수 있다. 확률이 1을 넘지 않게 자른다.
  return Math.min(1, total);
}
