import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";

export const metadata: Metadata = {
  title: "뉴스",
  description: "포켓몬 · 원피스 TCG 신제품, 대회, 메타 소식을 전합니다.",
};

// 플레이스홀더 — 목록/상세(ISR)와 콘텐츠 작성은 T1.9에서 구현한다.
export default function NewsPage() {
  return (
    <EmptyState
      title="뉴스 준비 중"
      description="신제품 · 대회 · 메타 소식을 정리해 올릴 예정입니다."
    />
  );
}
