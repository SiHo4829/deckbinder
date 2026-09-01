/**
 * `GET /img/:source/:id` — **유일한 공개 라우트** (plan §3.5).
 *
 * 🚨 **이 파일이 요청 처리 순서 9단계를 고정한다. 순서가 곧 설계다.**
 * 각 단계를 왜 그 자리에 두었는지는 `IMAGE_REQUEST_STEPS` 주석에 있고,
 * **순서를 테스트가 단언한다 — 주석으로 두지 않는다**(§8 T1.30 ⓐ).
 * `purge.ts`의 `purgeSteps()`가 세운 형식과 같되, 여기서는 정적 목록이
 * 아니라 **실제로 밟은 자취**를 돌려준다.
 */

import {
  downnameFormat,
  decideHost,
  isValidDownname,
  sniffImageFormat,
} from "@/lib/validation/card-image";

import {
  RESPONSE_CACHE_CONTROL,
  cacheKeyRequest,
  mimeForFormat,
  type CacheLike,
} from "../lib/cache";
import {
  readKillState,
  tripKillSwitch,
  type KillSwitchStore,
} from "../lib/kill-switch";
import type { RateLimiter } from "../lib/rate-limit";
import { hashIp } from "../lib/rate-limit";
import { sourceDefinition } from "../lib/sources";
import {
  CIRCUIT_CLOSED,
  circuitIsOpen,
  fetchUpstream,
  finalHostAllowed,
  readUpstreamBody,
  recordUpstreamFailure,
  recordUpstreamSuccess,
  type CircuitState,
} from "../lib/upstream";

/**
 * 🚨 **바꾸면 무엇이 깨지는지 각 줄에 적는다** (§3.5의 표를 코드로 옮긴 것).
 *
 * | 단계 | 어기면 |
 * |---|---|
 * | 1 `kill_switch`  | **캐시보다 뒤에 두면 회수가 무력해진다.** §9.4 ⓖ-4 전체가 이 한 줄 위에 선다 |
 * | 2 `validate`     | 형식이 어긋난 것이 캐시 키가 되면 **캐시가 오염된다** |
 * | 3 `rate_limit`   | **캐시 조회보다 앞이다.** 뒤면 캐시 히트가 무제한이 되어 우리 한도를 남이 태운다 |
 * | 4 `cache_lookup` | — |
 * | 5 `circuit`      | 없으면 원천이 아플 때 **우리가 더 때린다** |
 * | 6 `upstream`     | — |
 * | 7 `final_host`   | **승인한 것은 출발지이지 도착지가 아니다** |
 * | 8 `sniff_format` | 하드코딩하면 pavilion이 낸 것과 **정확히 같은 실수**다 |
 * | 9 `cache_put`    | — |
 */
export const IMAGE_REQUEST_STEPS = [
  "kill_switch",
  "validate",
  "rate_limit",
  "cache_lookup",
  "circuit",
  "upstream",
  "final_host",
  "sniff_format",
  "cache_put",
] as const;

export type ImageRequestStep = (typeof IMAGE_REQUEST_STEPS)[number];

export function stepIndex(step: ImageRequestStep): number {
  return IMAGE_REQUEST_STEPS.indexOf(step);
}

/** 서킷 상태를 어디에 두든 이 모양으로 읽고 쓴다. */
export interface CircuitBox {
  read(): CircuitState;
  write(state: CircuitState): void;
}

/**
 * 형식 불일치 카운터 (§3.5 「네 번째 형식을 조용히 만나지 않는다」).
 *
 * 🚨 **거부만 하고 세지 않으면 다음 교체가 "이미지 몇 장이 안 뜬다"로만
 * 보이고 원인에 닿는 데 오래 걸린다.** 원천은 2024년 이후 downname 형식을
 * 두 번 갈아치웠고 마지막 교체가 2026-04다 — 네 번째가 온다고 보고 센다.
 *
 * ⚠️ **자동으로 형식을 넓히지 않는다.** 그것은 릴레이 표면을 코드가 제 손으로
 * 넓히는 일이다. 사람이 §3.5를 고친다.
 */
export interface MismatchRecorder {
  record(downname: string): void;
}

export interface ImageRequestDeps {
  readonly killSwitch: KillSwitchStore;
  readonly rateLimiter: RateLimiter;
  readonly cache: CacheLike;
  readonly circuit: CircuitBox;
  readonly mismatch: MismatchRecorder;
  readonly fetchImpl: typeof fetch;
  readonly allowlist: readonly string[];
  readonly ipSalt: string | undefined | null;
  readonly contact?: string | null;
  readonly clientIp: string;
  /** 캐시 키를 만들 origin. 요청 URL의 origin을 그대로 쓴다. */
  readonly origin: string;
  readonly now: () => Date;
}

export interface ImageRequestResult {
  readonly response: Response;
  /** 🚨 실제로 밟은 단계. 테스트가 이 배열의 순서를 단언한다. */
  readonly steps: readonly ImageRequestStep[];
}

function refuse(status: number, steps: ImageRequestStep[]): ImageRequestResult {
  // 🚨 본문을 붙이지 않는다. 이 워커가 내보내는 것은 이미지 바이트뿐이고,
  //    에러 본문은 원천의 사정을 바깥에 흘리는 통로가 된다.
  return { response: new Response(null, { status }), steps };
}

export async function handleImageRequest(
  params: { readonly source: string; readonly downname: string },
  deps: ImageRequestDeps,
): Promise<ImageRequestResult> {
  const steps: ImageRequestStep[] = [];
  const { source, downname } = params;

  // ── 1. 킬 스위치 ────────────────────────────────────────────────────────
  // 🚨 캐시보다 앞이다. 이 순서가 "회수 = 라우트 끄기"를 성립시킨다.
  steps.push("kill_switch");
  const kill = await readKillState(deps.killSwitch);
  if (kill.killed) {
    // 404다. 503이 아니다 — 503은 "곧 돌아온다"는 뜻이고 회수는 그런 상태가 아니다.
    return refuse(404, steps);
  }

  // ── 2. 검증 ─────────────────────────────────────────────────────────────
  steps.push("validate");
  const definition = sourceDefinition(source);
  if (definition === null) {
    return refuse(404, steps);
  }
  if (!isValidDownname(downname)) {
    deps.mismatch.record(downname);
    return refuse(400, steps);
  }

  const upstreamUrl = definition.buildUrl(downname);

  // 겹 1 — 빈 화이트리스트는 "전부 허용"이 아니라 "전부 거부"다.
  const hostDecision = decideHost(upstreamUrl, deps.allowlist);
  if (!hostDecision.allowed) {
    return refuse(404, steps);
  }

  // ── 3. 레이트리밋 (겹 3) ────────────────────────────────────────────────
  // 🚨 캐시 조회보다 앞이다. 뒤에 두면 캐시 히트가 무제한이 된다.
  steps.push("rate_limit");
  const clientKey = await hashIp(deps.clientIp, deps.ipSalt);
  if (clientKey === null) {
    // 솔트가 없으면 모든 IP가 한 카운터를 공유한다. 통과시키지 않는다.
    return refuse(503, steps);
  }
  const verdict = await deps.rateLimiter.check(clientKey);
  if (!verdict.allowed) {
    return refuse(429, steps);
  }

  // ── 4. 캐시 조회 ────────────────────────────────────────────────────────
  steps.push("cache_lookup");
  const cacheKey = cacheKeyRequest(deps.origin, source, downname);
  const cached = await deps.cache.match(cacheKey);
  if (cached) {
    return { response: cached, steps };
  }

  // ── 5. 서킷 브레이커 ────────────────────────────────────────────────────
  steps.push("circuit");
  const nowMs = deps.now().getTime();
  if (circuitIsOpen(deps.circuit.read(), nowMs)) {
    // 여기서는 503이 맞다 — 실제로 곧 돌아온다(T분 뒤).
    return refuse(503, steps);
  }

  // ── 6. 원천 fetch ───────────────────────────────────────────────────────
  steps.push("upstream");
  const outcome = await fetchUpstream(upstreamUrl, {
    fetchImpl: deps.fetchImpl,
    contact: deps.contact,
  });

  if (outcome.kind === "blocked") {
    // 🚨 403은 상대가 처음으로 말을 한 것이다 (§4.8 ⓔ). 킬 스위치가 켜지고
    //    사람이 읽을 때까지 자동으로 꺼지지 않는다.
    await tripKillSwitch(
      deps.killSwitch,
      outcome.status === 403 ? "upstream_403" : "upstream_429",
      deps.now(),
    );
    return refuse(404, steps);
  }

  if (outcome.kind !== "ok") {
    // 🚨 5xx·타임아웃·네트워크 오류만 서킷을 민다. 3xx와 4xx는 원천이
    //    아프다는 신호가 아니라 이 요청이 잘못됐다는 신호다.
    if (
      outcome.kind === "server_error" ||
      outcome.kind === "timeout" ||
      outcome.kind === "network_error"
    ) {
      deps.circuit.write(recordUpstreamFailure(deps.circuit.read(), nowMs));
    }

    // 원천이 404면 그 이미지가 없는 것이다. 502로 덮으면 원인이 흐려진다.
    const status = outcome.kind === "client_error" && outcome.status === 404 ? 404 : 502;
    return refuse(status, steps);
  }

  // ── 7. 최종 호스트 ──────────────────────────────────────────────────────
  // 🚨 본문을 읽기 **전이다.** 승인 밖 호스트에서 5MB를 받아 놓고 거부하는
  //    것은 방어가 아니다.
  steps.push("final_host");
  if (!finalHostAllowed(upstreamUrl, outcome.finalUrl, deps.allowlist).ok) {
    return refuse(502, steps);
  }

  const body = await readUpstreamBody(outcome.response);
  if (body.kind !== "ok") {
    return refuse(502, steps);
  }

  // ── 8. 포맷 판정 ────────────────────────────────────────────────────────
  // 🚨 헤더는 의견이고 매직 바이트는 관측이다. 원천은 Content-Type을 아예
  //    보내지 않고, 같은 원천을 쓰는 다른 서비스는 PNG에 image/webp를 붙였다.
  steps.push("sniff_format");
  const format = sniffImageFormat(body.bytes);
  const mime = format === null ? null : mimeForFormat(format);
  if (mime === null) {
    // 이미지가 아닌 것을 이미지라고 라벨해 내보내지 않는다. 캐시에도 넣지 않는다.
    // (그 사이트는 404 본문이 20,615바이트짜리 HTML이다 — §4.8 ⓔ)
    deps.circuit.write(recordUpstreamFailure(deps.circuit.read(), nowMs));
    return refuse(502, steps);
  }

  deps.circuit.write(recordUpstreamSuccess());

  const response = new Response(body.bytes, {
    status: 200,
    headers: {
      // 🚨 원천 응답 헤더를 그대로 전달하지 않는다. 넷만 우리가 만들어 붙인다.
      //    원천의 `Cache-Control: private, ..., immutable`을 흘리면 private이
      //    캐시를 깨거나 immutable이 회수를 막는다.
      "Content-Type": mime,
      "Content-Length": String(body.bytes.byteLength),
      "Cache-Control": RESPONSE_CACHE_CONTROL,
      "X-Downname-Format": downnameFormat(downname) ?? "unknown",
    },
  });

  // ── 9. 캐시에 넣는다 ────────────────────────────────────────────────────
  steps.push("cache_put");
  await deps.cache.put(cacheKey, response.clone());

  return { response, steps };
}

export { CIRCUIT_CLOSED };
