import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SetCardPage } from "@/components/features/cards/set-card-page";
import {
  SET_CARDS_PAGE_SIZE,
  fetchSetCardCount,
  fetchSetCards,
  fetchSetMeta,
} from "@/lib/cards/queries";

// 세트를 고치거나 지운 직후 첫 방문에 반영되어야 한다 — /cards/[cardId]와
// 같은 이유로 동적이다(plan §4.9 ⓖ 완료 기준). generateStaticParams가 없어
// 애초에 프리렌더되지 않으므로 빌드에서 잃는 것은 없다.
export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function setDisplayLabel(set: { name_ko: string | null; name_ja: string | null }): string {
  return set.name_ko ?? set.name_ja ?? "";
}

export async function generateMetadata(
  props: PageProps<"/sets/[setId]">,
): Promise<Metadata> {
  const { setId } = await props.params;
  const set = await fetchSetMeta(setId);
  if (!set) return { title: "세트를 찾을 수 없습니다" };

  return { title: `${set.code} · ${setDisplayLabel(set)}` };
}

export default async function SetDetailPage(props: PageProps<"/sets/[setId]">) {
  const { setId } = await props.params;
  const searchParams = await props.searchParams;

  const set = await fetchSetMeta(setId);
  if (!set) notFound();

  const pageParam = Number(firstString(searchParams.page));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const [totalCount, cards] = await Promise.all([
    fetchSetCardCount(setId),
    fetchSetCards(setId, page),
  ]);

  return (
    <SetCardPage
      set={{ id: set.id, code: set.code, nameKo: set.name_ko, nameJa: set.name_ja }}
      game={set.game ? { code: set.game.code, nameKo: set.game.name_ko } : null}
      totalCount={totalCount}
      cards={cards}
      page={page}
      pageSize={SET_CARDS_PAGE_SIZE}
    />
  );
}
