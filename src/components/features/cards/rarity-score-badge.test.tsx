import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RarityScoreBadge } from "@/components/features/cards/rarity-score-badge";
import type { RarityScore } from "@/lib/domain/achievement/rarity-score";

/**
 * 컴포넌트 파일(`rarity-score-badge.tsx`)은 고치지 않는다 — designer 산출물이다
 * (plan §4.13 T2.15). 이 파일은 그 산출물에 테스트만 붙인다.
 */
describe("RarityScoreBadge", () => {
  it("점수가 있으면 숫자와 밴드 표기어가 보인다", () => {
    const score: RarityScore = {
      score: 55,
      band: "scarce",
      reasons: [{ kind: "rarity_label", label: "SR", weight: 55 }],
      undecidable: null,
    };

    render(<RarityScoreBadge {...score} />);

    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("· 꽤 드묾")).toBeInTheDocument();
  });

  it("score === null이면 산출 불가가 보이고 자리가 비지 않는다", () => {
    const score: RarityScore = {
      score: null,
      band: null,
      reasons: [],
      undecidable: "rarity_unknown",
    };

    render(<RarityScoreBadge {...score} />);

    expect(screen.getByText("산출 불가")).toBeInTheDocument();
  });

  it("undecidable === rarity_unknown이면 레어도 문장을 그린다", () => {
    const score: RarityScore = {
      score: null,
      band: null,
      reasons: [],
      undecidable: "rarity_unknown",
    };

    render(<RarityScoreBadge {...score} />);

    expect(
      screen.getByText("레어도 라벨을 확인할 수 없어 점수를 낼 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("undecidable === set_unknown이면 세트 문장을 그린다", () => {
    const score: RarityScore = {
      score: null,
      band: null,
      reasons: [],
      undecidable: "set_unknown",
    };

    render(<RarityScoreBadge {...score} />);

    expect(
      screen.getByText("세트 안에서의 위치를 확인할 수 없어 점수를 낼 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("reasons에 없는 근거를 화면이 덧붙이지 않는다 — population 근거가 없으면 감정 관련 문구가 0건", () => {
    const score: RarityScore = {
      score: 35,
      band: "rare",
      reasons: [{ kind: "rarity_label", label: "R", weight: 35 }],
      undecidable: null,
    };

    render(<RarityScoreBadge {...score} />);

    expect(screen.queryByText(/감정 등록/)).not.toBeInTheDocument();
  });

  it("고지 문구가 그려진다", () => {
    const score: RarityScore = {
      score: 5,
      band: "common",
      reasons: [{ kind: "rarity_label", label: "C", weight: 5 }],
      undecidable: null,
    };

    render(<RarityScoreBadge {...score} />);

    expect(
      screen.getByText(/덱바인더가 우리 카드 DB의 정보만으로 자체 계산한 참고용 값입니다/),
    ).toBeInTheDocument();
  });
});
