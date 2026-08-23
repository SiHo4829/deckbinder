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
  return current ?? now.toISOString();
}
