/**
 * DeckBinder 카드 이미지 리버스 프록시 — 엔트리 (plan §3.5 · 결정문 §9.4 ⓖ).
 *
 * 🚨 **이 파일은 배선만 한다. 판단은 하지 않는다.** T1.16이 남긴 결함 5건이
 * 전부 "판단이 스크립트 본문에 있어 테스트가 안 붙은 자리"에서 나왔고, 그
 * 교훈을 여기 적용한다 — 9단계 순서와 그 안의 모든 판정은
 * `routes/image.ts`의 `handleImageRequest()`에 있고 그쪽에 테스트가 붙는다.
 *
 * 🚨 **`workers/crawler`와 별도 프로젝트다.** 그쪽은 (A) 매물 크롤러이고
 * 1회 1장 · 8~12초 연출 · 분당 3회가 걸려 있다. 이미지 프록시는 (A)도 (B)도
 * 아니다 — `CLAUDE.md`가 "한쪽 규칙을 다른 쪽에 적용하지 말라"를 명령으로
 * 걸었고, 한 프로젝트에 두면 언젠가 누군가 그 규칙을 이미지에 적용한다.
 */

import { Hono } from "hono";

import { CIRCUIT_CLOSED, type CircuitState } from "./lib/upstream";
import { createDurableRateLimiter } from "./lib/rate-limit";
import { parseAllowedHosts } from "./lib/sources";
import { handleHealth } from "./routes/health";
import {
  handleImageRequest,
  type CircuitBox,
  type MismatchRecorder,
} from "./routes/image";

export { ImageRateCounter } from "./durable/image-rate-counter";

export interface Env {
  KILL_SWITCH: KVNamespace;
  IMAGE_RATE_COUNTER: DurableObjectNamespace;
  IMAGE_PROXY_ALLOWED_HOSTS?: string;
  IMAGE_PROXY_IP_SALT?: string;
  IMAGE_PROXY_CONTACT?: string;
}

/**
 * 서킷 상태 — **아이솔레이트 메모리에 둔다.**
 *
 * ⚠️ **계약이 자리를 정해 주지 않아 여기서 정했다(2026-09-01).** 후보는 둘이었다:
 *
 * - **DO에 둔다** — 전역으로 정확하다. 🚨 그러나 서킷은 **모든 캐시 미스마다**
 *   읽어야 하고, 레이트리밋 DO는 IP별 인스턴스라 **서킷용 DO 왕복이 하나 더
 *   붙는다.** 무료 요금제에서 DO 요청은 100k/일이고 그것을 두 배로 태운다.
 * - **아이솔레이트 메모리** — 왕복 0회. 대가는 **콜로·아이솔레이트마다 따로
 *   센다**는 것이다.
 *
 * 후자를 골랐다. 근거: 🚨 **서킷이 막는 것은 5xx 연쇄이고, 진짜 위험한 신호
 * (403/429)는 서킷이 아니라 킬 스위치가 받는다** — 그쪽은 KV라 전역이다.
 * 아이솔레이트별로 세도 "원천이 아플 때 우리가 더 때리는" 것은 크게 준다.
 */
const circuitState = new Map<string, CircuitState>();

function circuitBoxFor(key: string): CircuitBox {
  return {
    read: () => circuitState.get(key) ?? CIRCUIT_CLOSED,
    write: (state) => {
      circuitState.set(key, state);
    },
  };
}

/**
 * 형식 불일치 카운터. 🚨 **거부하되 세어서 드러낸다**(§3.5).
 *
 * ⚠️ 아이솔레이트 메모리라 정확한 총계가 아니다. 그래도 목적은 달성한다 —
 * 네 번째 형식이 오면 **한 아이솔레이트에서도 임계를 금방 넘고**, 그러면
 * 로그에 남아 사람이 §3.5를 고칠 실마리가 된다. 총계가 필요한 것이 아니라
 * **"조용히 지나가지 않는 것"이 요건이다.**
 */
const MISMATCH_LOG_THRESHOLD = 10;
let mismatchCount = 0;

const mismatchRecorder: MismatchRecorder = {
  record(downname) {
    mismatchCount += 1;

    if (mismatchCount % MISMATCH_LOG_THRESHOLD === 0) {
      console.warn(
        JSON.stringify({
          event: "downname_format_mismatch",
          count: mismatchCount,
          // 🚨 값 전체를 찍지 않는다 — 길이와 앞머리면 형식 판정에 충분하고,
          //    통째로 찍으면 로그가 임의 문자열의 저장소가 된다.
          length: downname.length,
          head: downname.slice(0, 8),
        }),
      );
    }
  },
};

const app = new Hono<{ Bindings: Env }>();

app.get("/health", () => handleHealth());

/**
 * 🚨 **유일한 공개 라우트다.** 그리고 클라이언트가 주는 것은 `:source`와
 * `:id` 둘뿐이다 — **`?url=` · `?host=` 같은 인자를 받는 형태를 만들지
 * 않는다.** 이 한 줄이 오픈 릴레이 방어의 겹 0이다(§9.4 ⓖ-3).
 */
app.get("/img/:source/:id", async (c) => {
  const { source, id } = c.req.param();

  const { response } = await handleImageRequest(
    { source, downname: id },
    {
      killSwitch: c.env.KILL_SWITCH,
      rateLimiter: createDurableRateLimiter(c.env.IMAGE_RATE_COUNTER),
      cache: caches.default,
      circuit: circuitBoxFor(source),
      mismatch: mismatchRecorder,
      fetchImpl: fetch,
      allowlist: parseAllowedHosts(c.env.IMAGE_PROXY_ALLOWED_HOSTS),
      ipSalt: c.env.IMAGE_PROXY_IP_SALT,
      contact: c.env.IMAGE_PROXY_CONTACT,
      clientIp: c.req.header("cf-connecting-ip") ?? "unknown",
      origin: new URL(c.req.url).origin,
      now: () => new Date(),
    },
  );

  return response;
});

// 그 밖은 전부 404. 🚨 무엇이 있는지 알려 주지 않는다.
app.all("*", () => new Response(null, { status: 404 }));

export default app;
