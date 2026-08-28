/** [0, 1)을 내는 난수원. 시뮬레이터는 `Math.random`을 직접 부르지 않는다. */
export type Rng = () => number;

/**
 * 시드 기반 PRNG (mulberry32).
 *
 * 순수 함수 계약을 지키면서 **재현 가능한 손패**를 만들기 위한 것이다 —
 * 같은 시드로 같은 결과가 나와야 테스트가 flaky해지지 않고, 화면에서도
 * "이 손패를 다시 보여 줘"가 성립한다.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Fisher-Yates. **입력을 바꾸지 않고 새 배열을 낸다.** */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
