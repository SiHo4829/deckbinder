/**
 * 발행 시각을 현재보다 이만큼 과거로 찍는다.
 *
 * 공개 조회 RLS는 `published_at <= now()`인데(마이그레이션 006) 그 `now()`는
 * **DB 시계**이고 아래 `now`는 **앱 서버 시계**다. 앱이 조금이라도 앞서면
 * 방금 발행한 글이 그 차이만큼 anon 조회에서 막힌다 — 실측으로 시계 차이
 * 약 0.4~0.9초, 가시화까지 약 1.2초였다(§2.7). 사람 손으로는 재현되지 않지만
 * 발행 직후 조회하는 클라이언트(E2E · 자동화 · API)는 정확히 이 창에 빠진다.
 *
 * 5초는 관측된 차이의 5배 이상이면서, 목록 정렬과 표시(날짜 단위)에는
 * 아무 영향이 없는 값이다. 예약 발행(미래 시각)은 `current`가 보존되므로
 * 이 마진을 타지 않는다.
 */
const CLOCK_SKEW_MARGIN_MS = 5_000;

/**
 * 발행 시각 결정 규칙.
 *
 * 이미 발행된 글을 수정할 때 발행 시각을 현재로 덮으면 목록 정렬이 뒤집혀
 * 오래된 글이 "최신"으로 올라온다. 기존 값이 있으면 반드시 보존한다.
 */
export function resolvePublishedAt(
  published: boolean,
  current: string | null,
  now: Date = new Date(),
): string | null {
  if (!published) return null;
  return current ?? new Date(now.getTime() - CLOCK_SKEW_MARGIN_MS).toISOString();
}
