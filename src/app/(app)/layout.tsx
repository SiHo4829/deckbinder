import type { ReactNode } from "react";

// 유틸리티 영역(도감 · 덱 · 바인더). 필터/그리드를 위해 넓은 컨테이너를 쓴다.
export default function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>;
}
