import Link from "next/link";

import { cardDisplayName, type CardListItem } from "@/types/card";

/**
 * 대체 카드 — 같은 카드의 다른 인쇄본(패러렐 등).
 * base_code가 같으면 게임상 동일한 카드이므로 가장 싼 것을 사면 된다 (plan §4.6).
 */
export function SimilarCards({ cards }: { cards: CardListItem[] }) {
  if (cards.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold">같은 카드의 다른 버전</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        일러스트만 다른 동일 카드입니다. 덱에서는 어느 것을 써도 됩니다.
      </p>

      <ul className="mt-3 flex flex-col divide-y rounded-lg border">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/cards/${card.id}`}
              className="flex items-center gap-3 p-3 transition-colors hover:bg-accent"
            >
              <span className="font-mono text-xs text-muted-foreground">{card.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {cardDisplayName(card)}
              </span>
              {card.rarity ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {card.rarity}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
