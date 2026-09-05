import Link from "next/link";

import { CardImage } from "@/components/features/cards/card-image";
import { cn } from "@/lib/utils/cn";
import type { CardListItem } from "@/types/card";

/**
 * 「같은 세트의 카드」 미리보기 — 카드 상세 하단.
 *
 * plan §4.9. **`similar-cards.tsx`(같은 카드의 다른 버전)와는 다른 축이다** —
 * 「덱에서 바꿔 쓸 수 있다」가 아니라 「같이 나왔다」. 탭으로 묶지 않고
 * `similar-cards.tsx` **아래에 별도 영역**으로 둔다(§4.6 · §4.9 ⓒ).
 *
 * ---
 * ★ **배치 판단 (designer가 정한 자리 ⓐ).** 이 섹션은 **상세의 `md:grid-cols-[280px_1fr]`
 * 오른쪽 열 안에 넣지 않는다.** `similar-cards.tsx`는 대체 카드가 보통 1~4장이라
 * 좁은 열 안에서도 성립하지만, 이 축은 **고정 12장**(§4.9 ⓓ)이라 좁은 열에 욱여넣으면
 * 갤러리가 아니라 목록처럼 눌린다. **호출부(`/cards/[cardId]/page.tsx`, developer 몫)는
 * 이 컴포넌트를 두 컬럼 grid 바깥, 페이지 전체 폭에 형제 섹션으로 둔다** — 즉
 * `<SimilarCards />`를 담은 오른쪽 열 `div`가 닫힌 뒤, 같은 페이지 레벨에서 렌더한다.
 *
 * ★ **현재 카드 표시 판단 (designer가 정한 자리 ⓑ).** 빼지 않고(§4.9 ⓕ) **테두리
 * 링 + 이미지 하단 라벨**로 구분한다. 채도 있는 강조색을 쓰지 않는다 —
 * `ring-foreground`(무채색)만 쓴다. 카드 일러스트가 화면에서 유일하게 채도가
 * 높은 요소라는 규칙(§2.8)을 이 표시가 깨지 않는다.
 *
 * ★ **「전체 N장 보기」 판단 (designer가 정한 자리 ⓒ).** 섹션 머리말 오른쪽에 고정
 * 배치하고, **`totalCount <= cards.length`(즉 12장 이하 세트)여도 숨기지 않는다.**
 * 그 경우에도 `/sets/[setId]`가 게임/세트 라벨을 갖춘 별도 진입점이라는 사실은
 * 바뀌지 않고, 링크를 숨기면 「이 세트에 카드가 더 있는지」를 사용자가 스스로
 * 추측해야 한다.
 */
export interface SetCardsPreviewProps {
  /** `/sets/[setId]` 링크 대상. uuid (§4.9 ⓑ) */
  setId: string;
  /** 이미 조합된 세트 표기 — 예: `"OPK-05 · 부스터 팩 신시대의 주역"`. 조합 규칙은 developer 몫 */
  setLabel: string;
  /** 세트 총 카드 수. `count: "exact"`로 이미 조회된 값 */
  totalCount: number;
  /** 미리보기로 보여줄 카드. **최대 12장, `code` 오름차순으로 이미 슬라이스된 값** — 이 컴포넌트는 자르지 않는다(§4.9 ⓓ) */
  cards: CardListItem[];
  /** 지금 상세에서 보고 있는 카드 id. 미리보기에 포함되면 빼지 않고 표시로 구분한다(§4.9 ⓕ) */
  currentCardId: string;
}

export function SetCardsPreview({
  setId,
  setLabel,
  totalCount,
  cards,
  currentCardId,
}: SetCardsPreviewProps) {
  // 카드에 set_id가 없거나 세트 조회가 비면 섹션 자체를 접는다 — similar-cards.tsx와
  // 같은 규칙이다. "산출 불가"는 §4.13의 점수 규칙이고 이 축은 점수가 아니다.
  if (cards.length === 0) return null;

  return (
    <section className="border-t border-[--hairline] pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">같은 세트의 카드</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {setLabel} · 전체 {totalCount}장 가운데 {cards.length}장 미리보기
          </p>
        </div>

        <Link
          href={`/sets/${setId}`}
          className="shrink-0 text-xs font-medium underline-offset-4 hover:underline"
        >
          전체 {totalCount}장 보기 →
        </Link>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {cards.map((card) => {
          const isCurrent = card.id === currentCardId;

          return (
            <li key={card.id}>
              <Link
                href={`/cards/${card.id}`}
                className="group block"
                aria-current={isCurrent ? "page" : undefined}
              >
                <div
                  className={cn(
                    "relative aspect-card overflow-hidden rounded-lg border bg-surface-raised transition-shadow",
                    isCurrent
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "group-hover:shadow-md",
                  )}
                >
                  <CardImage card={card} />

                  {card.rarity ? (
                    <span className="absolute top-1.5 right-1.5 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-medium text-background">
                      {card.rarity}
                    </span>
                  ) : null}

                  {isCurrent ? (
                    <span className="absolute inset-x-0 bottom-0 bg-foreground/85 px-1.5 py-0.5 text-center text-[10px] font-medium text-background">
                      지금 보는 카드
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
                  {card.code}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
