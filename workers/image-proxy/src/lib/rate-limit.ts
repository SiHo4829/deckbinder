/**
 * 레이트리밋 — **오픈 릴레이 3중 방어의 겹 3** (plan §3.5).
 *
 * 🚨 폐기된 §5.4의 「분당 3회」를 여기 적용하지 않는다 — 그 되팔이 방지
 * 쿼터는 2026-09-03에 시세 축과 함께 폐기됐다(plan §5.7 · 원문은
 * plan-archive). 이것은 남용 방지 리밋이다. ⚠️ 폐기됐다고 이 경고를 지우지
 * 않는다: archive에 원문이 남아 있어 되살아날 수 있는 생각이고, 섞으면
 * 세트 화면 한 장(60장)이 즉시 막힌다.
 *
 * ## 기전: Durable Object (2026-09-01 확정)
 *
 * §3.5의 사다리는 "DO 가용 → DO. 아니면 내장 바인딩. 둘 다 아니면 창 카운터"
 * 였다. **무료 요금제에서 DO가 쓸 수 있는 것을 확인해 첫 칸에서 섰다**
 * (단 SQLite 백엔드 클래스만 — `wrangler.toml`의 `new_sqlite_classes`).
 *
 * ⚠️ 무료 DO 한도가 100k 요청/일인데 레이트리밋은 **캐시 조회보다 앞(3단계)**
 * 이라 모든 요청이 DO를 지난다. 그런데 **Workers 무료도 100k 요청/일이라 두
 * 한도가 같이 닿는다** — DO를 골라도 유효 상한이 내려가지 않는다.
 */

/** 🚨 관습값이지 실측이 아니다. **첫 실측 뒤 이 줄을 고친다**(§3.5). */
export const RATE_LIMIT_PER_MINUTE = 240;

export const RATE_LIMIT_PER_HOUR = 2_000;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * 60_000;

// ─── 창 카운터 — 순수 상태 전이 ────────────────────────────────────────────

export interface WindowCounter {
  /** 창의 시작 시각(epoch ms). */
  readonly windowStart: number;
  readonly count: number;
}

export function emptyWindow(now: number): WindowCounter {
  return { windowStart: now, count: 0 };
}

/**
 * 창을 한 칸 올린다. 창이 지났으면 새 창에서 1부터 시작한다.
 *
 * ⚠️ **고정 창이다. 슬라이딩이 아니다.** 창 경계에서 최대 2배까지 통과할 수
 * 있고, 그것을 알고 받는다 — 값(분당 240)이 정상 사용의 4배쯤으로 잡혀 있어
 * 경계 효과가 정상 사용자를 막지 않는다. **정확한 회계가 아니라 남용 차단이
 * 목적이다.**
 */
export function bumpWindow(counter: WindowCounter, now: number, windowMs: number): WindowCounter {
  if (now - counter.windowStart >= windowMs) {
    return { windowStart: now, count: 1 };
  }

  return { windowStart: counter.windowStart, count: counter.count + 1 };
}

export function exceedsLimit(counter: WindowCounter, limit: number): boolean {
  return counter.count > limit;
}

// ─── IP 해시 ──────────────────────────────────────────────────────────────

/**
 * IP를 **솔트 해시로만** 다룬다 (폐기된 §5.4가 세운 규칙을 그대로
 * 유지한다 — 🚨 규칙이 틀려서 폐기된 것이 아니라 주어가 없어져서다).
 *
 * 🚨 시크릿 이름은 `IMAGE_PROXY_IP_SALT`이고 ~~T2.9의 `IP_HASH_SALT`~~(폐기)
 * — 남는 것은 §9.2 ⓐ의 "값을 나누는 비용은 0이다" 하나다.
 *
 * ⚠️ 솔트가 없으면 던지지 않고 **빈 문자열로 해시하지도 않는다** — 그러면
 * 모든 IP가 같은 키가 되어 전 사용자가 한 카운터를 공유한다. 솔트가 없는
 * 것은 배포 실수이므로 **호출부가 그때 전체를 거부한다**(아래 반환값 null).
 */
export async function hashIp(ip: string, salt: string | undefined | null): Promise<string | null> {
  if (!salt) return null;

  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// ─── 클라이언트 ───────────────────────────────────────────────────────────

export interface RateLimitVerdict {
  readonly allowed: boolean;
  readonly reason: "ok" | "per_minute" | "per_hour" | "no_salt" | "unavailable";
}

export interface RateLimiter {
  check(clientKey: string): Promise<RateLimitVerdict>;
}

/**
 * Durable Object 기반 리미터.
 *
 * 🚨 **DO를 못 부르면 통과시키지 않는다** — 겹 3이 빠진 채로 도는 것이
 * 정확히 §3.5가 "셋 다 못 쓰면 배포하지 않는다"로 막은 상태다. 다만 그
 * 요청 하나를 거부할 뿐 서비스를 죽이지는 않는다.
 */
export function createDurableRateLimiter(namespace: DurableObjectNamespace): RateLimiter {
  return {
    async check(clientKey) {
      try {
        const id = namespace.idFromName(clientKey);
        const stub = namespace.get(id);
        const response = await stub.fetch("https://image-rate-counter/check");

        if (!response.ok) return { allowed: false, reason: "unavailable" };

        return (await response.json()) as RateLimitVerdict;
      } catch {
        return { allowed: false, reason: "unavailable" };
      }
    },
  };
}
