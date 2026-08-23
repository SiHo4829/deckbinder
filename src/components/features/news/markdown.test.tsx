import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "@/components/features/news/markdown";

/**
 * 이 테스트는 XSS 방어를 고정하는 것이 목적이다.
 * 누군가 `rehype-raw`를 추가하면 여기서 깨져야 한다.
 */
describe("Markdown — 보안", () => {
  it("script 태그를 실행 가능한 요소로 만들지 않는다", () => {
    const { container } = render(
      <Markdown>{`본문\n\n<script>alert(1)</script>`}</Markdown>,
    );

    expect(container.querySelector("script")).toBeNull();
  });

  it("원시 HTML을 요소로 렌더하지 않는다", () => {
    const { container } = render(
      <Markdown>{`<img src=x onerror=alert(1)>`}</Markdown>,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  // react-markdown의 urlTransform이 위험한 스킴을 아예 제거한다.
  // href가 사라져 link 역할조차 노출되지 않는 것이 정상 동작이다.
  it("javascript: 링크를 무력화한다", () => {
    const { container } = render(<Markdown>{`[클릭](javascript:alert(1))`}</Markdown>);

    expect(screen.getByText("클릭")).toBeInTheDocument();
    for (const a of container.querySelectorAll("a")) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    }
  });

  it("data: 스킴 링크도 무력화한다", () => {
    const { container } = render(
      <Markdown>{`[클릭](data:text/html,<script>alert(1)</script>)`}</Markdown>,
    );

    for (const a of container.querySelectorAll("a")) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/^data:/i);
    }
  });
});

describe("Markdown — 렌더링", () => {
  it("제목을 heading으로 렌더한다", () => {
    render(<Markdown>{`## 소제목`}</Markdown>);

    expect(screen.getByRole("heading", { name: "소제목", level: 2 })).toBeInTheDocument();
  });

  it("목록을 렌더한다", () => {
    render(<Markdown>{`- 하나\n- 둘`}</Markdown>);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("GFM 표를 렌더한다 (remark-gfm)", () => {
    render(<Markdown>{`| 카드 | 가격 |\n| --- | --- |\n| 루피 | 3000 |`}</Markdown>);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "루피" })).toBeInTheDocument();
  });

  it("외부 링크에 noopener를 붙이고 새 창으로 연다", () => {
    render(<Markdown>{`[외부](https://example.com)`}</Markdown>);

    const link = screen.getByRole("link", { name: "외부" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("내부 링크는 새 창으로 열지 않는다", () => {
    render(<Markdown>{`[도감](/cards)`}</Markdown>);

    expect(screen.getByRole("link", { name: "도감" })).not.toHaveAttribute("target");
  });
});
