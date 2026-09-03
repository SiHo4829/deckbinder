import {
  ArrowRight,
  Award,
  BookOpen,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { CardImage } from "@/components/features/cards/card-image";
import { Button } from "@/components/ui/button";
import { fetchCatalogStats, fetchShowcaseCards } from "@/lib/home/queries";
import { fetchPublishedPosts } from "@/lib/news/queries";
import { formatKoreanDate } from "@/lib/utils/date";
import type { CardListItem } from "@/types/card";

export const revalidate = 600;

const FEATURES = [
  {
    icon: BookOpen,
    title: "카드 도감",
    body: "속성 · 레어도 · 발매 팩에 더해 드로우 · 버림 · 카운터 같은 효과 키워드로 찾습니다. 여러 키워드를 고르면 모두 가진 카드만 남습니다.",
    href: "/cards",
    cta: "도감 둘러보기",
  },
  {
    icon: Layers,
    title: "덱 레시피 · 시뮬레이터",
    body: "우승 덱과 메타 티어를 확인하고, 첫 손패를 실제로 뽑아 보며 덱 구성 확률을 확인합니다.",
    href: "/decks",
    cta: "덱 살펴보기",
  },
  {
    icon: Award,
    title: "수집 점수",
    body: "레어도 라벨 · 세트 안 희소성 · 인쇄본 수 같은 우리 DB의 사실만으로 자체 수집 점수를 계산합니다.",
    href: "/cards",
    cta: "수집 점수 보기",
  },
] as const;

function ShowcaseTile({
  card,
  className,
}: {
  card: CardListItem;
  className?: string;
}) {
  return (
    <Link
      href={`/cards/${card.id}`}
      className={`group relative block aspect-card overflow-hidden rounded-lg border bg-surface-raised ${className ?? ""}`}
    >
      <CardImage card={card} hoverClassName="group-hover:scale-105" />
    </Link>
  );
}

export default async function HomePage() {
  const [cards, stats, posts] = await Promise.all([
    fetchShowcaseCards(10),
    fetchCatalogStats(),
    fetchPublishedPosts(3),
  ]);

  return (
    <div className="flex flex-col">
      {/* ── 히어로 ─────────────────────────────────────── */}
      <section className="border-b bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
          <div className="max-w-xl">
            <p className="eyebrow">포켓몬 · 원피스 TCG</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              수집과 플레이를 하나로
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              흩어진 카드 정보를 한곳에 모았습니다. 효과 키워드로 원하는 카드를 찾고,
              덱을 짜고, 자체 수집 점수로 내 컬렉션의 가치를 확인하세요.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/cards">
                  카드 도감 열기
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/news">최신 소식</Link>
              </Button>
            </div>

            {stats.cards > 0 ? (
              <dl className="mt-10 flex gap-8 border-t pt-6">
                <div>
                  <dt className="text-xs text-muted-foreground">등록 카드</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {stats.cards.toLocaleString("ko-KR")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">발매 팩</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {stats.sets.toLocaleString("ko-KR")}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>

          {/* 카드 일러스트가 주인공. 데이터가 없으면 이 영역을 감춘다. */}
          {cards.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {cards.slice(0, 6).map((card, i) => (
                <ShowcaseTile
                  key={card.id}
                  card={card}
                  className={i % 3 === 1 ? "translate-y-6" : undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── 기능 ───────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="flex flex-col rounded-xl border bg-surface-raised p-6"
            >
              <f.icon className="size-5 text-muted-foreground" aria-hidden />
              <h2 className="mt-4 text-base font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
              <Link
                href={f.href}
                className="mt-5 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
              >
                {f.cta}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ── 제품 원칙 ──────────────────────────────────── */}
      <section className="border-y bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
          <div className="flex gap-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                가격을 표시하지 않습니다
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                카드는 투자 상품이 아닙니다. 그래프도 등락률도 없고, 애초에
                가격 자체를 다루지 않습니다.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                가치는 수집 점수로 보입니다
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                레어도 라벨 · 세트 안 희소성 · 인쇄본 수 같은 우리 DB의 사실로만
                계산하고, 왜 그 점수인지도 함께 보여줍니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 최신 소식 ──────────────────────────────────── */}
      {posts.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">최신 소식</h2>
            <Link
              href="/news"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              전체 보기
            </Link>
          </div>

          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/news/${post.slug}`}
                  className="flex h-full flex-col rounded-xl border bg-surface-raised p-5 transition-colors hover:bg-accent/40"
                >
                  <time
                    dateTime={post.published_at}
                    className="text-xs text-muted-foreground"
                  >
                    {formatKoreanDate(post.published_at)}
                  </time>
                  <h3 className="mt-2 font-medium tracking-tight">{post.title}</h3>
                  {post.summary ? (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {post.summary}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
