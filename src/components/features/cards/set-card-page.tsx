import Link from "next/link";

import { CardGrid } from "@/components/features/cards/card-grid";
import { Pagination } from "@/components/common/pagination";
import type { CardListItem } from "@/types/card";

/**
 * `/sets/[setId]` 본문 — 세트 전체 카드 60장/페이지 오프셋 그리드.
 *
 * plan §4.9 ⓑ. 라우트(`src/app/(app)/sets/[setId]/page.tsx`, developer 몫)가 세트
 * 존재를 확인해 없으면 `notFound()`를 던진 뒤에만 이 컴포넌트를 렌더한다 — 이
 * 컴포넌트 자체는 "세트가 없을 수 있다"는 상태를 다루지 않는다.
 *
 * 커서를 쓰지 않는다(§4.9 ⓓ) — `page`는 1부터 시작하는 오프셋 페이지 번호이고
 * URL도 `?page=n`이다. 정렬 옵션을 넣지 않는다(§4.9 ⓘ · B-5) — `code` 오름차순
 * 고정이고 그 정렬은 developer의 쿼리가 담당한다.
 *
 * ---
 * ★ **빈 페이지네이션 판단 (architect가 특별히 넘긴 것 #2).** 세트 40개 중 22개가
 * 15~19장이라 `totalPages <= 1`에서 `Pagination`이 `null`을 반환한다 — 그 세트의
 * 절반이 넘는 곳에서 페이지 이동 UI가 아예 안 그려진다. 그 화면이 "잘린 것"처럼
 * 보이지 않도록, **`Pagination`과 무관하게 머리말에 "전체 N장 중 from–to장 표시"
 * 캡션을 항상 그린다.** 이 캡션은 페이지네이션이 있든 없든 그리드가 어디까지가
 * 전부인지 스스로 말한다 — 빈 여백으로 끝나는 대신 문장으로 닫힌다(closure).
 */
export interface SetCardPageProps {
  set: {
    id: string;
    code: string;
    nameKo: string | null;
    nameJa: string | null;
  };
  /** 세트가 속한 게임. `card_sets.game_id`가 없을 수 없지만 조인 실패에 대비해 nullable로 받는다 */
  game: { code: string; nameKo: string } | null;
  /** 세트 총 카드 수. `count: "exact"`로 이미 조회된 값 */
  totalCount: number;
  /** 현재 페이지에 표시할 카드. `code` 오름차순 · 최대 60장으로 이미 오프셋 슬라이스된 값 */
  cards: CardListItem[];
  /** 1부터 시작하는 현재 페이지 */
  page: number;
  /** 페이지당 장수. §4.9 ⓓ가 정한 값은 60이지만 캡션 계산을 위해 prop으로 받는다 */
  pageSize: number;
}

function setDisplayLabel(set: Pick<SetCardPageProps["set"], "nameKo" | "nameJa">): string {
  return set.nameKo ?? set.nameJa ?? "";
}

export function SetCardPage({ set, game, totalCount, cards, page, pageSize }: SetCardPageProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-6 py-2">
      <nav className="text-sm text-muted-foreground">
        <Link href="/cards" className="underline-offset-4 hover:underline">
          카드 도감
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs text-muted-foreground">{set.code}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {setDisplayLabel(set)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {game ? `${game.nameKo} · ` : ""}
          전체 {totalCount}장{totalCount > 0 ? ` 중 ${from}–${to}장 표시` : ""}
        </p>
      </header>

      {cards.length > 0 ? (
        <CardGrid cards={cards} />
      ) : (
        <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          이 페이지에 표시할 카드가 없습니다.
        </p>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => (p === 1 ? `/sets/${set.id}` : `/sets/${set.id}?page=${p}`)}
        className="pt-2"
      />
    </div>
  );
}
