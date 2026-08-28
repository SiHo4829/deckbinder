import type { DeckSlot, DeckZone } from "@/types/game";

export interface DeckStats {
  /** 존별 **매수 합**. 슬롯 수가 아니다. */
  readonly byZone: Readonly<Record<DeckZone, number>>;
  readonly distinctCards: number;
  readonly groups: readonly { readonly key: string | null; readonly count: number }[];
}

function usableCount(count: number): number {
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/**
 * 덱 분포 집계.
 *
 * **집계 축을 주입받는다** — `stats.ts`는 "카드 종류"라는 개념을 갖지 않는다.
 * `card_type`을 도메인이 알게 되는 순간 컬럼명 비의존(plan §4.7 ⓓ-3)이 무너진다.
 */
export function summarizeDeck(
  slots: readonly DeckSlot[],
  groupBy?: (slot: DeckSlot) => string | null,
): DeckStats {
  const byZone: Record<DeckZone, number> = { main: 0, leader: 0, don: 0 };
  const distinct = new Set<string>();
  // 축이 null인 슬롯도 버리지 않는다. Map 키로 null을 그대로 쓴다.
  const groups = new Map<string | null, number>();

  for (const slot of slots) {
    const count = usableCount(slot.count);
    byZone[slot.zone] += count;
    distinct.add(slot.cardKey);

    if (groupBy) {
      const key = groupBy(slot);
      groups.set(key, (groups.get(key) ?? 0) + count);
    }
  }

  return {
    byZone,
    distinctCards: distinct.size,
    groups: [...groups].map(([key, count]) => ({ key, count })),
  };
}
