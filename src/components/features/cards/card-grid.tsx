"use client";

import { ImageOff } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { cardDisplayName, type CardListItem } from "@/types/card";

const TYPE_BADGE: Record<string, string> = {
  Pokemon: "bg-game-ptcg text-game-ptcg-foreground",
  Trainer: "bg-secondary text-secondary-foreground",
  Energy: "bg-muted text-muted-foreground",
  LEADER: "bg-game-opcg text-game-opcg-foreground",
  CHARACTER: "bg-secondary text-secondary-foreground",
};

function CardTile({ card }: { card: CardListItem }) {
  const name = cardDisplayName(card);

  return (
    <article className="rounded-lg border transition-colors hover:bg-accent/40">
      <Link href={`/cards/${card.id}`} className="flex flex-col gap-2 p-3">
        {/* 이미지가 없는 카드가 기본이라고 보고 그린다 (plan §4.4). */}
        <div className="flex aspect-[63/88] items-center justify-center rounded-md bg-muted">
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- 원격 호스트 정책 미확정(§9.3)
            <img
              src={card.image_url}
              alt={name}
              className="h-full w-full rounded-md object-contain"
              loading="lazy"
            />
          ) : (
            <ImageOff className="size-6 text-muted-foreground/50" aria-hidden />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium" title={name}>
            {name}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{card.code}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          {card.card_type ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px]",
                TYPE_BADGE[card.card_type] ?? "bg-muted text-muted-foreground",
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
      </Link>
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
