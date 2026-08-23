"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * 효과 키워드 필터.
 * 여러 개를 고르면 **모두** 가진 카드만 남는다(AND 조합).
 * 개수가 많지 않고 한눈에 보이는 편이 나아서 드롭다운 대신 토글 칩을 쓴다.
 */
export function KeywordFilter({
  keywords,
  selected,
  onToggle,
  onClear,
}: {
  keywords: { code: string; label: string }[];
  selected: string[];
  onToggle: (code: string) => void;
  onClear: () => void;
}) {
  if (keywords.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium">효과 키워드</span>
        <span className="text-xs text-muted-foreground">
          여러 개를 고르면 모두 가진 카드만 남습니다
        </span>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-xs text-muted-foreground underline"
          >
            초기화
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {keywords.map((k) => {
          const active = selected.includes(k.code);
          return (
            <button
              key={k.code}
              type="button"
              onClick={() => onToggle(k.code)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {active ? <Check className="size-3" aria-hidden /> : null}
              {k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
