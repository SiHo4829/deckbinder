import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";

export const metadata: Metadata = {
  title: "덱 레시피",
  description: "대회 우승 덱과 메타 티어별 대표 레시피를 확인합니다.",
};

// 플레이스홀더 — 목록/티어표는 T2.4, 빌더·시뮬레이터는 T2.5에서 구현한다.
export default function DecksPage() {
  return (
    <EmptyState
      title="덱 레시피 준비 중"
      description="우승 덱 · 메타 티어표와 첫 손패 시뮬레이터를 준비하고 있습니다."
    />
  );
}
