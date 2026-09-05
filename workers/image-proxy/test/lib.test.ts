import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { RESPONSE_CACHE_CONTROL, cacheKeyUrl } from "../src/lib/cache";
import { KILL_SWITCH_KEY, parseKillState, readKillState, tripKillSwitch } from "../src/lib/kill-switch";
import {
  HOUR_MS,
  MINUTE_MS,
  RATE_LIMIT_PER_HOUR,
  RATE_LIMIT_PER_MINUTE,
  bumpWindow,
  emptyWindow,
  exceedsLimit,
  hashIp,
} from "../src/lib/rate-limit";
import { SOURCES, parseAllowedHosts, sourceDefinition } from "../src/lib/sources";
import {
  CIRCUIT_CLOSED,
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_OPEN_MS,
  circuitIsOpen,
  recordUpstreamFailure,
  recordUpstreamSuccess,
  upstreamHeaders,
  upstreamUserAgent,
} from "../src/lib/upstream";
import { DOWNNAME_C, memoryKv } from "./fixtures";

describe("sources — 겹 0", () => {
  it("클라이언트가 주는 것은 downname 하나다", () => {
    const definition = sourceDefinition("opcg-kr");

    expect(definition).not.toBeNull();
    // 🚨 buildUrl의 인자가 하나인 것이 겹 0의 모양이다. 호스트도 경로도
    //    쿼리 이름도 전부 상수이고 클라이언트가 고를 수 없다.
    expect(definition!.buildUrl.length).toBe(1);
    expect(definition!.buildUrl(DOWNNAME_C)).toBe(
      `https://onepiece-cardgame.kr/fileDownload?downname=${DOWNNAME_C}`,
    );
  });

  it("downname을 URL 인코딩해 경로·쿼리를 벗어나지 못하게 한다", () => {
    // 검증(2단계)이 이미 막지만, 상수 쪽에서도 한 겹 더 둔다.
    expect(sourceDefinition("opcg-kr")!.buildUrl("a&b=c")).toContain("a%26b%3Dc");
  });

  it("원천 목록이 §4.4.1이 고정한 하나뿐이다", () => {
    expect(Object.keys(SOURCES)).toEqual(["opcg-kr"]);
  });

  it("빈 화이트리스트는 빈 배열이다 — 전부 허용으로 착지하지 않는다", () => {
    expect(parseAllowedHosts(undefined)).toEqual([]);
    expect(parseAllowedHosts("")).toEqual([]);
    expect(parseAllowedHosts("   ")).toEqual([]);
    expect(parseAllowedHosts("a.example, b.example")).toEqual(["a.example", "b.example"]);
  });
});

describe("kill-switch", () => {
  it("값이 없으면 꺼진 것이다", () => {
    expect(parseKillState(null).killed).toBe(false);
    expect(parseKillState("").killed).toBe(false);
    expect(parseKillState("   ").killed).toBe(false);
  });

  it("아무 문자열이나 켜짐으로 읽는다", () => {
    // 사람이 대시보드에서 급히 켤 때 "on"을 정확히 못 적어도 켜져야 한다.
    // 회수는 실패하는 쪽이 더 비싸다.
    expect(parseKillState("on").killed).toBe(true);
    expect(parseKillState("ON").killed).toBe(true);
    expect(parseKillState("꺼줘").killed).toBe(true);
  });

  it("자동 발동이 사유와 시각을 남긴다", async () => {
    const kv = memoryKv();

    await tripKillSwitch(kv, "upstream_403", new Date("2026-09-01T12:00:00Z"));
    const state = await readKillState(kv);

    expect(state.killed).toBe(true);
    expect(state.reason).toBe("upstream_403");
    expect(state.at).toBe("2026-09-01T12:00:00.000Z");
  });

  it("끄는 함수가 없다 — 사람이 읽을 때까지 자동으로 꺼지지 않는다", async () => {
    const killSwitchModule = await import("../src/lib/kill-switch");

    // 🚨 이 단언이 §4.8 ⓔ의 "사람이 읽을 때까지 다시 돌리지 않는다"의 구현이다.
    //    끄는 함수가 생기면 여기서 깨진다.
    expect(Object.keys(killSwitchModule).filter((name) => /clear|reset|disable|off/i.test(name))).toEqual([]);
  });

  it("KV를 못 읽어도 서비스를 죽이지 않는다", async () => {
    const broken = {
      async get(): Promise<string | null> {
        throw new Error("KV unavailable");
      },
      async put() {},
    };

    expect((await readKillState(broken)).killed).toBe(false);
  });

  it("기록에 실패해도 던지지 않는다", async () => {
    const broken = {
      async get() {
        return null;
      },
      async put(): Promise<void> {
        throw new Error("quota");
      },
    };

    await expect(tripKillSwitch(broken, "upstream_429", new Date())).resolves.toBeUndefined();
  });

  it("키 이름이 하나로 고정이다", () => {
    expect(KILL_SWITCH_KEY).toBe("image-proxy:kill");
  });
});

describe("rate-limit — 창 카운터", () => {
  it("창 안에서는 누적한다", () => {
    let counter = emptyWindow(1_000);

    counter = bumpWindow(counter, 1_000, MINUTE_MS);
    counter = bumpWindow(counter, 30_000, MINUTE_MS);

    expect(counter.count).toBe(2);
    expect(counter.windowStart).toBe(1_000);
  });

  it("창이 지나면 새 창에서 1부터다", () => {
    let counter = emptyWindow(0);
    counter = bumpWindow(counter, 0, MINUTE_MS);
    counter = bumpWindow(counter, MINUTE_MS, MINUTE_MS);

    expect(counter).toEqual({ windowStart: MINUTE_MS, count: 1 });
  });

  it("한도를 넘는 순간에만 참이다", () => {
    expect(exceedsLimit({ windowStart: 0, count: RATE_LIMIT_PER_MINUTE }, RATE_LIMIT_PER_MINUTE)).toBe(false);
    expect(exceedsLimit({ windowStart: 0, count: RATE_LIMIT_PER_MINUTE + 1 }, RATE_LIMIT_PER_MINUTE)).toBe(true);
  });

  it("시간 한도가 분 한도보다 크다", () => {
    // 분 한도만 있으면 하루 종일 분당 240을 때리는 것을 못 막는다.
    expect(RATE_LIMIT_PER_HOUR).toBeGreaterThan(RATE_LIMIT_PER_MINUTE);
    expect(HOUR_MS).toBe(60 * MINUTE_MS);
  });

  it("세트 화면 한 장(60장)이 분 한도에 닿지 않는다", () => {
    // 이 값의 근거 그대로다 — 정상 사용자는 연속 네 화면을 넘겨야 닿는다.
    expect(RATE_LIMIT_PER_MINUTE).toBeGreaterThanOrEqual(60 * 4);
  });
});

describe("rate-limit — IP 해시", () => {
  it("솔트가 없으면 null이다 — 빈 솔트로 해시하지 않는다", async () => {
    expect(await hashIp("1.2.3.4", undefined)).toBeNull();
    expect(await hashIp("1.2.3.4", "")).toBeNull();
  });

  it("같은 IP는 같은 키, 다른 IP는 다른 키다", async () => {
    const a = await hashIp("1.2.3.4", "salt");
    const b = await hashIp("1.2.3.4", "salt");
    const c = await hashIp("1.2.3.5", "salt");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("솔트가 다르면 키가 다르다", async () => {
    // 🚨 T2.9의 IP_HASH_SALT와 다른 값을 쓰는 것이 §9.2 ⓐ의 요구다.
    expect(await hashIp("1.2.3.4", "salt-a")).not.toBe(await hashIp("1.2.3.4", "salt-b"));
  });

  it("원본 IP가 키에 남지 않는다", async () => {
    const key = await hashIp("203.0.113.7", "salt");

    expect(key).not.toContain("203");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("upstream — 헤더 계약", () => {
  it("연락처가 없으면 이름만 보낸다", () => {
    expect(upstreamUserAgent(null)).toBe("DeckBinder-ImageProxy/0.1");
    expect(upstreamUserAgent("  ")).toBe("DeckBinder-ImageProxy/0.1");
  });

  it("브라우저 UA 문자열이 하나도 없다", () => {
    const ua = upstreamUserAgent("contact");

    for (const browserish of ["Mozilla", "AppleWebKit", "Chrome", "Safari", "Gecko"]) {
      expect(ua).not.toContain(browserish);
    }
  });

  it("연락처가 있으면 UA 끝에 괄호로 붙는다 (T4.4 — IMAGE_PROXY_CONTACT)", () => {
    // wrangler.toml [vars] IMAGE_PROXY_CONTACT와 같은 값이어야 한다.
    expect(upstreamUserAgent("jsh040829@gmail.com")).toBe(
      "DeckBinder-ImageProxy/0.1 (jsh040829@gmail.com)",
    );
  });

  it("wrangler.toml [vars]에 IMAGE_PROXY_CONTACT가 시크릿이 아니라 평문으로 있다 (T4.4)", () => {
    // §9.12 ⓛ — /privacy가 이미 공개하는 주소라 [vars]가 맞다. wrangler
    // secret으로 넣지 않는다(그러면 이 값이 파일에 아예 없어야 정상이라
    // 이 테스트가 실패로 그것을 잡는다).
    const tomlPath = fileURLToPath(new URL("../wrangler.toml", import.meta.url));
    // CRLF 정규화 — JS 정규식은 `$`(m 플래그)가 `\n` 앞뿐 아니라 `\r` 앞에서도
    // 매칭돼서, 정규화 없이 `\r\n`을 그대로 두면 첫 줄에서 조기 매칭된다.
    const toml = readFileSync(tomlPath, "utf-8").replace(/\r\n/g, "\n");
    const varsMatch = /^\[vars\]\n([\s\S]*?)(?=\n\[|(?![\s\S]))/m.exec(toml);
    const varsSection = varsMatch?.[1] ?? "";

    // [vars] 블록 안에 있는지까지 확인한다 (다른 섹션에 들어가면 값이
    // env.IMAGE_PROXY_CONTACT로 안 읽힌다).
    expect(varsSection).toMatch(/IMAGE_PROXY_CONTACT\s*=\s*"jsh040829@gmail\.com"/);
  });

  it("보내는 헤더가 셋뿐이고 Referer가 없다", () => {
    const headers = upstreamHeaders(null);

    expect(Object.keys(headers).sort()).toEqual(["Accept", "Accept-Language", "User-Agent"]);
  });
});

describe("upstream — 서킷 상태 전이", () => {
  it("임계 미만이면 열리지 않는다", () => {
    let state = CIRCUIT_CLOSED;

    for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD - 1; i += 1) {
      state = recordUpstreamFailure(state, 1_000);
    }

    expect(circuitIsOpen(state, 1_000)).toBe(false);
  });

  it("임계에 닿으면 열린다", () => {
    let state = CIRCUIT_CLOSED;

    for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i += 1) {
      state = recordUpstreamFailure(state, 1_000);
    }

    expect(circuitIsOpen(state, 1_000)).toBe(true);
  });

  it("T분이 지나면 스스로 닫힌다", () => {
    let state = CIRCUIT_CLOSED;
    for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i += 1) {
      state = recordUpstreamFailure(state, 0);
    }

    expect(circuitIsOpen(state, CIRCUIT_OPEN_MS - 1)).toBe(true);
    expect(circuitIsOpen(state, CIRCUIT_OPEN_MS)).toBe(false);
  });

  it("성공하면 연속 카운터가 0으로 돌아간다", () => {
    // "연속" 실패여야 열린다 — 하루에 한 번씩 다섯 번 실패한 것으로 열리면
    // 그것은 서킷이 아니라 누적 고장 카운터다.
    let state = recordUpstreamFailure(CIRCUIT_CLOSED, 0);
    state = recordUpstreamFailure(state, 0);
    state = recordUpstreamSuccess();

    expect(state).toEqual(CIRCUIT_CLOSED);
  });

  it("임계가 배치 규율(N=3)보다 크다", () => {
    // 배치와 달리 여기서는 "중단"이 곧 서비스 중단이다 (§3.5).
    expect(CIRCUIT_FAILURE_THRESHOLD).toBeGreaterThan(3);
  });
});

describe("cache", () => {
  it("캐시 키에 확장자가 없다", () => {
    // 원천이 이미지마다 다른 포맷을 준다 — 경로에 .webp를 박으면 거짓 라벨이 된다.
    const key = cacheKeyUrl("https://img.example", "opcg-kr", DOWNNAME_C);

    expect(key).toBe(`https://img.example/img/opcg-kr/${DOWNNAME_C}`);
    expect(key).not.toMatch(/\.(webp|png|jpe?g|gif)$/);
  });

  it("응답 캐시 지시자에 회수를 막는 것이 없다", () => {
    expect(RESPONSE_CACHE_CONTROL).toBe("public, max-age=3600");
  });
});
