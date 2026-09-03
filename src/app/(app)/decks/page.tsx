import { Layers } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/common/coming-soon";

export const metadata: Metadata = {
  title: "덱 레시피",
  description: "대회 우승 덱과 메타 티어별 대표 레시피, 첫 손패 시뮬레이터를 제공합니다.",
};

export default function DecksPage() {
  return (
    <ComingSoon
      icon={Layers}
      eyebrow="곧 공개"
      title="덱 레시피 · 시뮬레이터"
      description="대회 우승 덱과 메타 티어를 정리하고, 첫 손패를 실제로 뽑아 보며 덱 구성을 검증할 수 있게 준비하고 있습니다."
      features={[
        {
          title: "우승 덱 · 메타 티어",
          body: "대회 입상 레시피와 티어별 대표 덱을 게임별로 정리합니다.",
        },
        {
          title: "첫 손패 드로우",
          body: "포켓몬 7장 · 원피스 5장. 게임별 규칙 그대로 뽑고 멀리건까지 시험합니다.",
        },
        {
          title: "필요 카드 도감 연결",
          body: "덱에 필요한 카드를 도감 상세로 바로 이어 줍니다.",
        },
      ]}
    />
  );
}
