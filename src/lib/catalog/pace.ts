/**
 * 부하 규율 상태 기계 — plan §4.8 ⓘ가 「가장 중요하다」고 적은 자리, ⓚ-1.
 *
 * **기다리지 않는다.** `setTimeout`을 부르지 않고 밀리초를 계산해 돌려줄
 * 뿐이다 — 잠드는 것은 `scripts/collect-catalog.ts`의 일이다.
 *
 * 순수 함수만 있다. 「연속 3회 실패에 멈춘다」 같은 규율은 실제로 상대
 * 서버를 3번 실패시켜 볼 수 없으므로, 문서가 아니라 이 파일의 테스트가
 * 증명한다(§4.8 ⓘ).
 */

import type { CollectStopReason } from "./types";

/** robots.txt가 404가 아니면 원천이 처음으로 말을 한 것이다(plan §4.8 ⓔ). */
export const ROBOTS_EXPECTED_STATUS = 404;

/** 재시도까지 소진한 URL이 연속 이 횟수면 중단한다(plan §4.8 ⓔ). */
export const CONSECUTIVE_FAILURE_LIMIT = 3;

/**
 * 즉시 전체 중단으로 이어지는 사유. `registerAttempt`·`registerUrlOutcome`이
 * 한 번 세우면 이후 결과와 무관하게 유지된다 — 취소되지 않는다.
 */
type HaltReason = Extract<CollectStopReason, "forbidden" | "rate_limited" | "parser_zero_rows">;

export interface PaceState {
  readonly requestCount: number;
  readonly maxRequests: number;
  readonly consecutiveFailures: number;
  /** 실행 시작에 1회 확인한 robots.txt 상태 코드. */
  readonly robotsStatus: number;
  readonly halted: HaltReason | null;
}

export function createPaceState(params: {
  readonly maxRequests: number;
  readonly robotsStatus: number;
}): PaceState {
  return {
    requestCount: 0,
    maxRequests: params.maxRequests,
    consecutiveFailures: 0,
    robotsStatus: params.robotsStatus,
    halted: null,
  };
}

export interface ContinueDecision {
  readonly stop: boolean;
  readonly reason: CollectStopReason | null;
}

/**
 * 계속할지 판정한다. **판정 우선순위** — robots_changed가 그 밖의 모든
 * 사유를 이긴다(plan §4.8 ⓘ pace.test.ts #11).
 */
export function shouldContinue(state: PaceState): ContinueDecision {
  if (state.robotsStatus !== ROBOTS_EXPECTED_STATUS) {
    return { stop: true, reason: "robots_changed" };
  }
  if (state.halted !== null) {
    return { stop: true, reason: state.halted };
  }
  if (state.consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
    return { stop: true, reason: "consecutive_failures" };
  }
  if (state.requestCount >= state.maxRequests) {
    return { stop: true, reason: "max_requests" };
  }
  return { stop: false, reason: null };
}

/**
 * 앞으로 `additionalRequests`개를 더 보내도 상한을 넘지 않는지 **미리**
 * 확인한다 — 초과 상태 자체가 만들어지지 않게 한다.
 */
export function canAfford(state: PaceState, additionalRequests = 1): boolean {
  return state.requestCount + additionalRequests <= state.maxRequests;
}

/**
 * 실제 HTTP 시도 1건(재시도 포함)의 결과.
 *
 * 🚨 **granularity — 이 함수는 시도 단위다.** `fetchWithRetry`가 같은 URL에
 * 5xx·타임아웃으로 재시도하면 시도마다 이 함수를 부른다. `requestCount`
 * (`--max-requests` 상한)가 재시도로 과소 계상되는 결함(리뷰 결함 1)의
 * 수정 지점이 여기다 — 「논리 URL 1건 = 시도 1건」이라는 잘못된 가정을
 * 깨고, 재시도 전에도 `canAfford`로 예산을 확인할 수 있게 상태를 시도마다
 * 갱신한다.
 */
export interface AttemptOutcome {
  /** HTTP 상태 코드. `null` = 네트워크 실패·타임아웃. */
  readonly status: number | null;
}

/**
 * 시도 1건을 반영한다. `requestCount`를 늘리고, 403·429면 재시도 없이 즉시
 * `halted`를 세운다(plan §4.8 ⓔ). **`consecutiveFailures`는 건드리지 않는다**
 * — 그것은 논리 URL 단위이고 `registerUrlOutcome`의 일이다.
 */
export function registerAttempt(state: PaceState, outcome: AttemptOutcome): PaceState {
  const requestCount = state.requestCount + 1;

  let halted = state.halted;
  if (halted === null && outcome.status === 403) {
    halted = "forbidden";
  } else if (halted === null && outcome.status === 429) {
    halted = "rate_limited";
  }

  return { ...state, requestCount, halted };
}

/**
 * 논리 URL 1건(재시도까지 전부 소진한 뒤)의 최종 결과.
 *
 * 🚨 **granularity — 이 함수는 URL 단위다.** 한 URL에 시도를 몇 번
 * 했든(재시도 포함) 호출은 **정확히 한 번**이어야 한다. plan §4.8 ⓔ의
 * 「재시도까지 소진한 URL이 3개 연속이면 중단한다」를 그대로 옮긴 것이다
 * — 시도 단위로 세면 한 URL의 재시도 3회만으로 중단돼 규칙이 바뀐다.
 */
export interface UrlOutcome {
  /** 재시도까지 소진한 뒤의 최종 성공 여부. */
  readonly ok: boolean;
  /** 목록 페이지 요청일 때 파싱된 행 수. 목록 요청이 아니면 `null`. */
  readonly parsedRows?: number | null;
}

/**
 * URL 1건의 최종 결과를 반영한다. 새 상태를 돌려줄 뿐 기존 상태를 바꾸지 않는다.
 *
 * - 파싱 0행이면 `halted`를 세운다 — 상태 코드로는 잡히지 않는 「수집 성공,
 *   0장」에 대한 유일한 자동 장치다(§4.8 ⓘ).
 * - 성공하면 연속 실패 카운터가 0으로 리셋된다. 실패하면 URL 단위로 1 늘어난다
 *   — 그 URL이 몇 번 재시도됐는지는 반영하지 않는다.
 */
export function registerUrlOutcome(state: PaceState, outcome: UrlOutcome): PaceState {
  let halted = state.halted;
  if (halted === null && outcome.parsedRows === 0) {
    halted = "parser_zero_rows";
  }

  const consecutiveFailures = outcome.ok ? 0 : state.consecutiveFailures + 1;

  return { ...state, consecutiveFailures, halted };
}

/** 5xx·타임아웃만 재시도한다. 4xx는 다시 받아도 같다(plan §4.8 ⓔ). */
export function isRetryable(status: number | null): boolean {
  if (status === null) {
    return true;
  }
  return status >= 500 && status < 600;
}

/** 같은 URL 최대 2회, 백오프 10초 → 30초. 3회째는 포기한다(plan §4.8 ⓔ). */
export function retryBackoffMs(attempt: number): number | null {
  if (attempt === 1) {
    return 10000;
  }
  if (attempt === 2) {
    return 30000;
  }
  return null;
}

/**
 * 다음 요청까지 대기할 밀리초. `rng()`는 `[0, 1)` 범위를 돌려줘야 한다
 * (기본값 `Math.random`). 지터가 규칙적인 간격을 흩어 패턴으로 뭉치는
 * 것을 막는다(plan §4.8 ⓔ).
 */
export function nextDelayMs(delayMs: number, jitterMs: number, rng: () => number = Math.random): number {
  return delayMs + rng() * jitterMs;
}
