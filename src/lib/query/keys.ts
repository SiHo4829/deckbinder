/**
 * queryKey를 한곳에서 만들어 캐시 무효화 대상이 흩어지지 않게 한다.
 * 키는 캐시 식별자일 뿐이므로 도메인 스키마 타입에 묶지 않는다.
 */
type KeyParams = Record<string, string | number | boolean | undefined>;

export const queryKeys = {
  cards: {
    all: ["cards"] as const,
    list: (params: KeyParams) => [...queryKeys.cards.all, "list", params] as const,
    detail: (cardId: string) => [...queryKeys.cards.all, "detail", cardId] as const,
  },
} as const;
