"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CONTROL_CLASS_SM } from "@/lib/utils/form";

export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // 여기서만 trim한다 — 서버(session.ts)가 다듬으면 "공백이 붙은 토큰도 유효"가 되어
    // 인증 비교가 느슨해진다. 다듬는 것은 입력의 일이지 검증의 일이 아니다.
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "로그인에 실패했습니다.");
      setPending(false);
      return;
    }

    // 로그인 화면에도 관리자 레이아웃의 nav가 렌더되므로, 프로덕션 빌드에서는
    // Next가 그 <Link>의 /admin을 비로그인 상태로 미리 가져간다. 그 프리페치 결과는
    // "로그인으로 리다이렉트"라, 먼저 버리지 않으면 로그인 직후 다시 튕긴다.
    // dev는 프리페치를 하지 않아 이 문제가 드러나지 않는다.
    router.refresh();
    router.push(params.get("next") ?? "/admin");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="admin-token" className="text-sm font-medium">
        관리자 토큰
      </label>
      <input
        id="admin-token"
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="off"
        className={CONTROL_CLASS_SM}
      />
      {error ? (
        <p role="alert" data-testid="form-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || token.trim().length === 0}>
        {pending ? "확인 중…" : "로그인"}
      </Button>
    </form>
  );
}
