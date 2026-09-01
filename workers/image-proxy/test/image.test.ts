import { beforeEach, describe, expect, it } from "vitest";

import { CIRCUIT_CLOSED, CIRCUIT_FAILURE_THRESHOLD, type CircuitState } from "../src/lib/upstream";
import {
  IMAGE_REQUEST_STEPS,
  handleImageRequest,
  type ImageRequestDeps,
  type ImageRequestStep,
} from "../src/routes/image";
import {
  ALLOWED_HOSTS,
  DOWNNAME_A,
  DOWNNAME_B,
  DOWNNAME_C,
  HTML_BYTES,
  PNG_BYTES,
  WEBP_BYTES,
  memoryCache,
  memoryKv,
  stubFetch,
} from "./fixtures";

const ORIGIN = "https://img.example";

function ok(bytes: Uint8Array, headers: Record<string, string> = {}): Response {
  return new Response(bytes, { status: 200, headers });
}

interface Harness {
  deps: ImageRequestDeps;
  kv: ReturnType<typeof memoryKv>;
  cache: ReturnType<typeof memoryCache>;
  calls: { url: string; init?: RequestInit }[];
  circuit: { state: CircuitState };
  mismatches: string[];
}

function harness(
  responder: (url: string) => Response | Promise<Response> = () => ok(PNG_BYTES),
  overrides: Partial<ImageRequestDeps> = {},
): Harness {
  const kv = memoryKv();
  const cache = memoryCache();
  const { impl, calls } = stubFetch(responder);
  const circuit = { state: CIRCUIT_CLOSED };
  const mismatches: string[] = [];

  const deps: ImageRequestDeps = {
    killSwitch: kv,
    rateLimiter: { async check() { return { allowed: true, reason: "ok" }; } },
    cache,
    circuit: {
      read: () => circuit.state,
      write: (next) => {
        circuit.state = next;
      },
    },
    mismatch: { record: (value) => mismatches.push(value) },
    fetchImpl: impl,
    allowlist: ALLOWED_HOSTS,
    ipSalt: "test-salt",
    contact: null,
    clientIp: "203.0.113.7",
    origin: ORIGIN,
    now: () => new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };

  return { deps, kv, cache, calls, circuit, mismatches };
}

function call(h: Harness, downname = DOWNNAME_C, source = "opcg-kr") {
  return handleImageRequest({ source, downname }, h.deps);
}

/**
 * 🚨 이 프로젝트에서 가장 중요한 단언이다.
 *
 * 밟은 단계는 **언제나 계약 순서의 앞부분(prefix)**이어야 한다. 어느 단계가
 * 앞당겨지거나 건너뛰어지면 이 한 줄이 깨진다 — §3.5의 "순서가 곧 설계다"를
 * 주석이 아니라 테스트로 들고 있는 자리다(§8 T1.30 ⓐ).
 */
function expectStepPrefix(steps: readonly ImageRequestStep[]): void {
  expect(steps).toEqual(IMAGE_REQUEST_STEPS.slice(0, steps.length));
}

describe("9단계 순서 (plan §3.5)", () => {
  it("정상 경로는 아홉 단계를 그 순서로 밟는다", async () => {
    const h = harness();
    const { steps, response } = await call(h);

    expect(steps).toEqual(IMAGE_REQUEST_STEPS);
    expect(response.status).toBe(200);
  });

  it("어느 경로에서 멈추든 밟은 단계는 계약 순서의 앞부분이다", async () => {
    const scenarios: (() => Promise<readonly ImageRequestStep[]>)[] = [
      async () => (await call(harness())).steps,
      async () => (await call(harness(), "형식이-아니다")).steps,
      async () => (await call(harness(), DOWNNAME_C, "없는-원천")).steps,
      async () => (await call(harness(() => new Response(null, { status: 500 })))).steps,
      async () => (await call(harness(() => new Response(null, { status: 403 })))).steps,
      async () => (await call(harness(() => ok(HTML_BYTES)))).steps,
      async () =>
        (
          await call(
            harness(undefined, {
              rateLimiter: { async check() { return { allowed: false, reason: "per_minute" }; } },
            }),
          )
        ).steps,
    ];

    for (const scenario of scenarios) {
      expectStepPrefix(await scenario());
    }
  });
});

describe("1단계 — 킬 스위치 (회수의 본체)", () => {
  it("켜져 있으면 캐시도 원천도 건드리지 않고 404다", async () => {
    const h = harness();
    await h.kv.put("image-proxy:kill", "on");

    const { steps, response } = await call(h);

    expect(steps).toEqual(["kill_switch"]);
    expect(response.status).toBe(404);
    // 🚨 캐시 조회보다 앞이라는 것의 증거 — 원천 요청 0회.
    expect(h.calls).toHaveLength(0);
  });

  it("503이 아니라 404다", async () => {
    const h = harness();
    await h.kv.put("image-proxy:kill", "on");

    // 503은 "곧 돌아온다"는 뜻이고 회수는 그런 상태가 아니다 (§3.5).
    expect((await call(h)).response.status).not.toBe(503);
  });

  it("캐시에 이미 있어도 킬 스위치가 이긴다", async () => {
    const h = harness();
    await call(h);
    expect(h.cache.map.size).toBe(1);

    await h.kv.put("image-proxy:kill", "on");

    const { response, steps } = await call(h);
    expect(response.status).toBe(404);
    expect(steps).toEqual(["kill_switch"]);
  });
});

describe("2단계 — 검증 (겹 1 · 겹 2)", () => {
  it("실측된 세 형식을 전부 통과시킨다", async () => {
    for (const downname of [DOWNNAME_A, DOWNNAME_B, DOWNNAME_C]) {
      const h = harness();
      expect((await call(h, downname)).response.status).toBe(200);
    }
  });

  it("형식 밖은 400이고 세어서 드러낸다", async () => {
    const h = harness();
    const { response, steps } = await call(h, "20260720_133222_XYZ");

    expect(response.status).toBe(400);
    expect(steps).toEqual(["kill_switch", "validate"]);
    // 거부만 하고 세지 않으면 다음 형식 교체가 "몇 장이 안 뜬다"로만 보인다.
    expect(h.mismatches).toEqual(["20260720_133222_XYZ"]);
    expect(h.calls).toHaveLength(0);
  });

  it("모르는 원천은 404이고 원천 목록을 알려 주지 않는다", async () => {
    const h = harness();
    const { response } = await call(h, DOWNNAME_C, "opcg");

    // 🚨 로컬 라벨 `opcg`가 아니라 `opcg-kr`이 권위 있는 식별자다 (마이그레이션 010).
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("겹 1 — 빈 화이트리스트는 전부 허용이 아니라 전부 거부다", async () => {
    const h = harness(undefined, { allowlist: [] });
    const { response } = await call(h);

    expect(response.status).toBe(404);
    expect(h.calls).toHaveLength(0);
  });
});

describe("3단계 — 레이트리밋 (겹 3)", () => {
  it("캐시 조회보다 앞이다 — 거부되면 캐시를 보지 않는다", async () => {
    const h = harness(undefined, {
      rateLimiter: { async check() { return { allowed: false, reason: "per_minute" }; } },
    });
    const { steps, response } = await call(h);

    expect(response.status).toBe(429);
    expect(steps).toEqual(["kill_switch", "validate", "rate_limit"]);
  });

  it("솔트가 없으면 통과시키지 않는다", async () => {
    const h = harness(undefined, { ipSalt: undefined });
    const { response } = await call(h);

    // 솔트가 없으면 모든 IP가 한 카운터를 공유한다 — 그것은 겹 3이 없는 것과 같다.
    expect(response.status).toBe(503);
    expect(h.calls).toHaveLength(0);
  });
});

describe("4단계 — 캐시", () => {
  it("두 번째 요청은 원천에 가지 않는다", async () => {
    const h = harness();

    await call(h);
    expect(h.calls).toHaveLength(1);

    const second = await call(h);
    expect(second.response.status).toBe(200);
    expect(h.calls).toHaveLength(1);
    expect(second.steps).toEqual(["kill_switch", "validate", "rate_limit", "cache_lookup"]);
  });

  it("이미지가 아닌 응답은 캐시에 넣지 않는다", async () => {
    const h = harness(() => ok(HTML_BYTES));

    const { response, steps } = await call(h);

    expect(response.status).toBe(502);
    expect(steps).toEqual([
      "kill_switch",
      "validate",
      "rate_limit",
      "cache_lookup",
      "circuit",
      "upstream",
      "final_host",
      "sniff_format",
    ]);
    expect(h.cache.map.size).toBe(0);
  });
});

describe("5단계 — 서킷 브레이커", () => {
  it("연속 실패가 임계를 넘으면 원천에 가지 않는다", async () => {
    const h = harness(() => new Response(null, { status: 500 }));

    for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i += 1) {
      // 캐시가 안 채워지므로 매번 원천까지 간다.
      expect((await call(h, DOWNNAME_C)).response.status).toBe(502);
    }
    expect(h.calls).toHaveLength(CIRCUIT_FAILURE_THRESHOLD);

    const blocked = await call(h);
    expect(blocked.response.status).toBe(503);
    expect(blocked.steps.at(-1)).toBe("circuit");
    // 🚨 원천 요청이 더 늘지 않았다 — "원천이 아플 때 우리가 더 때린다"를 막은 것.
    expect(h.calls).toHaveLength(CIRCUIT_FAILURE_THRESHOLD);
  });

  it("4xx는 서킷을 밀지 않는다 — 원천이 아프다는 신호가 아니다", async () => {
    const h = harness(() => new Response(null, { status: 404 }));

    for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD + 2; i += 1) {
      expect((await call(h)).response.status).toBe(404);
    }

    expect(h.circuit.state.failures).toBe(0);
  });
});

describe("6단계 — 원천 요청의 헤더 계약", () => {
  it("Referer를 보내지 않는다", async () => {
    const h = harness();
    await call(h);

    const headers = h.calls[0].init?.headers as Record<string, string>;
    // 🚨 같은 원천을 쓰는 다른 서비스의 Referer를 흉내 내지 않는다 (§9.4 ⓒ).
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("referer");
  });

  it("브라우저를 흉내 내지 않고 우리가 누구인지 적는다", async () => {
    const h = harness();
    await call(h);

    const headers = h.calls[0].init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("DeckBinder-ImageProxy/0.1");
    expect(headers["Accept-Language"]).toBe("ko");
  });

  it("연락처가 있으면 UA에 붙는다", async () => {
    const h = harness(undefined, { contact: "https://deckbinder.example/contact" });
    await call(h);

    const headers = h.calls[0].init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(
      "DeckBinder-ImageProxy/0.1 (https://deckbinder.example/contact)",
    );
  });

  it("리다이렉트를 따라가지 않는다", async () => {
    const h = harness(() => new Response(null, { status: 302, headers: { location: "https://elsewhere.example/x" } }));
    const { response } = await call(h);

    expect(h.calls[0].init?.redirect).toBe("manual");
    expect(response.status).toBe(502);
    // 리다이렉트 대상으로 두 번째 요청이 나가지 않았다.
    expect(h.calls).toHaveLength(1);
  });

  it("403이면 킬 스위치가 자동으로 켜지고 다음 요청부터 전부 막힌다", async () => {
    const h = harness(() => new Response(null, { status: 403 }));

    const first = await call(h);
    expect(first.response.status).toBe(404);

    // 🚨 403은 상대가 처음으로 말을 한 것이다 (§4.8 ⓔ).
    const stored = JSON.parse(h.kv.map.get("image-proxy:kill") as string);
    expect(stored.reason).toBe("upstream_403");
    expect(stored.at).toBe("2026-09-01T00:00:00.000Z");

    const second = await call(h, DOWNNAME_A);
    expect(second.steps).toEqual(["kill_switch"]);
    // 사람이 읽을 때까지 자동으로 꺼지지 않는다 — 원천 요청이 더 나가지 않았다.
    expect(h.calls).toHaveLength(1);
  });

  it("429도 같은 자리를 지난다", async () => {
    const h = harness(() => new Response(null, { status: 429 }));
    await call(h);

    expect(JSON.parse(h.kv.map.get("image-proxy:kill") as string).reason).toBe("upstream_429");
  });
});

describe("8·9단계 — 포맷 판정과 응답 헤더", () => {
  it("Content-Type이 매직 바이트에서 나온다. 헤더를 믿지 않는다", async () => {
    // 🚨 원천이 image/webp라고 말해도 바이트가 PNG면 PNG다. 같은 원천을 쓰는
    //    다른 서비스가 정확히 이 실수를 하고 있는 것을 08-31에 확인했다.
    const h = harness(() => ok(PNG_BYTES, { "Content-Type": "image/webp" }));
    const { response } = await call(h);

    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("webp도 바이트로 판정한다", async () => {
    const h = harness(() => ok(WEBP_BYTES));
    expect((await call(h)).response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("Cache-Control이 하나이고 회수를 막는 지시자가 없다", async () => {
    const h = harness();
    const cacheControl = (await call(h)).response.headers.get("Cache-Control") ?? "";

    expect(cacheControl).toBe("public, max-age=3600");
    // 셋 다 §9.4 ⓖ-4가 금지한 것 — 회수가 "라우트 끄기"로 성립하려면
    // 브라우저가 우리를 다시 물어봐야 한다.
    expect(cacheControl).not.toContain("immutable");
    expect(cacheControl).not.toContain("s-maxage");
    expect(cacheControl).not.toContain("stale-while-revalidate");
  });

  it("원천의 캐시 헤더를 그대로 흘리지 않는다", async () => {
    const h = harness(() =>
      ok(PNG_BYTES, { "Cache-Control": "private, max-age=31536000, immutable" }),
    );
    const { response } = await call(h);

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("Content-Length가 실제 바이트 수다", async () => {
    const h = harness();
    const { response } = await call(h);

    expect(response.headers.get("Content-Length")).toBe(String(PNG_BYTES.byteLength));
  });
});

describe("에러 응답은 본문을 흘리지 않는다", () => {
  let cases: { status: number; make: () => Harness }[];

  beforeEach(() => {
    cases = [
      { status: 400, make: () => harness() },
      { status: 502, make: () => harness(() => ok(HTML_BYTES)) },
      { status: 503, make: () => harness(undefined, { ipSalt: undefined }) },
    ];
  });

  it("어떤 거부에도 본문이 비어 있다", async () => {
    for (const { make } of cases) {
      const h = make();
      const { response } = await call(h, "형식이-아니다");
      expect(await response.text()).toBe("");
    }
  });
});
