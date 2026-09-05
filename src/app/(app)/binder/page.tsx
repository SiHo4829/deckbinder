import { BookMarked } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/common/coming-soon";

export const metadata: Metadata = {
  title: "내 바인더",
  description: "소장 카드와 위시리스트를 가상 3공 바인더로 관리합니다.",
};

export default function BinderPage() {
  return (
    <ComingSoon
      icon={BookMarked}
      eyebrow="곧 공개"
      title="내 바인더"
      description="소장 카드와 위시리스트를 가상 3공 바인더에 정리하고, 자체 수집 점수로 모은 것을 확인할 수 있게 준비하고 있습니다."
      features={[
        {
          title: "가상 3공 바인더",
          body: "실제 바인더처럼 페이지를 넘기며 소장 카드를 정리합니다.",
        },
        {
          title: "위시리스트",
          body: "노리는 카드를 담아 두고 모으는 진행 상황을 확인합니다.",
        },
        {
          title: "공유 링크",
          body: "내 바인더를 링크 하나로 커뮤니티에 공유합니다.",
        },
      ]}
    />
  );
}
