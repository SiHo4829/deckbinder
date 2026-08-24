import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { fetchAdminCards } from "@/lib/admin/queries";
import { CONTROL_CLASS_SM } from "@/lib/utils/form";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminCardsPage(props: PageProps<"/admin/cards">) {
  const params = await props.searchParams;
  const q = firstString(params.q);
  const pageParam = Number(firstString(params.page));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { cards, total, totalPages } = await fetchAdminCards({ q, page });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">카드 목록</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            코드 · 일본어명 · 한국어명으로 등록된 카드를 찾습니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/cards/new">카드 등록</Link>
        </Button>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="카드 검색"
          placeholder="코드 · 일본어명 · 한국어명"
          className={CONTROL_CLASS_SM}
        />
        <Button type="submit" variant="secondary">
          검색
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">총 {total}건</p>

      {cards.length === 0 ? (
        <EmptyState
          title="등록된 카드가 없습니다"
          description={
            q.length > 0
              ? "검색어를 바꿔서 다시 시도하세요."
              : "카드를 등록하면 여기에 나타납니다."
          }
          action={
            <Link href="/admin/cards/new" className="text-sm underline">
              카드 등록으로 이동
            </Link>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">코드</th>
                  <th className="px-3 py-2">일본어명</th>
                  <th className="px-3 py-2">한국어명</th>
                  <th className="px-3 py-2">레어도</th>
                  <th className="px-3 py-2">종류</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{card.code}</td>
                    <td className="px-3 py-2">{card.name_ja}</td>
                    <td className="px-3 py-2 text-muted-foreground">{card.name_ko ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{card.rarity ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{card.card_type ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/admin/cards/${card.id}`} className="text-xs underline">
                        수정
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => `/admin/cards?q=${encodeURIComponent(q)}&page=${p}`}
          />
        </>
      )}
    </div>
  );
}
