/**
 * 원천 fetch와 그 실패 처리 (plan §3.5 「서킷 브레이커 · 원천 실패 처리」).
 *
 * 🚨 **네트워크를 타는 부분은 `fetch`를 주입으로 받는다.** 테스트가 원천에
 * 나가지 않게 하려는 것이고, 그것은 취향이 아니라 규율이다 — **테스트 실행이
 * 원천 부하가 되는 상태를 만들지 않는다**(§3.5 「테스트 전략」).
 */

import { checkFinalHost } from "@/lib/validation/card-image";

/** 마이그레이션 011의 `file_size_limit`과 **같은 값**이다. 숫자를 두 벌로 두지 않는다. */
export const UPSTREAM_MAX_BYTES = 5 * 1024 * 1024;

export const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * 연속 실패 임계. 🚨 §4.8 ⓔ의 배치 규율(N=3)보다 **크게** 잡는다.
 *
 * ⚠️ 근거 둘: ⓐ 08-31 실측에서 4회 중 500이 한 번 났다 ⓑ **배치와 달리
 * 여기서는 「중단」이 곧 서비스 중단이다.** 값을 크게 잡는 대신 "끝없이
 * 재시도하지 않는다"를 서킷이 보증한다.
 */
export const CIRCUIT_FAILURE_THRESHOLD = 5;

export const CIRCUIT_OPEN_MS = 5 * 60 * 1000;

// ─── 헤더 계약 (§3.5) ─────────────────────────────────────────────────────

/**
 * 원천으로 보내는 헤더 — **셋뿐이고, 없는 것이 더 중요하다.**
 *
 * 🚨 **`Referer`를 보내지 않는다.** 같은 원천을 쓰는 다른 서비스가
 * `Referer: https://pavilion-tcg.com/`을 붙이는 것을 08-31에 봤고, 우리는
 * 흉내 내지 않는다 — §9.4 ⓒ가 그은 선은 **헤더를 만들어 상대의 판단을
 * 흐리지 않는다**이다.
 *
 * 🚨 **브라우저 UA를 흉내 내지 않는다.** 우리가 누구인지 적는다. 연락처를
 * 넣으면 **상대가 멈추라고 말할 수 있는 유일한 경로**가 생긴다(§4.8 ⓔ) —
 * 넣을지는 사용자 몫이라 환경변수로 받고, 없으면 이름만 보낸다.
 * `scripts/collect-catalog.ts`가 쓰는 형식과 같은 모양이다.
 */
export function upstreamUserAgent(contact: string | undefined | null): string {
  const trimmed = contact?.trim();

  return trimmed ? `DeckBinder-ImageProxy/0.1 (${trimmed})` : "DeckBinder-ImageProxy/0.1";
}

export function upstreamHeaders(contact: string | undefined | null): Record<string, string> {
  return {
    "User-Agent": upstreamUserAgent(contact),
    "Accept-Language": "ko",
    Accept: "image/*",
  };
}

// ─── 서킷 브레이커 — 순수 상태 전이 ────────────────────────────────────────

export interface CircuitState {
  readonly failures: number;
  /** epoch ms. 열려 있지 않으면 null. */
  readonly openedAt: number | null;
}

export const CIRCUIT_CLOSED: CircuitState = { failures: 0, openedAt: null };

export function circuitIsOpen(state: CircuitState, now: number): boolean {
  if (state.openedAt === null) return false;

  return now - state.openedAt < CIRCUIT_OPEN_MS;
}

export function recordUpstreamFailure(state: CircuitState, now: number): CircuitState {
  const failures = state.failures + 1;

  return failures >= CIRCUIT_FAILURE_THRESHOLD
    ? { failures, openedAt: now }
    : { failures, openedAt: state.openedAt };
}

/** 🚨 성공하면 카운터가 0으로 돌아간다 — "연속" 실패여야 서킷이 열린다. */
export function recordUpstreamSuccess(): CircuitState {
  return CIRCUIT_CLOSED;
}

// ─── fetch ────────────────────────────────────────────────────────────────

/**
 * 6단계(fetch)의 결과. 🚨 **본문을 아직 읽지 않았다.**
 *
 * ⚠️ 본문 읽기를 분리한 이유 둘: ⓐ **7단계(`checkFinalHost`)가 본문을 읽기
 * *전에* 서야 한다** — 승인 밖 호스트에서 5MB를 받아 놓고 나서 거부하는 것은
 * 방어가 아니다 ⓑ 그래야 9단계가 **테스트에서 실제로 갈린다.** 한 함수가
 * 6·7단계를 함께 하면 순서 단언이 주석과 다를 바 없어진다(§8 T1.30 ⓐ).
 */
export type UpstreamOutcome =
  | { readonly kind: "ok"; readonly response: Response; readonly finalUrl: string }
  /** 403 · 429. 🚨 킬 스위치가 자동으로 켜지는 유일한 입력이다. */
  | { readonly kind: "blocked"; readonly status: number }
  /** 3xx. 따라가지 않는다. */
  | { readonly kind: "redirected"; readonly location: string | null }
  | { readonly kind: "server_error"; readonly status: number }
  | { readonly kind: "client_error"; readonly status: number }
  | { readonly kind: "declared_too_large"; readonly bytes: number }
  | { readonly kind: "timeout" }
  | { readonly kind: "network_error" };

export type BodyOutcome =
  | { readonly kind: "ok"; readonly bytes: Uint8Array }
  | { readonly kind: "too_large"; readonly bytes: number }
  | { readonly kind: "network_error" };

export interface FetchUpstreamOptions {
  readonly fetchImpl: typeof fetch;
  readonly contact?: string | null;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

/**
 * 원천에서 바이트를 가져온다.
 *
 * 🚨 **재시도하지 않는다.** 배치와 결정적으로 다른 자리다 — 사용자가 화면
 * 앞에 있고 **브라우저가 이미 재시도 주체다**(`<img>` 재요청 · 새로고침).
 * 워커가 또 재시도하면 원천이 받는 부하가 곱해진다.
 *
 * 🚨 **`redirect: "manual"`이다.** 프록시는 요청마다 도는데 리다이렉트를
 * 따라가면 **매 요청이 화이트리스트 밖으로 나갈 기회를 갖는다.** 그래도
 * `checkFinalHost()`는 부른다 — 방어를 두 겹으로 둔다.
 */
export async function fetchUpstream(
  url: string,
  options: FetchUpstreamOptions,
): Promise<UpstreamOutcome> {
  const {
    fetchImpl,
    contact,
    timeoutMs = UPSTREAM_TIMEOUT_MS,
    maxBytes = UPSTREAM_MAX_BYTES,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      headers: upstreamHeaders(contact),
      signal: controller.signal,
    });

    if (response.status === 403 || response.status === 429) {
      return { kind: "blocked", status: response.status };
    }
    if (response.status >= 300 && response.status < 400) {
      return { kind: "redirected", location: response.headers.get("location") };
    }
    if (response.status >= 500) {
      return { kind: "server_error", status: response.status };
    }
    if (response.status >= 400) {
      return { kind: "client_error", status: response.status };
    }

    // 🚨 Content-Length는 **의견이다.** 여기서 거르는 것은 "명백히 큰 것"을
    //    본문도 읽지 않고 끊기 위해서이고, 실제 크기는 본문을 읽으며 다시 센다.
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { kind: "declared_too_large", bytes: declared };
    }

    return { kind: "ok", response, finalUrl: response.url || url };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "timeout" };
    }
    return { kind: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 7단계를 통과한 응답의 본문을 읽는다.
 *
 * 🚨 **`checkFinalHost()` 뒤에만 부른다.** 이 함수가 `upstream.ts`에서 유일하게
 * 바이트를 만지는 자리이고, 그 앞에 호스트 판정이 서 있는 것이 계약이다.
 */
export async function readUpstreamBody(
  response: Response,
  maxBytes: number = UPSTREAM_MAX_BYTES,
): Promise<BodyOutcome> {
  try {
    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > maxBytes) {
      return { kind: "too_large", bytes: buffer.byteLength };
    }

    return { kind: "ok", bytes: new Uint8Array(buffer) };
  } catch {
    return { kind: "network_error" };
  }
}

/**
 * 7단계 — **승인한 것은 출발지이지 도착지가 아니다** (T1.20 ⓑ-3의 문장 그대로).
 *
 * 리다이렉트를 따라가지 않으므로(`redirect: "manual"`) 실무에서 이 검사가
 * 걸릴 일은 드물다. 🚨 **그래도 부른다 — 방어를 두 겹으로 둔다.**
 */
export function finalHostAllowed(
  requestedUrl: string,
  finalUrl: string,
  allowlist: readonly string[],
): { readonly ok: boolean; readonly finalHost: string | null } {
  const check = checkFinalHost(requestedUrl, finalUrl, allowlist);

  return { ok: check.ok, finalHost: check.finalHost };
}
