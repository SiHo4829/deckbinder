"use client";

import { parseAsArrayOf, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useRef } from "react";

import { EmptyState } from "@/components/common/empty-state";
import {
  CardFilterPanel,
  type CardFilters,
} from "@/components/features/cards/card-filter-panel";
import { CardGrid, CardGridSkeleton } from "@/components/features/cards/card-grid";
import {
  useCardFacets,
  useCardSearch,
} from "@/components/features/cards/use-card-search";
import { Button } from "@/components/ui/button";

// 필터는 URL에 실어 링크 공유와 SEO 색인을 가능하게 한다 (plan §4.2).
const filterParsers = {
  q: parseAsString.withDefault(""),
  game: parseAsString.withDefault(""),
  cardType: parseAsString.withDefault(""),
  rarity: parseAsString.withDefault(""),
  attribute: parseAsString.withDefault(""),
  set: parseAsString.withDefault(""),
  keywords: parseAsArrayOf(parseAsString).withDefault([]),
};

export function CardBrowser() {
  const [filters, setFilters] = useQueryStates(filterParsers, {
    history: "replace",
    shallow: true,
  });

  const facetsQuery = useCardFacets(filters.game);
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCardSearch(filters as CardFilters);

  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleChange = useCallback(
    (patch: Partial<CardFilters>) => {
      void setFilters(patch);
    },
    [setFilters],
  );

  const cards = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <p className="eyebrow">포켓몬 · 원피스</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">카드 도감</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          이름 · 효과 키워드 · 레어도로 카드를 찾습니다. 한국어명이 없는 카드는
          일본어명으로 표기합니다.
        </p>
      </div>

      <CardFilterPanel
        filters={filters as CardFilters}
        facets={facetsQuery.data}
        onChange={handleChange}
      />

      {isPending ? (
        <CardGridSkeleton />
      ) : isError ? (
        <EmptyState
          title="카드를 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : cards.length === 0 ? (
        <EmptyState
          title="검색 결과가 없습니다"
          description="검색어나 필터를 조정해 보세요."
        />
      ) : (
        <>
          <CardGrid cards={cards} />
          <div ref={sentinel} aria-hidden className="h-px" />
          {isFetchingNextPage ? <CardGridSkeleton count={5} /> : null}
          {!hasNextPage ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              마지막 카드까지 표시했습니다.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
