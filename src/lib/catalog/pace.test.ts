import { describe, expect, it } from "vitest";

import {
  canAfford,
  CONSECUTIVE_FAILURE_LIMIT,
  createPaceState,
  isRetryable,
  nextDelayMs,
  registerAttempt,
  registerUrlOutcome,
  retryBackoffMs,
  shouldContinue,
  type PaceState,
} from "./pace";

const baseState = (overrides: Partial<PaceState> = {}): PaceState => ({
  ...createPaceState({ maxRequests: 12, robotsStatus: 404 }),
  ...overrides,
});

/** 시도 1회 + URL 종료 1회를 한 번에 반영한다 — 재시도 없이 끝난 URL을 흉내낸다. */
const registerSingleAttemptUrl = (
  state: PaceState,
  outcome: { readonly status: number | null; readonly ok: boolean; readonly parsedRows?: number | null },
): PaceState => {
  const afterAttempt = registerAttempt(state, { status: outcome.status });
  return registerUrlOutcome(afterAttempt, { ok: outcome.ok, parsedRows: outcome.parsedRows });
};

describe("shouldContinue", () => {
  it("1. 초기 상태 → stop: false", () => {
    expect(shouldContinue(baseState())).toEqual({ stop: false, reason: null });
  });

  it("2. robotsStatus !== 404 → robots_changed", () => {
    const state = baseState({ robotsStatus: 200 });
    expect(shouldContinue(state)).toEqual({ stop: true, reason: "robots_changed" });
  });

  it("3. 403 수신 → forbidden (재시도 없이 즉시)", () => {
    const after = registerSingleAttemptUrl(baseState(), { status: 403, ok: false });
    expect(shouldContinue(after)).toEqual({ stop: true, reason: "forbidden" });
  });

  it("4. 429 수신 → rate_limited (재시도 없이 즉시)", () => {
    const after = registerSingleAttemptUrl(baseState(), { status: 429, ok: false });
    expect(shouldContinue(after)).toEqual({ stop: true, reason: "rate_limited" });
  });

  it("5. 연속 실패 2 → 계속", () => {
    let state = baseState();
    state = registerSingleAttemptUrl(state, { status: 500, ok: false });
    state = registerSingleAttemptUrl(state, { status: 500, ok: false });
    expect(state.consecutiveFailures).toBe(2);
    expect(shouldContinue(state)).toEqual({ stop: false, reason: null });
  });

  it("6. 연속 실패 3 → consecutive_failures", () => {
    let state = baseState();
    for (let i = 0; i < CONSECUTIVE_FAILURE_LIMIT; i += 1) {
      state = registerSingleAttemptUrl(state, { status: 500, ok: false });
    }
    expect(shouldContinue(state)).toEqual({ stop: true, reason: "consecutive_failures" });
  });

  it("7. 실패 2회 뒤 성공 → 카운터가 0으로 리셋된다", () => {
    let state = baseState();
    state = registerSingleAttemptUrl(state, { status: 500, ok: false });
    state = registerSingleAttemptUrl(state, { status: 500, ok: false });
    state = registerSingleAttemptUrl(state, { status: 200, ok: true, parsedRows: 20 });
    expect(state.consecutiveFailures).toBe(0);
    expect(shouldContinue(state)).toEqual({ stop: false, reason: null });
  });

  it("8. requestCount === maxRequests → max_requests", () => {
    let state = baseState({ maxRequests: 2 });
    state = registerSingleAttemptUrl(state, { status: 200, ok: true, parsedRows: 20 });
    state = registerSingleAttemptUrl(state, { status: 200, ok: true, parsedRows: 20 });
    expect(state.requestCount).toBe(2);
    expect(shouldContinue(state)).toEqual({ stop: true, reason: "max_requests" });
  });

  it("10. 파싱 0행 → parser_zero_rows", () => {
    const after = registerSingleAttemptUrl(baseState(), { status: 200, ok: true, parsedRows: 0 });
    expect(shouldContinue(after)).toEqual({ stop: true, reason: "parser_zero_rows" });
  });

  it("11. 판정 우선순위 — robots + 상한이 동시에 참이면 robots_changed가 이긴다", () => {
    const state = baseState({ robotsStatus: 200, requestCount: 12, maxRequests: 12 });
    expect(shouldContinue(state)).toEqual({ stop: true, reason: "robots_changed" });
  });
});

describe("canAfford", () => {
  it("9. 상한을 넘는 요청을 미리 막는다", () => {
    const state = baseState({ maxRequests: 5, requestCount: 5 });
    expect(canAfford(state)).toBe(false);
    expect(canAfford(baseState({ maxRequests: 5, requestCount: 4 }))).toBe(true);
    expect(canAfford(baseState({ maxRequests: 5, requestCount: 3 }), 2)).toBe(true);
    expect(canAfford(baseState({ maxRequests: 5, requestCount: 3 }), 3)).toBe(false);
  });
});

describe("isRetryable", () => {
  it("12. 500 ✅ · 503 ✅ · null(타임아웃) ✅ · 403 ❌ · 404 ❌ · 429 ❌", () => {
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(null)).toBe(true);
    expect(isRetryable(403)).toBe(false);
    expect(isRetryable(404)).toBe(false);
    expect(isRetryable(429)).toBe(false);
  });
});

describe("retryBackoffMs", () => {
  it("13. 1 → 10000 · 2 → 30000 · 3 → null(포기)", () => {
    expect(retryBackoffMs(1)).toBe(10000);
    expect(retryBackoffMs(2)).toBe(30000);
    expect(retryBackoffMs(3)).toBeNull();
  });
});

describe("nextDelayMs", () => {
  it("14. 경계 — rng 0 → 3000 · rng 1에 수렴 → 4000 미만", () => {
    expect(nextDelayMs(3000, 1000, () => 0)).toBe(3000);
    expect(nextDelayMs(3000, 1000, () => 0.999999)).toBeLessThan(4000);
    expect(nextDelayMs(3000, 1000, () => 0.999999)).toBeGreaterThan(3999);
  });
});

/**
 * 리뷰 결함 1 — `--max-requests` 상한이 재시도로 우회됐다. `registerAttempt`
 * (시도 단위)와 `registerUrlOutcome`(URL 단위)의 granularity가 실제로
 * 다르다는 것을, 그리고 「재시도까지 소진한 URL이 3개 연속」이 시도 3회와
 * 다르다는 것을 여기서 고정한다.
 */
describe("registerAttempt vs registerUrlOutcome — 결함 1: granularity가 다르다", () => {
  it("15. registerAttempt는 호출마다 requestCount를 늘린다 — 재시도 3회면 3", () => {
    let state = baseState();
    state = registerAttempt(state, { status: 500 });
    state = registerAttempt(state, { status: 500 });
    state = registerAttempt(state, { status: 500 });
    expect(state.requestCount).toBe(3);
  });

  it("16. registerUrlOutcome은 requestCount를 바꾸지 않는다 — URL 1개당 정확히 1회만 불린다", () => {
    let state = baseState();
    state = registerAttempt(state, { status: 500 });
    state = registerAttempt(state, { status: 500 });
    state = registerAttempt(state, { status: 500 });
    state = registerUrlOutcome(state, { ok: false });
    expect(state.requestCount).toBe(3);
  });

  it("17. 연속 실패 카운터는 URL 단위다 — 한 URL의 재시도 3회가 다 실패해도 실패 URL은 1개다", () => {
    let state = baseState();
    state = registerAttempt(state, { status: 500 });
    state = registerAttempt(state, { status: 500 });
    state = registerAttempt(state, { status: 500 });
    state = registerUrlOutcome(state, { ok: false });
    expect(state.consecutiveFailures).toBe(1);
    expect(shouldContinue(state)).toEqual({ stop: false, reason: null });
  });

  it("18. --max-requests 12는 재시도를 포함해 실제 시도 12건까지만 허용한다", () => {
    let state = baseState({ maxRequests: 12 });
    for (let i = 0; i < 12; i += 1) {
      expect(canAfford(state)).toBe(true);
      state = registerAttempt(state, { status: 500 });
    }
    // 셀렉터 1 + 페이지 8 + 여유 3(재시도분) = 12를 실제로 다 써버린 상태.
    expect(state.requestCount).toBe(12);
    expect(canAfford(state)).toBe(false);
  });

  it("19. 403은 시도 단계에서 즉시 halt한다 — URL 종료를 기다리지 않는다", () => {
    const after = registerAttempt(baseState(), { status: 403 });
    expect(shouldContinue(after)).toEqual({ stop: true, reason: "forbidden" });
  });
});
