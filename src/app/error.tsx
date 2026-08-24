"use client";

import { useEffect } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      title="문제가 발생했습니다"
      description="일시적인 오류일 수 있습니다. 다시 시도해 주세요."
      action={
        <Button variant="outline" onClick={reset}>
          다시 시도
        </Button>
      }
    />
  );
}
