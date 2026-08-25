import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

/**
 * 루트 404. `src/app/layout.tsx`가 Header/Footer를 렌더하고 이 파일은 그 안의
 * `<main>`에서 렌더되므로, 카드·뉴스 상세의 `notFound()`와 미매칭 URL을 이
 * 한 파일이 모두 덮는다 — 라우트 그룹별로 따로 둘 필요가 없다 (plan.md T1.12-4).
 *
 * T1.10의 "상업 서비스로 보이게" 방향과 이어진다 — Next 기본 404(흰 배경에
 * "404 | This page could not be found.")를 그대로 노출하지 않는다.
 */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <EmptyState
        icon={<SearchX className="size-10" aria-hidden />}
        title="페이지를 찾을 수 없습니다"
        description="주소가 바뀌었거나, 삭제된 카드·기사일 수 있습니다."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/cards">도감으로</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">홈으로</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
