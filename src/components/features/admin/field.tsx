"use client";

import type { ReactNode } from "react";

import type { FormStatus } from "@/components/features/admin/use-admin-form";
import { CONTROL_CLASS } from "@/lib/utils/form";

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={CONTROL_CLASS} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} rows={3} className={CONTROL_CLASS} />;
}

export function NativeSelect(props: React.ComponentProps<"select">) {
  return <select {...props} className={CONTROL_CLASS} />;
}

/**
 * 저장 결과 안내.
 * role과 data-testid를 한곳에서 정하므로 폼마다 어긋나지 않는다.
 */
export function StatusMessage({ status }: { status: FormStatus | null }) {
  if (!status) return null;
  const isError = status.kind === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      data-testid={isError ? "form-error" : "form-status"}
      className={isError ? "text-sm text-destructive" : "text-sm"}
    >
      {status.text}
    </p>
  );
}
