import Link from "next/link";
import type { ReactNode } from "react";

// 관리자 화면은 색인 대상이 아니다.
export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <nav className="mb-8 flex gap-4 border-b pb-3 text-sm">
        <Link href="/admin" className="hover:underline">
          대시보드
        </Link>
        <Link href="/admin/sets" className="hover:underline">
          세트 등록
        </Link>
        <Link href="/admin/keywords" className="hover:underline">
          키워드 등록
        </Link>
        <Link href="/admin/cards" className="hover:underline">
          카드 목록
        </Link>
        <Link href="/admin/cards/new" className="hover:underline">
          카드 등록
        </Link>
        <Link href="/admin/news" className="hover:underline">
          뉴스
        </Link>
      </nav>
      {children}
    </div>
  );
}
