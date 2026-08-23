import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-surface px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground/40">{icon}</div> : null}
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p
          data-testid="empty-state-description"
          className="max-w-sm text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
