/**
 * 렌더 시점 프록시 URL 재작성 — **순수 함수. I/O 0건** (T1.31 · plan §9.4 ⓖ-5).
 *
 * ## 왜 저장하지 않고 렌더 시점에 만드는가
 *
 * 🚨 **프록시 URL은 파생값이다. `cards`에 넣지 않는다.** 넣으면 ⓐ 프록시
 * 도메인을 바꿀 때마다 3,139행 백필이 필요하고 ⓑ 되돌리기가 `git revert`에서
 * `UPDATE 3,139행`으로 바뀐다. **§4.13 ⓓ-5가 희귀도 점수에 대해 내린 것과
 * 같은 판정이다.** 그래서 이 태스크는 **마이그레이션 0건 · `UPDATE` 0행**이다.
 *
 * ## 왜 `src/lib/catalog/`가 아니라 여기인가
 *
 * `@/lib/catalog`는 §4.8 ⓒ가 **「로컬 스크립트 전용」으로 선언한 구획**이고
 * 이 파일은 화면이 부른다. ⚠️ **그런데 `eslint.config.mjs`의 차단 글롭은
 * `src/app/**`와 `src/lib/validation/**`뿐이라 `src/lib/cards/**`는 어느 쪽도
 * 아니다** — 🚨 **여기서는 lint가 잡아 주지 않는다. 자리를 옳게 고르는 것과
 * T1.31 ⓖ-ⓑ의 `rg`가 유일한 문지기다.**
 *
 * 그래서 이 파일은 `@/lib/validation/card-image`만 부른다.
 */

import { extractDownname, hostOf, isValidDownname } from "@/lib/validation/card-image";

/**
 * 승인된 원천 호스트 → 프록시 경로의 `:source` 키.
 *
 * 🚨 **`games.code`가 아니라 *호스트*에서 나온다.** 화면이 가진 것은 원천
 * URL이고 게임 코드가 아니다 — 그리고 승인의 단위도 게임이 아니라 호스트다
 * (§4.4.1 · `CLAUDE.md` (B)).
 *
 * ⚠️ **키가 `opcg`가 아니라 `opcg-kr`이다.** 마이그레이션 010이 `games.code`를
 * `opcg-kr`로 재명명했고 **DB의 권위 있는 식별자가 그것이다**(T1.22 판정 3).
 *
 * 🚨 **이 표는 워커의 `sources.ts`와 같은 값을 두 벌로 들고 있다.** 오늘
 * 합치지 않는 이유는 `--dry-run`이 통과한 워커 번들을 배포 직전에 다시
 * 건드리지 않기 위해서다 — **대가는 사용자 확인 6에 적혀 있다.** 값이 어긋나면
 * 화면이 조용히 폴백이 되므로, **맞는지는 테스트가 경로 모양으로 센다.**
 */
export const PROXY_SOURCE_BY_HOST: Readonly<Record<string, string>> = {
  "onepiece-cardgame.kr": "opcg-kr",
};

/**
 * 원천 이미지 URL을 프록시 URL로 바꾼다. **못 바꾸면 `null`이고, `null`은
 * 폴백을 뜻한다 — 던지지 않는다.**
 *
 * 🚨 **`proxyBase`는 인자다. 모듈에 박지 않는다** — `absolutizeImagePath`가
 * 세운 계약 그대로다. 박으면 그것은 확인이 아니라 선언이 된다.
 *
 * ⚠️ **`base`가 비어 있으면 전량 `null`이다. 그것이 정상 동작이다**(ⓕ) —
 * 프록시가 배포되기 전에도 화면이 깨지지 않아야 하고, 오늘이 정확히 그 상태다.
 *
 * 🚨 **형식이 어긋나면 프록시에 보내지 않는다.** 보내면 워커가 400을 주고
 * 그 요청은 우리 한도를 태운다 — **알 수 있는 것을 요청으로 알아내지 않는다.**
 */
export function proxiedImageUrl(
  sourceUrl: string | null | undefined,
  proxyBase: string | null | undefined,
): string | null {
  const base = proxyBase?.trim();
  if (!base) return null;
  if (!sourceUrl) return null;

  // 호스트 판정 — 승인한 원천이 아니면 프록시에 보내지 않는다. 워커도 겹 1로
  // 막지만, 막힐 요청을 앱이 먼저 만들지 않는 것이 낫다.
  const host = hostOf(sourceUrl);
  if (host === null) return null;

  const source = Object.prototype.hasOwnProperty.call(PROXY_SOURCE_BY_HOST, host)
    ? PROXY_SOURCE_BY_HOST[host]
    : null;
  if (source === null) return null;

  const downname = extractDownname(sourceUrl);
  if (downname === null || !isValidDownname(downname)) return null;

  return `${base.replace(/\/+$/, "")}/img/${source}/${downname}`;
}

/**
 * 화면에 내려보낼 이미지 URL 하나를 고른다.
 *
 * 🚨 **`image_url`이 먼저다.** 되돌릴 갈래(자체 호스팅으로 돌아가는 날 ·
 * §9.4 ⓖ-9)에서 그 컬럼이 다시 채워지면 **그날 코드를 한 줄도 안 고쳐도 된다.**
 * ⚠️ 오늘 그 컬럼은 3,139행 전량 `null`이라 실질적으로는 늘 프록시 쪽이 쓰인다.
 */
export function resolveCardImageUrl(
  imageUrl: string | null | undefined,
  sourceImageUrl: string | null | undefined,
  proxyBase: string | null | undefined,
): string | null {
  return imageUrl ?? proxiedImageUrl(sourceImageUrl, proxyBase);
}

/**
 * 조회 결과 한 행의 `image_url`을 프록시 URL로 채우고 **원천 URL을 떼어낸다**
 * (T1.31 ⓓ · plan §9.4 ⓕ-5).
 *
 * 🚨 **`source_image_url`을 `CardListItem`·`CardDetail` 타입에 넣지 않는다.**
 * 그 강제가 이 설계의 절반이다 — **컴포넌트가 원천 URL을 볼 수 없으면 그릴 수
 * 없고**, 그러면 브라우저가 원천에 직접 붙는 경로가 애초에 생기지 않는다.
 *
 * ⚠️ **타입에서 빼는 것만으로는 부족해 런타임에서도 지운다.** 타입은 컴파일에
 * 지워지므로 객체에 남아 있으면 직렬화를 타고 클라이언트로 그대로 내려간다.
 */
export function withProxiedImage<T extends { image_url: string | null }>(
  row: T & { source_image_url?: string | null },
  proxyBase: string | null | undefined,
): T {
  const { source_image_url: sourceImageUrl, ...rest } = row;

  return {
    ...rest,
    image_url: resolveCardImageUrl(rest.image_url, sourceImageUrl, proxyBase),
  } as unknown as T;
}
