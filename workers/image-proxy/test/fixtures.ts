/**
 * 테스트 픽스처.
 *
 * 🚨 **실제 카드 이미지를 넣지 않는다** (plan §9.4 ⓕ-3 · §3.5 「테스트 전략」).
 * T1.20이 만든 합성 바이트와 같은 자세다 — 원천의 저작물을 저장소에 커밋하지
 * 않고, 우리가 검사하는 것은 **매직 바이트**이지 그림이 아니다.
 */

/** 89 50 4E 47 … — `sniffImageFormat()`이 "png"로 읽는 최소 바이트. */
export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

/** RIFF....WEBP */
export const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

/**
 * 이미지가 **아닌** 바이트. 🚨 원천이 에러 HTML을 200으로 줄 수 있다 —
 * 그 사이트는 404 본문이 20,615바이트짜리 HTML이다(§4.8 ⓔ).
 */
export const HTML_BYTES = new TextEncoder().encode("<!doctype html><html><body>404");

/** 실측된 세 형식의 표본 (§3.5 「ID 형식」). */
export const DOWNNAME_A = "202404240732471520";
export const DOWNNAME_B = "20250619_183626_9012333d90";
export const DOWNNAME_C = "20260720_133222_f6f63859f7e04962a60da06c95a397f1";

export const ALLOWED_HOSTS = ["onepiece-cardgame.kr"] as const;

/** 한 번 호출되면 그 응답을 주는 `fetch` 대역. 🚨 네트워크로 나가지 않는다. */
export function stubFetch(
  responder: (url: string, init?: RequestInit) => Response | Promise<Response>,
): { impl: typeof fetch; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];

  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return responder(url, init);
  }) as unknown as typeof fetch;

  return { impl, calls };
}

/** 메모리 KV. `KillSwitchStore`만 만족하면 된다. */
export function memoryKv(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));

  return {
    map,
    async get(key: string) {
      return map.get(key) ?? null;
    },
    async put(key: string, value: string) {
      map.set(key, value);
    },
  };
}

/** 메모리 캐시. `CacheLike`만 만족하면 된다. */
export function memoryCache() {
  const map = new Map<string, Response>();

  return {
    map,
    async match(request: Request) {
      const hit = map.get(request.url);
      return hit ? hit.clone() : undefined;
    },
    async put(request: Request, response: Response) {
      map.set(request.url, response);
    },
  };
}
