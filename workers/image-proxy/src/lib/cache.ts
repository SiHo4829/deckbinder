/**
 * 캐시 계층 — **Workers Cache API 하나다. KV를 쓰지 않는다** (plan §3.5).
 *
 * KV를 기각한 이유 셋: ⓐ 무료 저장 1GB에 3,146장 × 평균 300KB ≈ 0.94GB로
 * 여유가 없다(무변환이라 6배다) ⓑ 무료 읽기 한도가 이미지 조회 빈도에 맞지
 * 않는다 ⓒ **KV가 주는 유일한 이점(전역 삭제)이 필요 없다** — 킬 스위치가
 * 캐시 조회보다 앞이라 **지울 수 있는지가 회수의 조건이 아니다**(§9.4 ⓖ-4).
 *
 * ⚠️ 대가는 적어 둔다: **콜로마다 따로 채워지므로 원천 요청이 콜로 수만큼
 * 곱해진다.** 한국 사용자면 사실상 한 곳이라 작지만 0이 아니다.
 */

/** 원천 TTL. 🚨 응답에 내보내는 `max-age`(1시간)와 다른 값이다 — 아래 참조. */
export const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * 브라우저에 내보내는 캐시 수명. **1시간.**
 *
 * 🚨 **`immutable` · `s-maxage` · `stale-while-revalidate`를 붙이지 않는다.**
 * 근거 셋 다 §9.4 ⓖ-4에 있고 요점은 하나다 — **회수가 "라우트 끄기"로
 * 성립하려면 브라우저가 우리를 다시 물어봐야 한다.** `immutable`은 그 질문을
 * 없애고, `s-maxage`는 우리 코드 앞에 캐시를 세우고, `stale-while-revalidate`는
 * 끈 뒤에도 낡은 것을 계속 보여 준다.
 */
export const RESPONSE_CACHE_CONTROL = "public, max-age=3600";

/** Cache API의 최소 모양. 테스트가 실물 없이 이것만 만족시킨다. */
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/**
 * 캐시 키 — **검증을 통과한 값으로만 만든다.**
 *
 * 🚨 형식이 어긋난 `:id`가 캐시 키가 되면 캐시가 오염된다. 그래서 요청 처리
 * 순서에서 **검증(2단계)이 캐시 조회(4단계)보다 앞**이고, 이 함수를 부르는
 * 자리도 그 뒤다.
 *
 * ⚠️ 확장자를 넣지 않는다 — 원천이 이미지마다 다른 포맷을 준다(webp / PNG
 * 실측). 경로에 `.webp`를 박으면 그것이 거짓 라벨이 된다.
 */
export function cacheKeyUrl(origin: string, source: string, downname: string): string {
  return `${origin}/img/${source}/${downname}`;
}

export function cacheKeyRequest(origin: string, source: string, downname: string): Request {
  return new Request(cacheKeyUrl(origin, source, downname), { method: "GET" });
}

/**
 * `sniffImageFormat()`이 돌려준 **관측값**을 MIME으로 옮기는 표.
 *
 * 🚨 **이 리터럴들은 "하드코딩된 Content-Type"이 아니라 표의 내용물이다.**
 * 둘의 차이가 이 워커의 요점이라 적어 둔다 — 하드코딩은 *바이트와 무관하게*
 * 정해진 값이고, 이것은 *바이트가 고른* 값이다. 같은 원천을 쓰는 다른 서비스가
 * `image/webp`로 박아 두고 PNG를 내보내는 것을 08-31에 확인했고, 우리가 T1.20
 * 결함 2에서 이미 한 번 밟은 함정이다.
 *
 * ⚠️ 그래서 응답 헤더는 이 함수의 반환값만 쓴다. 헤더에 이미지 MIME 리터럴이
 * 직접 박혀 있지 않은 것이 완료 기준 ⓒ의 확인 방법이다.
 */
const MIME_BY_FORMAT: Readonly<Record<string, string>> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
};

/** 🚨 표에 없는 포맷이면 `null`이다. 추측해서 라벨을 붙이지 않는다. */
export function mimeForFormat(format: string): string | null {
  return Object.prototype.hasOwnProperty.call(MIME_BY_FORMAT, format)
    ? MIME_BY_FORMAT[format]
    : null;
}
