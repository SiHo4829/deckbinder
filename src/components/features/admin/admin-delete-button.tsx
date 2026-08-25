"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * 되돌릴 수 없는 작업이므로 한 번 더 확인받는다.
 *
 * `news-delete-button.tsx`(NewsDeleteButton)를 일반화했다 — 두 번째 사용처(카드 삭제,
 * T1.12-2)가 생긴 지금이 정확한 일반화 시점이다(T1.11의 `CardImage` 통합과 같은 판단).
 * `endpoint`/`redirectTo`/`label` 세 값만 호출부가 넘기면 된다.
 *
 * **항상 자신만의 컨테이너(`data-testid="admin-delete-zone"`) 안에서 렌더한다.**
 * 카드 수정 화면은 이 컴포넌트와 등록·수정 폼(`CardForm`)이 한 페이지에 공존하고,
 * 폼의 `StatusMessage`도 실패 시 같은 `data-testid="form-error"`를 쓴다. 두 곳이
 * 동시에 에러를 내면 전역 셀렉터는 "resolved to 2 elements"로 깨진다(plan.md §2.7,
 * T1.10의 `listitem` 사고와 같은 유형). E2E는 `admin-delete-zone` 안에서만
 * `form-error`를 찾으면 이 문제를 피할 수 있다.
 *
 * 호출부는 **이 컴포넌트를 등록·수정 폼의 `<form>` 바깥에 형제로 렌더해야 한다.**
 * `<form>` 내부에 두면 버튼의 기본 `type`이 없을 때 `submit`으로 동작해 클릭 시
 * 폼이 함께 제출될 수 있다 — 안전장치로 아래 버튼엔 `type="button"`을 명시해 두었지만,
 * 배치 자체도 `<form>` 밖을 원칙으로 한다.
 */
export function AdminDeleteButton({
  endpoint,
  redirectTo,
  label,
}: {
  /** DELETE 요청을 보낼 API 경로. 예: `/api/admin/cards/${cardId}` */
  endpoint: string;
  /** 삭제 성공 후 이동할 목록 경로. 예: `/admin/cards` */
  redirectTo: string;
  /** 확인 버튼 문구에 넣을 대상 이름. 예: 카드 코드, 기사 제목 */
  label: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);

    const res = await fetch(endpoint, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "삭제하지 못했습니다.");
      setPending(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <section
      data-testid="admin-delete-zone"
      aria-label="삭제"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-destructive">삭제</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>

        {!confirming ? (
          <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
            삭제
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "삭제 중…" : `"${label}" 삭제`}
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" data-testid="form-error" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
