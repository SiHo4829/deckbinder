import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLoginForm } from "@/components/features/admin/admin-login-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("AdminLoginForm — 제출 직전 trim (E-4)", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
  });

  it("뒤에 공백/줄바꿈이 붙은 토큰을 제출하면 fetch body의 토큰이 다듬어져 있다", async () => {
    render(<AdminLoginForm />);

    const input = screen.getByLabelText("관리자 토큰");
    fireEvent.change(input, { target: { value: "secret-token \n" } });

    const button = screen.getByRole("button", { name: /로그인/ });
    fireEvent.click(button);

    expect(fetch).toHaveBeenCalledTimes(1);
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string) as { token: string };
    expect(body.token).toBe("secret-token");
  });

  it("공백만 입력하면 제출 버튼이 비활성 상태로 남는다", () => {
    render(<AdminLoginForm />);

    const input = screen.getByLabelText("관리자 토큰");
    fireEvent.change(input, { target: { value: "   " } });

    const button = screen.getByRole("button", { name: /로그인/ });
    expect(button).toBeDisabled();
  });
});
