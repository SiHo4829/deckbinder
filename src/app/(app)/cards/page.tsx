import type { Metadata } from "next";
import { Suspense } from "react";

import { CardBrowser } from "@/components/features/cards/card-browser";
import { CardGridSkeleton } from "@/components/features/cards/card-grid";

export const metadata: Metadata = {
  title: "카드 도감",
  description:
    "속성 · 레어도 · 발매 팩 · 효과 키워드로 포켓몬 · 원피스 카드를 검색합니다.",
};

export default function CardsPage() {
  return (
    // nuqs가 useSearchParams를 쓰므로 정적 프리렌더에는 Suspense 경계가 필요하다.
    // 경계가 없으면 build 단계에서 프리렌더가 실패한다.
    <Suspense fallback={<CardGridSkeleton />}>
      <CardBrowser />
    </Suspense>
  );
}
