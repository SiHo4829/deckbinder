import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminLoginForm } from "@/components/features/admin/admin-login-form";

export const metadata: Metadata = { title: "관리자 로그인", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-20">
      <h1 className="text-lg font-semibold tracking-tight">관리자 로그인</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        카드 등록은 관리자 토큰이 필요합니다.
      </p>
      {/* AdminLoginForm이 useSearchParams(next 파라미터)를 쓴다.
          경계가 없으면 next build의 정적 프리렌더가 실패한다 (plan §2.4). */}
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
