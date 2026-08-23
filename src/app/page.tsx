import Link from "next/link";

import { mainNav } from "@/lib/navigation";

// 홈 셸 — 메타 요약 · 신규 카드 · 뉴스 피드는 T1.7 이후 채운다.
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          수집과 플레이를 하나로
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          덱바인더는 포켓몬 · 원피스 TCG 플레이어와 컬렉터를 위한 서포팅
          플랫폼입니다. 카드 도감과 덱 시뮬레이터, 일본 중고 매물 조회, 디지털
          바인더를 한곳에서 제공합니다.
        </p>
      </section>

      <nav className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
