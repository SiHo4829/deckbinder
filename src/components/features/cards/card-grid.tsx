"use client";

import { ImageOff } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { cardDisplayName, type CardListItem } from "@/types/card";

/** 게임 아이덴티티는 카드 종류가 아니라 게임에 붙는다. 종류는 중립 톤으로 둔다. */
const TYPE_LABEL: Record<string, string> = {
  Pokemon: "포켓몬",
  Trainer: "트레이너",
  Energy: "에너지",
  LEADER: "리더",
  CHARACTER: "캐릭터",
  EVENT: "이벤트",
  STAGE: "스테이지",
};

function CardTile({ card }: { card: CardListItem }) {
  const name = cardDisplayName(card);

  return (
    <article className="group">
      <Link href={`/cards/${card.id}`} className="block">
        {/* 일러스트가 주인공이다. 테두리는 얇게, 호버에만 반응한다. */}
        <div className="relative aspect-card overflow-hidden rounded-lg border bg-surface-raised transition-shadow group-hover:shadow-md">
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- 원격 호스트 정책 미확정(§9.3)
            <img
              src={card.image_url}
              alt={name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            // 이미지 없는 카드가 기본이다. 빈칸 대신 코드를 보여 정보로 만든다.
            <div className="card-placeholder flex h-full w-full flex-col items-center justify-center gap-2 p-3">
              <ImageOff className="size-5 text-muted-foreground/30" aria-hidden />
              <span className="text-center font-mono text-[10px] break-all text-muted-foreground/60">
                {card.code}
              </span>
            </div>
          )}

          {card.rarity ? (
            <span className="absolute top-2 right-2 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-medium text-background">
              {card.rarity}
            </span>
          ) : null}
        </div>

        <div className="mt-2 min-w-0 px-0.5">
          <h3
            className="truncate text-sm font-medium tracking-tight group-hover:underline"
            title={name}
          >
            {name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span className="font-mono">{card.code}</span>
            {card.card_type ? (
              <span className="ml-1.5">
                · {TYPE_LABEL[card.card_type] ?? card.card_type}
              </span>
            ) : null}
          </p>
        </div>
      </Link>
    </article>
  );
}

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5";

export function CardGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-card rounded-lg" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function CardGrid({ cards, className }: { cards: CardListItem[]; className?: string }) {
  return (
    <div className={cn(GRID, className)}>
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}
