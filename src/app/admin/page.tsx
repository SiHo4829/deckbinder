import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { fetchCounts, fetchRecentCards } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [counts, recent] = await Promise.all([fetchCounts(), fetchRecentCards()]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">대시보드</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">등록된 세트</p>
            <p className="mt-1 text-2xl font-semibold">{counts.sets}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">등록된 카드</p>
            <p className="mt-1 text-2xl font-semibold">{counts.cards}</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">최근 등록 카드</h2>
        {recent.length === 0 ? (
          <EmptyState
            title="등록된 카드가 없습니다"
            description="세트를 먼저 만든 뒤 카드를 등록하세요."
            action={
              <Link href="/admin/sets" className="text-sm underline">
                세트 등록으로 이동
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">코드</th>
                  <th className="px-3 py-2">일본어명</th>
                  <th className="px-3 py-2">한국어명</th>
                  <th className="px-3 py-2">레어도</th>
                  <th className="px-3 py-2">종류</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-3 py-2">{c.name_ja}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.name_ko ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.rarity ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.card_type ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
