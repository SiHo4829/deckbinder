import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("클래스 문자열을 합친다", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("falsy 값을 무시한다", () => {
    expect(cn("px-2", false, undefined, null, "py-1")).toBe("px-2 py-1");
  });

  it("조건부 객체 표기를 지원한다", () => {
    expect(cn("px-2", { "text-red-500": true, "text-blue-500": false })).toBe(
      "px-2 text-red-500",
    );
  });

  it("충돌하는 Tailwind 클래스는 뒤에 온 값이 이긴다", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm text-muted-foreground", "text-lg")).toBe(
      "text-muted-foreground text-lg",
    );
  });
});
