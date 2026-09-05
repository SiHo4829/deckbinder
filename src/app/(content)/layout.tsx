import type { ReactNode } from "react";

// 검색 색인 대상 콘텐츠 영역. 본문 가독성을 위해 좁은 단일 컬럼을 쓴다.
export default function ContentLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-10">{children}</div>;
}
