import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CardImage } from "@/components/features/cards/card-image";
import { SimilarCards } from "@/components/features/cards/similar-cards";
import { fetchCardAlternatives, fetchCardDetail } from "@/lib/cards/queries";
import { cardDisplayName } from "@/types/card";

// 이 라우트는 동적이다 — 카드를 고치거나 지운 직후 첫 방문에 그것이 반영되어야
// 하기 때문이다. on-demand ISR(revalidate = 3600)이었을 때는 그 세그먼트 값이
// Supabase 조회 fetch까지 태그 없는 Data Cache 항목으로 만들었고, 그 항목이
// 어떤 무효화로도 비워지지 않아 **삭제한 카드가 최대 1시간 동안 200을 계속
// 돌려줬다**(§2.7 — 실측). 색인은 SSR이라 그대로다.
//
// 빌드에서 잃는 것은 없다 — generateStaticParams는 빈 배열을 반환해 애초에
// 아무것도 프리렌더하지 않았고, 빌드 표의 `●`는 "첫 요청에 생성 후 캐시"였다.
// 그 캐시가 바로 위 사고의 본체다.
export const dynamic = "force-dynamic";

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
    <div className="flex flex-col gap-8 py-2">
      <nav className="text-sm text-muted-foreground">
        <Link href="/cards" className="underline-offset-4 hover:underline">
          카드 도감
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-4">
          {/* 이미지가 없는 카드가 기본이라고 보고 그린다 (plan §4.4). */}
          <div className="aspect-card overflow-hidden rounded-xl border bg-surface-raised shadow-sm">
            <CardImage card={card} showCode priority />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">{card.code}</p>
              {card.rarity ? (
                <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium">
                  {card.rarity}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
              {name}
            </h1>
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
