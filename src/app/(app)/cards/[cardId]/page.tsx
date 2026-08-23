import { ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BasePriceBadge } from "@/components/features/cards/base-price-badge";
import { SimilarCards } from "@/components/features/cards/similar-cards";
import { fetchCardAlternatives, fetchCardDetail } from "@/lib/cards/queries";
import { cardDisplayName } from "@/types/card";

// 도감 상세는 색인 대상이다. 카드가 많아 빌드 시 전부 생성하지는 않고,
// 첫 요청에서 렌더한 뒤 캐시한다(on-demand ISR).
export const revalidate = 3600;

/**
 * 빈 배열을 반환해 빌드 시에는 아무것도 생성하지 않는다.
 * generateStaticParams 자체가 없으면 동적 라우트는 요청마다 렌더되지만,
 * 있으면 dynamicParams(기본 true)로 첫 요청에 생성한 뒤 캐시된다.
 * 카드가 수천 장이 될 수 있어 빌드 시간을 늘리지 않으려는 선택이다.
 */
export function generateStaticParams() {
  return [];
}

// 서버 컴포넌트로 직접 조회한다 (CLAUDE.md: RSC 기본).
export async function generateMetadata(
  props: PageProps<"/cards/[cardId]">,
): Promise<Metadata> {
  const { cardId } = await props.params;
  const card = await fetchCardDetail(cardId);
  if (!card) return { title: "카드를 찾을 수 없습니다" };

  const name = cardDisplayName(card);
  return {
    title: name,
    description: card.effect_text ?? `${card.code} · ${name}`,
  };
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 text-sm">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

export default async function CardDetailPage(props: PageProps<"/cards/[cardId]">) {
  const { cardId } = await props.params;
  const card = await fetchCardDetail(cardId);
  if (!card) notFound();

  const alternatives = await fetchCardAlternatives(card);
  const name = cardDisplayName(card);

  return (
    <div className="flex flex-col gap-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/cards" className="hover:underline">
          카드 도감
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-4">
          {/* 이미지가 없는 카드가 기본이라고 보고 그린다 (plan §4.4). */}
          <div className="flex aspect-[63/88] items-center justify-center rounded-lg border bg-muted">
            {card.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- 원격 호스트 정책 미확정(§9.3)
              <img
                src={card.image_url}
                alt={name}
                className="h-full w-full rounded-lg object-contain"
              />
            ) : (
              <ImageOff className="size-8 text-muted-foreground/50" aria-hidden />
            )}
          </div>

          {/* card_prices는 T2.8에 생긴다. 그때까지 항상 "산출 불가"다. */}
          <BasePriceBadge priceKrw={null} collectedAt={null} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <header>
            <p className="font-mono text-xs text-muted-foreground">{card.code}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h1>
            {card.name_ko && card.name_ko !== card.name_ja ? (
              <p className="mt-1 text-sm text-muted-foreground">{card.name_ja}</p>
            ) : null}
          </header>

          {card.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {card.keywords.map((k) => (
                <Link
                  key={k.code}
                  href={`/cards?game=${card.game?.code ?? ""}&keywords=${k.code}`}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {k.label}
                </Link>
              ))}
            </div>
          ) : null}

          {card.effect_text ? (
            <section>
              <h2 className="text-sm font-semibold">효과</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
                {card.effect_text}
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold">카드 정보</h2>
            <dl className="mt-2 divide-y">
              <Detail label="게임" value={card.game?.label ?? null} />
              <Detail
                label="발매 팩"
                value={card.set ? `${card.set.code} · ${card.set.label}` : null}
              />
              <Detail label="레어도" value={card.rarity} />
              <Detail label="속성" value={card.attribute} />
              <Detail label="종류" value={card.card_type} />
              <Detail label="세부 종류" value={card.sub_type} />
              <Detail label="영문명" value={card.name_en} />
            </dl>
          </section>

          <SimilarCards cards={alternatives} />
        </div>
      </div>
    </div>
  );
}
