"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import type { CardListResponse } from "@/types/card";

/** interface가 아니라 type이어야 queryKey의 Record 타입에 대입된다. */
export type CardSearchFilters = {
  q: string;
  game: string;
  cardType: string;
};

async function fetchCards(
  filters: CardSearchFilters,
  cursor: string | null,
): Promise<CardListResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.game) params.set("game", filters.game);
  if (filters.cardType) params.set("cardType", filters.cardType);
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`/api/cards?${params.toString()}`);
  if (!res.ok) {
    throw new Error("카드를 불러오지 못했습니다.");
  }
  return (await res.json()) as CardListResponse;
}

export function useCardSearch(filters: CardSearchFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.cards.list(filters),
    queryFn: ({ pageParam }) => fetchCards(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
