import Link from "next/link";

import { CardImage } from "@/components/features/cards/card-image";
import type { CardListItem } from "@/types/card";

/**
 * 대체 카드 — 같은 카드의 다른 인쇄본(패러렐 등).
 * base_code가 같으면 게임상 동일한 카드이므로 가장 싼 것을 사면 된다 (plan §4.6).
 *
 * 어느 일러스트인지가 선택 기준이므로 텍스트 목록이 아니라 썸네일로 보여준다.
 */
export function SimilarCards({ cards }: { cards: CardListItem[] }) {
  if (cards.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-tight">같은 카드의 다른 버전</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        일러스트만 다른 동일 카드입니다. 덱에서는 어느 것을 써도 됩니다.
      </p>

      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {cards.map((card) => (
          <li key={card.id}>
            <Link href={`/cards/${card.id}`} className="group block">
              <div className="relative aspect-card overflow-hidden rounded-lg border bg-surface-raised transition-shadow group-hover:shadow-md">
                <CardImage card={card} iconClassName="size-4" />
                {card.rarity ? (
                  <span className="absolute top-1.5 right-1.5 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-medium text-background">
                    {card.rarity}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
                {card.code}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
