"use client";

import { useState } from "react";

export interface FormStatus {
  kind: "error" | "ok";
  text: string;
}

interface Options<T> {
  /** 빈 폼 값. 저장 성공 후 여기로 되돌린다. */
  empty: T;
  initial?: Partial<T>;
  endpoint: string;
  /** 폼 필드가 아닌 값을 함께 보낼 때 쓴다 (예: 키워드 id 배열). */
  extra?: () => Record<string, unknown>;
  /** 저장 성공 시 안내 문구 */
  successText: (values: T) => string;
  /**
   * 저장 성공 후 유지할 값. 같은 세트를 연속 입력하는 경우가 잦아
   * 선택 항목을 매번 다시 고르지 않게 한다.
   */
  keepOnSuccess?: (values: T) => Partial<T>;
  onSuccess?: () => void;
}

/**
 * 관리자 등록 폼의 공통 동작.
 * set-form / card-form이 동일한 제출·에러 처리를 반복하고 있어 한곳으로 모았다.
 */
export function useAdminForm<T extends Record<string, string>>({
  empty,
  initial,
  endpoint,
  extra,
  successText,
  keepOnSuccess,
  onSuccess,
}: Options<T>) {
  const [values, setValues] = useState<T>({ ...empty, ...initial });
  const [status, setStatus] = useState<FormStatus | null>(null);
  const [pending, setPending] = useState(false);

  function setValue(key: keyof T, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** 여러 필드를 한 번에 바꾼다 (예: 게임을 바꾸면 세트 선택을 비운다). */
  function patch(next: Partial<T>) {
    setValues((prev) => ({ ...prev, ...next }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, ...(extra?.() ?? {}) }),
      });
    } catch {
      setStatus({ kind: "error", text: "서버에 연결하지 못했습니다." });
      setPending(false);
      return;
    }

    const body = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setStatus({ kind: "error", text: body.error ?? "저장하지 못했습니다." });
      setPending(false);
      return;
    }

    setStatus({ kind: "ok", text: successText(values) });
    setValues((prev) => ({ ...empty, ...(keepOnSuccess?.(prev) ?? {}) }));
    setPending(false);
    onSuccess?.();
  }

  return { values, setValue, patch, status, pending, submit };
}
