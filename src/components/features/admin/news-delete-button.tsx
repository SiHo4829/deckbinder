"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** 되돌릴 수 없는 작업이므로 한 번 더 확인받는다. */
export function NewsDeleteButton({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);

    const res = await fetch(`/api/admin/news/${postId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "삭제하지 못했습니다.");
      setPending(false);
      return;
    }

    router.push("/admin/news");
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        삭제
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          취소
        </Button>
        <Button variant="outline" onClick={handleDelete} disabled={pending}>
          {pending ? "삭제 중…" : `"${title}" 삭제`}
        </Button>
      </div>
      {error ? (
        <p role="alert" data-testid="form-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
