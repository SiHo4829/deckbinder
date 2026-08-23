import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";

export const metadata: Metadata = {
  title: "카드 도감",
  description:
    "속성 · 레어도 · 발매 팩 · 효과 키워드로 포켓몬 · 원피스 카드를 검색합니다.",
};

// 플레이스홀더 — 검색/필터 UI는 T1.7, 상세는 T1.8에서 구현한다.
export default function CardsPage() {
  return (
    <EmptyState
      title="카드 도감 준비 중"
      description="속성 · 레어도 · 효과 키워드 검색을 준비하고 있습니다."
    />
  );
}
