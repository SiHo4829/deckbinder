import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * 아직 열지 않은 기능 안내.
 *
 * "준비 중" 한 줄만 두면 미완성 사이트로 보인다. 무엇을 만들고 있는지
 * 구체적으로 밝히고 지금 쓸 수 있는 곳으로 보낸다.
 */
export function ComingSoon({
  icon: Icon,
  eyebrow,
  title,
  description,
  features,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  features: { title: string; body: string }[];
}) {
  return (
    <div className="py-6">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <div className="mt-3 flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-surface-raised">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <li key={f.title} className="rounded-xl border bg-surface-raised p-5">
            <h2 className="text-sm font-semibold tracking-tight">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-5">
        <p className="flex-1 text-sm text-muted-foreground">
          지금은 카드 도감을 이용하실 수 있습니다.
        </p>
        <Button asChild variant="outline">
          <Link href="/cards">카드 도감 열기</Link>
        </Button>
      </div>
    </div>
  );
}
