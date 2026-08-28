/**
 * 매니페스트 재실행 복구 판단 — plan §4.8 ⓚ-5 실행 순서 3, 리뷰 결함 2 수정.
 *
 * page=0이 이미 JSONL에 있는 재실행에서 「매니페스트의 `lastPageIndex`를
 * 쓴다. 매니페스트가 없으면 page=0을 한 번 다시 받는다」(plan 1999행)를
 * 코드로 옮긴 자리다. **판단만 한다** — 어느 파일이 최신인가, 그것이
 * 유효한가, 그래서 `lastPageIndex`가 무엇인가. 디렉터리 목록을 읽거나
 * JSON을 파싱하는 실제 I/O는 `scripts/collect-catalog.ts`가 한다.
 */

/**
 * `manifest-<stamp>.json` 형태의 파일명 중 가장 최근 것을 고른다.
 *
 * `stamp`는 `stampUtc`가 만드는 `YYYYMMDDTHHMMSSZ`(UTC, basic format) —
 * 사전식 정렬이 곧 시간순 정렬이라 문자열 최댓값이 최신이다.
 */
export function latestManifestFilename(filenames: readonly string[]): string | null {
  const candidates = filenames.filter((f) => /^manifest-\d{8}T\d{6}Z\.json$/.test(f));
  if (candidates.length === 0) {
    return null;
  }
  return [...candidates].sort().at(-1) ?? null;
}

/**
 * 매니페스트 복구 결과.
 *
 * 🚨 `lastPageIndex: number | null`을 그냥 돌려주지 않는다 — `null`은
 * 「세트가 1페이지짜리라 더 받을 페이지가 없다」는 **유효한 값**이라,
 * 「매니페스트를 못 믿겠다」는 뜻과 구분할 수 없어지면 완주한 1페이지
 * 세트가 불필요하게 page=0을 다시 받게 된다. `found`가 그 둘을 가른다.
 */
export type ManifestRecovery =
  | { readonly found: true; readonly lastPageIndex: number | null }
  | { readonly found: false };

const NOT_FOUND: ManifestRecovery = { found: false };

/**
 * 파싱된 JSON(형태를 모르는 `unknown`)이 신뢰할 수 있는 매니페스트인지
 * 확인하고 `lastPageIndex`를 꺼낸다. `schemaVersion`이 1이 아니거나
 * `lastPageIndex`가 숫자·`null` 어느 쪽도 아니면 신뢰하지 않는다 — 호출부는
 * `{ found: false }`를 「매니페스트가 없다」와 똑같이 취급해 page=0을
 * 다시 받는 것으로 복구한다(허용된 비용, plan §4.8 ⓚ-5).
 */
export function recoverFromManifest(parsed: unknown): ManifestRecovery {
  if (typeof parsed !== "object" || parsed === null) {
    return NOT_FOUND;
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    return NOT_FOUND;
  }
  if (!("lastPageIndex" in record)) {
    return NOT_FOUND;
  }
  const { lastPageIndex } = record;
  if (lastPageIndex === null) {
    return { found: true, lastPageIndex: null };
  }
  if (typeof lastPageIndex === "number" && Number.isInteger(lastPageIndex) && lastPageIndex >= 0) {
    return { found: true, lastPageIndex };
  }
  return NOT_FOUND;
}
