import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/common/empty-state";

describe("EmptyState", () => {
  it("제목을 heading으로 렌더링한다", () => {
    render(<EmptyState title="검색 결과가 없습니다" />);

    expect(
      screen.getByRole("heading", { name: "검색 결과가 없습니다" }),
    ).toBeInTheDocument();
  });

  it("설명이 주어지면 함께 렌더링한다", () => {
    render(<EmptyState title="결과 없음" description="필터를 조정해 보세요" />);

    expect(screen.getByText("필터를 조정해 보세요")).toBeInTheDocument();
  });

  it("설명이 없으면 설명 영역을 렌더링하지 않는다", () => {
    render(<EmptyState title="결과 없음" />);

    expect(screen.queryByTestId("empty-state-description")).not.toBeInTheDocument();
  });
});
