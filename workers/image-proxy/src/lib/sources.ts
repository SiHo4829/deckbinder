/**
 * 원천 상수 — **호스트 · 경로 · 쿼리 이름이 전부 여기 있다** (plan §3.5).
 *
 * 🚨 **이 파일이 오픈 릴레이 방어의 겹 0이다.** 클라이언트가 URL이나 호스트를
 * 주는 형태(`?url=` · `?host=`)를 만들지 않는다 — 클라이언트가 주는 것은
 * `:source`(이 표의 키) 하나와 `:id`(downname) 하나뿐이고, **나머지는 전부
 * 우리가 코드에 적어 둔 상수다.** 겹 0을 깨는 변경은 §9.4 ⓖ-3을 먼저 고쳐야 한다.
 */

export interface SourceDefinition {
  /** 화이트리스트 대조에 쓰는 호스트. 🚨 여기 없는 호스트로는 나가지 않는다. */
  readonly host: string;
  /** downname 하나만 받아 원천 URL을 만든다. 🚨 인자가 하나인 것이 중요하다. */
  readonly buildUrl: (downname: string) => string;
}

/**
 * 🚨 **§4.4.1이 고정한 원천 목록을 넘지 않는다.** 두 번째 원천을 붙이려면
 * 그 절을 먼저 고쳐야 하고, 그 순서를 사람의 기억에 맡기지 않으려고 `:source`를
 * 경로에 뒀다 — **경로가 곧 원천 목록이다**(§4.8 ⓔ의 화이트리스트와 같은 자세).
 *
 * ⚠️ 키가 `opcg`가 아니라 `opcg-kr`인 이유: 마이그레이션 010이 `games.code`를
 * `opcg-kr`로 재명명했고 **DB의 권위 있는 식별자가 그것이다.** 로컬 디렉토리
 * 라벨(`opcg`)을 URL에 노출하면 두 이름 체계가 또 갈린다 (T1.22 판정 3의 교훈).
 */
export const SOURCES: Readonly<Record<string, SourceDefinition>> = {
  "opcg-kr": {
    host: "onepiece-cardgame.kr",
    buildUrl: (downname) =>
      `https://onepiece-cardgame.kr/fileDownload?downname=${encodeURIComponent(downname)}`,
  },
};

export function isKnownSource(source: string): boolean {
  return Object.prototype.hasOwnProperty.call(SOURCES, source);
}

export function sourceDefinition(source: string): SourceDefinition | null {
  return isKnownSource(source) ? SOURCES[source] : null;
}

/**
 * 화이트리스트 후보 — `wrangler.toml`의 `IMAGE_PROXY_ALLOWED_HOSTS`를 파싱한다.
 *
 * 🚨 **비어 있으면 빈 배열이고, 빈 배열은 `decideHost()`에서 「전부 거부」다.**
 * "전부 허용"으로 착지하지 않는 것이 이 함수의 유일한 요점이다.
 */
export function parseAllowedHosts(raw: string | undefined | null): readonly string[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);
}
