import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * 페이지 번호 이동. 순수 표시 컴포넌트 — 페이지 수 계산과 URL 조립은 호출부 책임이다.
 *
 * 도메인 특화 데이터(검색어 · 필터)를 모르게 두려고 `buildHref`로 링크 생성을
 * 넘겨받는다. `AdminTable`을 만들지 않기로 한 것과 같은 이유로, 표 자체는
 * 감싸지 않고 목록 페이지 하단에 독립적으로 배치하는 조각으로 남겨 둔다.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: {
  /** 1부터 시작하는 현재 페이지 */
  page: number;
  totalPages: number;
  /** 페이지 번호로 이동할 링크. 검색어 등 다른 파라미터 보존은 호출부 책임이다. */
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="페이지 이동"
      data-testid="admin-pagination"
      className={cn("flex items-center justify-center gap-4 text-sm", className)}
    >
      {hasPrev ? (
        <Link
          href={buildHref(page - 1)}
          className="rounded px-2 py-1 underline-offset-4 hover:underline"
        >
          이전
        </Link>
      ) : (
        <span className="px-2 py-1 text-muted-foreground/40">이전</span>
      )}

      <span className="text-muted-foreground">
        {page} / {totalPages}
      </span>

      {hasNext ? (
        <Link
          href={buildHref(page + 1)}
          className="rounded px-2 py-1 underline-offset-4 hover:underline"
        >
          다음
        </Link>
      ) : (
        <span className="px-2 py-1 text-muted-foreground/40">다음</span>
      )}
    </nav>
  );
}
