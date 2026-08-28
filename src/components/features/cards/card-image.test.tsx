import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardImage } from "@/components/features/cards/card-image";
import type { CardListItem } from "@/types/card";

type ImageCard = Pick<
  CardListItem,
  "code" | "image_url" | "name_ko" | "name_ja" | "attribute"
>;

const card = (over: Partial<ImageCard> = {}): ImageCard => ({
  code: "OP01-001",
  image_url: "https://example.test/op01-001.png",
  name_ko: "몽키 D 루피",
  name_ja: "モンキー・D・ルフィ",
  attribute: "red",
  ...over,
});

/** 폴백 프레임이 떴는가 — 카드명이 텍스트로 보이는 것이 유일한 필수 조건이다 (plan §9.4 ⓑ) */
const fallback = () => screen.queryByTestId("card-fallback-frame");

describe("CardImage — 핫링크", () => {
  it("이미지가 있으면 img를 렌더링한다", () => {
    render(<CardImage card={card()} />);

    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.test/op01-001.png");
    expect(fallback()).not.toBeInTheDocument();
  });

  // plan §0.1 ⓒ — 값이 확정됐다. 실제로 실려 나가는지는 여기서만 확인된다.
  it("img에 referrerPolicy=no-referrer를 싣는다", () => {
    render(<CardImage card={card()} />);

    expect(screen.getByRole("img")).toHaveAttribute("referrerpolicy", "no-referrer");
  });
});

// 완료 기준 ⓓ — 진입 조건 두 가지를 각각 단언한다.
describe("CardImage — 폴백 진입 조건 둘", () => {
  it("① image_url이 null이면 폴백 프레임을 그린다", () => {
    render(<CardImage card={card({ image_url: null })} />);

    expect(fallback()).toBeInTheDocument();
    expect(screen.getByText("몽키 D 루피")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("② 로드에 실패하면(onError) 폴백 프레임을 그린다", () => {
    render(<CardImage card={card()} />);
    expect(fallback()).not.toBeInTheDocument();

    fireEvent.error(screen.getByRole("img"));

    expect(fallback()).toBeInTheDocument();
    expect(screen.getByText("몽키 D 루피")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  // 완료 기준 ⓑ — 분기를 나누면 실패 경로가 드물게만 실행돼 깨져도 모르는 코드가 된다.
  it("두 진입 조건이 같은 화면을 낸다", () => {
    const { container: byNull } = render(<CardImage card={card({ image_url: null })} showCode />);
    const nullHtml = byNull.innerHTML;

    const { container: byError } = render(<CardImage card={card()} showCode />);
    fireEvent.error(screen.getAllByRole("img")[0]);

    expect(byError.innerHTML).toBe(nullHtml);
  });
});

// 완료 기준 ⓔ — 프레임은 카드명 하나로도 성립해야 한다.
describe("CardImage — 폴백 프레임의 표시 항목", () => {
  it("카드명은 name_ko가 없으면 name_ja로 낸다", () => {
    render(<CardImage card={card({ image_url: null, name_ko: null })} />);

    expect(screen.getByText("モンキー・D・ルフィ")).toBeInTheDocument();
  });

  it("showCode가 true일 때만 code를 보인다", () => {
    const { unmount } = render(<CardImage card={card({ image_url: null })} />);
    expect(screen.queryByText("OP01-001")).not.toBeInTheDocument();
    unmount();

    render(<CardImage card={card({ image_url: null })} showCode />);
    expect(screen.getByText("OP01-001")).toBeInTheDocument();
  });

  // 속성은 자유 텍스트다(plan §4.1 · §2.8-6). 번역하지 않고 원문을 그대로 보인다 —
  // 필터 패널도 패싯 값을 그대로 쓰고 있어 두 화면의 표기가 갈리면 안 된다.
  it("속성은 원문 그대로 보인다", () => {
    render(<CardImage card={card({ image_url: null, attribute: "red" })} />);
    expect(screen.getByText("red")).toBeInTheDocument();
  });

  it("표기가 통일돼 있지 않은 값도 그대로 보인다", () => {
    render(<CardImage card={card({ image_url: null, attribute: "적색" })} />);
    expect(screen.getByText("적색")).toBeInTheDocument();
  });

  it("속성이 null이어도 프레임이 성립한다 — 카드명이 항상 있다", () => {
    render(<CardImage card={card({ image_url: null, attribute: null })} />);

    expect(fallback()).toBeInTheDocument();
    expect(screen.getByText("몽키 D 루피")).toBeInTheDocument();
  });
});
