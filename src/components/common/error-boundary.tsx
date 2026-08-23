"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

type FallbackRenderer = (error: Error, reset: () => void) => ReactNode;

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 노드를 주면 그대로, 함수를 주면 에러와 reset을 넘겨 호출한다. */
  fallback?: ReactNode | FallbackRenderer;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 기능 단위를 감싸는 클라이언트 에러 경계.
 * 라우트 전체 에러는 app/error.tsx가 담당하고, 이 컴포넌트는
 * 페이지 일부만 실패했을 때 나머지 UI를 살리는 용도다.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error === null) {
      return children;
    }

    if (typeof fallback === "function") {
      return fallback(error, this.reset);
    }

    if (fallback !== undefined) {
      return fallback;
    }

    return (
      <EmptyState
        title="문제가 발생했습니다"
        description="잠시 후 다시 시도해 주세요."
        action={
          <Button variant="outline" onClick={this.reset}>
            다시 시도
          </Button>
        }
      />
    );
  }
}
