import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "@/components/common/error-boundary";

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("터졌다");
  }
  return <p>정상 콘텐츠</p>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React가 경계에서 잡은 에러를 콘솔로 다시 던지므로 테스트 출력에서 걷어낸다.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("자식이 정상이면 자식을 렌더링한다", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("정상 콘텐츠")).toBeInTheDocument();
  });

  it("자식이 에러를 던지면 기본 폴백을 렌더링한다", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: /문제가 발생했습니다/ })).toBeInTheDocument();
    expect(screen.queryByText("정상 콘텐츠")).not.toBeInTheDocument();
  });

  it("fallback을 함수로 주면 에러를 전달한다", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>잡힘: {error.message}</p>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("잡힘: 터졌다")).toBeInTheDocument();
  });

  it("onError 콜백으로 에러를 알린다", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it("다시 시도를 누르면 경계를 초기화한다", async () => {
    const user = userEvent.setup();

    function Recoverable() {
      return (
        <ErrorBoundary fallback={(_error, reset) => <button onClick={reset}>다시 시도</button>}>
          <Boom shouldThrow={false} />
        </ErrorBoundary>
      );
    }

    const { rerender } = render(
      <ErrorBoundary fallback={(_error, reset) => <button onClick={reset}>다시 시도</button>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    rerender(<Recoverable />);

    expect(screen.getByText("정상 콘텐츠")).toBeInTheDocument();
  });
});
