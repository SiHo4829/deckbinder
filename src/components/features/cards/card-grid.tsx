"use client";

import { ImageOff } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { cardDisplayName, type CardListItem } from "@/types/card";

const GAME_BADGE: Record<string, string> = {
  Pokemon: "bg-game-ptcg text-game-ptcg-foreground",
  Trainer: "bg-secondary text-secondary-foreground",
  Energy: "bg-muted text-muted-foreground",
};

function CardTile({ card }: { card: CardListItem }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border p-3">
      {/* TCGdex 일본어 카드에는 이미지가 없다(plan §4.4). 없는 게 기본이라고 보고 그린다. */}
      <div className="flex aspect-[63/88] items-center justify-center rounded-md bg-muted">
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 원격 호스트 정책 확정 전(§9.3)
          <img
            src={card.image_url}
            alt={cardDisplayName(card)}
            className="h-full w-full rounded-md object-contain"
            loading="lazy"
          />
        ) : (
          <ImageOff className="size-6 text-muted-foreground/50" aria-hidden />
        )}
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium" title={cardDisplayName(card)}>
          {cardDisplayName(card)}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{card.code}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {card.card_type ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px]",
              GAME_BADGE[card.card_type] ?? "bg-muted text-muted-foreground",
            )}
          >
            {card.card_type}
          </span>
        ) : null}
        {card.rarity ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {card.rarity}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-[63/110] rounded-lg" />
      ))}
    </div>
  );
}

export function CardGrid({ cards }: { cards: CardListItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}
