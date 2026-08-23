import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";

export const metadata: Metadata = {
  title: "내 바인더",
  description: "소장 카드와 위시리스트를 가상 3공 바인더로 관리합니다.",
};

// 플레이스홀더 — 인증은 T3.1, 바인더 UI는 T3.3에서 구현한다.
export default function BinderPage() {
  return (
    <EmptyState
      title="내 바인더 준비 중"
      description="소장 카드와 위시리스트를 관리하는 디지털 바인더를 준비하고 있습니다."
    />
  );
}
