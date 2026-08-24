"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { CardFilters } from "@/components/features/cards/card-filter-panel";
import { queryKeys } from "@/lib/query/keys";
import type { CardCursor, CardFacets, CardListResponse } from "@/types/card";

function toSearchParams(filters: CardFilters, cursor: CardCursor | null): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["q", "game", "cardType", "rarity", "attribute", "set"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  // 반복 키로 보낸다. 쉼표 구분도 서버가 받지만 값에 쉼표가 있으면 깨진다.
  for (const code of filters.keywords) params.append("keywords", code);
  // code만으로는 정렬 키가 유일하지 않다. id까지 보내야 카드가 건너뛰어지지 않는다 (007).
  if (cursor) {
    params.set("cursor", cursor.code);
    params.set("cursorId", cursor.id);
  }
  return params;
}

async function fetchCards(
  filters: CardFilters,
  cursor: CardCursor | null,
): Promise<CardListResponse> {
  const res = await fetch(`/api/cards?${toSearchParams(filters, cursor).toString()}`);
  if (!res.ok) throw new Error("카드를 불러오지 못했습니다.");
  return (await res.json()) as CardListResponse;
}

export function useCardSearch(filters: CardFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.cards.list({ ...filters, keywords: filters.keywords.join(",") }),
    queryFn: ({ pageParam }) => fetchCards(filters, pageParam),
    initialPageParam: null as CardCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/** 필터 선택지. 게임을 바꾸면 선택지도 함께 바뀐다. */
export function useCardFacets(game: string) {
  return useQuery({
    queryKey: queryKeys.cards.facets(game),
    queryFn: async (): Promise<CardFacets> => {
      const res = await fetch(`/api/cards/facets${game ? `?game=${game}` : ""}`);
      if (!res.ok) throw new Error("필터 정보를 불러오지 못했습니다.");
      return (await res.json()) as CardFacets;
    },
    // 카드가 추가되면 선택지도 늘어나므로 도감 목록보다 짧게 잡는다.
    staleTime: 60 * 1000,
  });
}
