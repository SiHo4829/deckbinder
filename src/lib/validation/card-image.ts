/**
 * 카드 이미지 판정 — **워커와 앱이 함께 쓰는 규칙** (T1.29 · plan §3.5).
 *
 * ## 왜 `src/lib/catalog/`가 아니라 여기인가
 *
 * §3.4가 워커 `tsconfig`에 **`@/lib/validation/*` 별칭만** 공유하기로 정했다.
 * 그리고 `@/lib/catalog`는 §4.8 ⓒ가 **「로컬 스크립트 전용」으로 선언한 구획**이다.
 * 워커가 그 구획을 직접 가리키면 **선언과 실제가 어긋나고**, 다음 사람이 같은
 * 자세로 `parse.ts`를 부른다.
 *
 * ⚠️ **「`images.ts`를 import하면 jsdom이 딸려 온다」는 틀렸다** — 실측한 import
 * 그래프는 `images → pace → types`이고 셋 다 jsdom-free다(jsdom을 쓰는 것은
 * `catalog/parse.ts` 하나뿐이다). **이동의 근거는 「지금 새는 것」이 아니라
 * 「샐 자리를 남기지 않는 것」이고**, 여기에 더해 `images.ts`가 프록시와 무관한
 * 것을 잔뜩 들고 있다는 사실이다(`IMAGE_DELAY_MS` · `planImageFetches()` ·
 * `buildHostSurvey()` — **수집기의 부하 규율이 프록시 번들에 들어갈 이유가 없다**).
 *
 * 🚨 그 경계는 문서가 아니라 `eslint.config.mjs`가 문다 — **이 디렉토리는
 * `@/lib/catalog`를 값으로 import할 수 없다**(type-only는 허용. 지워지므로).
 *
 * ## I/O 0건
 *
 * `fetch`도 `fs`도 부르지 않는다. **바이트와 문자열을 값으로 받는다** — 그래야
 * 워커(Cloudflare) · 앱(Node/Edge) · 테스트가 같은 함수를 쓴다.
 */

// ─── downname 형식 (§3.5 「ID 형식」 · 2026-08-31 전수 실측) ───────────────

/**
 * 원천이 쓰는 `downname`의 형식.
 *
 * 🚨 **셋이고, 시대별로 완전히 갈린다(겹침 0).** 2026-08-31에 `data/catalog/opcg/`
 * 40파일 **3,146행 전수**를 세어 확인했다 — 요청 0회.
 *
 * | 형식 | 길이 | 건수 | 관측된 기간 |
 * |---|---|---|---|
 * | `A` 18자리 숫자              | 18 | 1,058 (33.6%) | 2024-03-21 ~ 2025-04-10 |
 * | `B` `<날짜>_<시각>_<hex10>`  | 26 | 1,503 (47.8%) | 2025-04-24 ~ 2026-04-17 |
 * | `C` `<날짜>_<시각>_<hex32>`  | 48 |   585 (18.6%) | 2026-04-24 ~ 2026-08-13 |
 *
 * ⚠️ **문서가 알던 것은 `C` 하나였고 그것이 가장 작았다**(§4.8 ⓙ-4가 한 세트에서
 * 본 것을 전체 형식으로 적었다). **`C`만 받는 코드를 만들었으면 카드 81.4%가
 * 조용히 폴백이 됐다** — 에러가 아니라 「데이터가 없나 보다」로 보이는 실패다.
 *
 * 🚨 **네 번째가 온다고 보고 설계한다.** 원천이 두 번 갈아치웠고 마지막 교체가
 * 2026-04-24다. **그러나 코드가 스스로 형식을 넓히지 않는다** — 그것은 릴레이
 * 표면을 코드가 자기 손으로 넓히는 일이다. 워커는 **불일치를 거부하되 세어서
 * 드러내고**(T1.30), 형식을 더하는 것은 **사람이 §3.5를 고쳐서** 한다.
 */
export type DownnameFormat = "A" | "B" | "C";

export interface DownnamePattern {
  readonly format: DownnameFormat;
  /** 🚨 `g` 플래그를 붙이지 않는다 — `lastIndex`가 남아 같은 값이 번갈아 통과한다. */
  readonly pattern: RegExp;
  readonly length: number;
}

export const DOWNNAME_PATTERNS: readonly DownnamePattern[] = [
  { format: "A", pattern: /^\d{18}$/, length: 18 },
  { format: "B", pattern: /^\d{8}_\d{6}_[0-9a-fA-F]{10}$/, length: 26 },
  { format: "C", pattern: /^\d{8}_\d{6}_[0-9a-fA-F]{32}$/, length: 48 },
] as const;

/** 셋 중 하나에 맞으면 그 형식, 아니면 `null`. **불일치 집계가 이것을 쓴다.** */
export function downnameFormat(value: string): DownnameFormat | null {
  for (const { format, pattern } of DOWNNAME_PATTERNS) {
    if (pattern.test(value)) {
      return format;
    }
  }
  return null;
}

/**
 * 이 문자열을 원천 URL 조립에 써도 되는가 — **오픈 릴레이 방어의 겹 2**(§9.4 ⓖ-3).
 *
 * 🚨 **트림하지 않고, 소문자화하지 않고, 어떤 정규화도 하지 않는다.** 받아 주면
 * **같은 이미지가 여러 캐시 키를 갖게 되고**, 그것은 캐시 오염이자 원천 부하다.
 * 셋 다 **고정 길이 · 고정 문자집합**이라 경로 문자(`/` `..` `?` `#` `%`)가 들어갈
 * 자리가 애초에 없다.
 */
export function isValidDownname(value: string): boolean {
  return downnameFormat(value) !== null;
}

/**
 * `?downname=…`의 값. **이것이 원천에서 이미지 한 장을 가리키는 식별자다.**
 *
 * 🚨 고유 이미지 수를 이 값으로 세는 이유(T1.20 명세 5): 행 수는 **카드 수**이고
 * 요청 수는 **이미지 수**다. 둘이 다르면 사람이 승인하는 숫자의 의미가
 * 흐려진다 — `--max-requests`가 곧 승인이기 때문이다(§4.8 ⓔ).
 *
 * ★ **T1.31 (2026-09-01): `src/lib/catalog/images.ts`에서 옮겨 왔다. 로직 무변경.**
 * 🚨 **옮긴 이유는 T1.29가 호스트 판정 넷을 옮긴 것과 같다** — 이 함수를
 * `@/lib/catalog`에 둔 채로 `src/lib/cards/`의 `proxiedImageUrl()`이 부르면
 * **「로컬 스크립트 전용 구획」 선언과 실제가 어긋난다**(§4.8 ⓒ · §3.5 「번들 오염」).
 * ⚠️ **여기서는 lint가 잡아 주지 않는다** — 차단 글롭이 `src/app/**`와
 * `src/lib/validation/**`뿐이라 `src/lib/cards/**`는 어느 쪽도 아니다.
 * **그래서 자리를 옮기는 것이 유일한 방어다**(T1.31 ⓖ-ⓑ의 `rg`가 문지기다).
 *
 * ⚠️ **`isValidDownname()`을 부르지 않는다.** 이 함수는 **꺼내기만** 하고
 * 형식 판정은 부르는 쪽이 한다 — 수집기는 원천이 준 값을 그대로 세어야 하고
 * (형식이 낯설어도 그것은 관측이다), 프록시 URL 조립은 형식을 통과한 것만
 * 써야 한다. **두 요구가 다르므로 한 함수에 합치지 않는다.**
 */
export function extractDownname(imagePath: string): string | null {
  const queryStart = imagePath.indexOf("?");
  if (queryStart < 0) {
    return null;
  }
  const value = new URLSearchParams(imagePath.slice(queryStart + 1)).get("downname");
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// ─── 호스트 판정 (T1.20 ⓑ에서 옮겨 왔다. 로직 무변경) ─────────────────────

export function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export type HostDecisionReason =
  | "allowed"
  /** 🚨 승인이 아직 없다. **빈 화이트리스트는 「전부 허용」이 아니라 「전부 거부」다.** */
  | "empty_allowlist"
  | "not_allowlisted"
  | "unparsable";

export interface HostDecision {
  readonly allowed: boolean;
  readonly host: string | null;
  readonly reason: HostDecisionReason;
}

/**
 * 이 URL로 요청을 내보내도 되는가.
 *
 * 🚨 **승인이 없는 상태(빈 목록)에서 전부 거부되는 것이 이 함수의 핵심 동작이다.**
 * ★ **그리고 그 성질이 프록시에서 그대로 킬 스위치가 된다**(§9.4 ⓖ-4) — 화이트
 * 리스트를 비우는 것이 곧 「전부 내린다」이다.
 */
export function decideHost(url: string, allowlist: readonly string[]): HostDecision {
  const host = hostOf(url);
  if (host === null) {
    return { allowed: false, host: null, reason: "unparsable" };
  }
  if (allowlist.length === 0) {
    return { allowed: false, host, reason: "empty_allowlist" };
  }
  if (!allowlist.includes(host)) {
    return { allowed: false, host, reason: "not_allowlisted" };
  }
  return { allowed: true, host, reason: "allowed" };
}

export interface FinalHostCheck {
  readonly ok: boolean;
  readonly requestedHost: string | null;
  readonly finalHost: string | null;
  readonly reason: "ok" | "redirected_offsite" | "unparsable";
}

/**
 * 응답이 **실제로 도착한** URL의 호스트를 검사한다.
 *
 * 🚨 **사람이 승인한 것은 도착지가 아니라 출발지였다.** 리다이렉트나 CDN 전환은
 * 첫 실제 요청에서만 드러나고, 다른 호스트에 도착하는 것은 「원천이 하나 늘어나는
 * 것」과 형태가 같다(`CLAUDE.md` (B) · §4.4.1). **이 조항이 없으면 승인 절차가
 * 첫 요청에서 조용히 우회된다.**
 */
export function checkFinalHost(
  requestedUrl: string,
  finalUrl: string,
  allowlist: readonly string[],
): FinalHostCheck {
  const requestedHost = hostOf(requestedUrl);
  const finalHost = hostOf(finalUrl);
  if (finalHost === null) {
    return { ok: false, requestedHost, finalHost: null, reason: "unparsable" };
  }
  if (!allowlist.includes(finalHost)) {
    return { ok: false, requestedHost, finalHost, reason: "redirected_offsite" };
  }
  return { ok: true, requestedHost, finalHost, reason: "ok" };
}

// ─── 포맷 판정 (T1.20 결함 2가 만든 함수. 로직 무변경) ────────────────────

/**
 * 받은 바이트의 실제 포맷 — **`Content-Type` 헤더를 믿지 않는다.**
 *
 * 🚨 **원천은 `Content-Type`을 아예 보내지 않는다**(2026-08-30·08-31 실측). 그리고
 * **이미지마다 포맷이 다르다** — webp 1500×2044를 주는 것도 있고 PNG 600×814를
 * 주는 것도 있다. **헤더는 의견이고 매직 바이트는 관측이다.**
 *
 * ⚠️ 같은 원천을 쓰는 다른 서비스가 `image/webp`로 하드코딩해 **PNG에 거짓 라벨을
 * 붙이고 있는 것**을 08-31에 확인했다. 프록시는 이 함수가 정한 것만 내보낸다.
 * **`null`이면 이미지가 아니므로 502이고, 캐시에 넣지 않는다**(§3.5 헤더 계약).
 */
export function sniffImageFormat(bytes: Uint8Array): string | null {
  if (bytes.length >= 12) {
    // RIFF....WEBP
    const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (riff && webp) {
      return "webp";
    }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "gif";
  }
  return null;
}
