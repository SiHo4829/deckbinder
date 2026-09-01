/**
 * 레이트리밋 카운터 (겹 3) — Durable Object.
 *
 * 🚨 **§3.4의 `quota-counter.ts`와 같은 패턴이지만 다른 객체다.** 그쪽은
 * 되팔이 방지 쿼터(§5.4)이고 이쪽은 남용 방지 리밋이다 — `CLAUDE.md`가
 * 갈라 둔 두 규칙이 여기서도 갈린다. **한 객체로 합치지 않는다.**
 *
 * ## 왜 저장하지 않고 메모리에만 두는가
 *
 * DO 인스턴스는 요청 사이에 살아 있으므로 카운터는 메모리에 둔다.
 * 🚨 **매 요청 저장하면 무료 SQLite 쓰기 한도(10만 행/일)를 요청 수와 1:1로
 * 태운다** — 레이트리밋이 스스로 한도를 잡아먹는 꼴이 된다.
 *
 * ⚠️ 대가: **인스턴스가 evict되면 카운터가 0으로 돌아간다(관대한 방향).**
 * 남용 차단이 목적이고 정확한 회계가 아니므로 받아들인다 — 그리고 이 성질을
 * 모른 채 "정확한 카운터"로 읽지 않도록 여기 적어 둔다.
 */

import {
  HOUR_MS,
  MINUTE_MS,
  RATE_LIMIT_PER_HOUR,
  RATE_LIMIT_PER_MINUTE,
  type RateLimitVerdict,
  type WindowCounter,
  bumpWindow,
  emptyWindow,
  exceedsLimit,
} from "../lib/rate-limit";

export class ImageRateCounter {
  #minute: WindowCounter;
  #hour: WindowCounter;

  // 🚨 `state`도 `env`도 받지 않는다. 런타임은 넘겨 주지만 이 객체는 쓰지
  //    않는다 — 카운터가 메모리에만 있기 때문이고(위 주석), 안 쓰는 인자를
  //    적어 두면 다음 사람이 "여기 저장하면 되겠네"로 읽는다.
  constructor() {
    const now = Date.now();

    this.#minute = emptyWindow(now);
    this.#hour = emptyWindow(now);
  }

  // 요청 본문을 보지 않는다. 부르는 쪽(`createDurableRateLimiter`)이 인스턴스를
  // IP 해시로 이미 갈라 놨으므로, 이 객체에 도착한 것은 전부 "한 번 셌다"이다.
  async fetch(): Promise<Response> {
    const now = Date.now();

    this.#minute = bumpWindow(this.#minute, now, MINUTE_MS);
    this.#hour = bumpWindow(this.#hour, now, HOUR_MS);

    const verdict: RateLimitVerdict = exceedsLimit(this.#minute, RATE_LIMIT_PER_MINUTE)
      ? { allowed: false, reason: "per_minute" }
      : exceedsLimit(this.#hour, RATE_LIMIT_PER_HOUR)
        ? { allowed: false, reason: "per_hour" }
        : { allowed: true, reason: "ok" };

    return new Response(JSON.stringify(verdict), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
