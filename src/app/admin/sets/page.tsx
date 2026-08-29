import Link from "next/link";

import { SetForm } from "@/components/features/admin/set-form";
import { fetchGames, fetchSets } from "@/lib/admin/queries";
import { setDisplayName } from "@/types/admin";

export const dynamic = "force-dynamic";

export default async function AdminSetsPage() {
  const [games, sets] = await Promise.all([fetchGames(), fetchSets()]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">세트 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          카드는 세트에 속합니다. 카드를 넣기 전에 세트를 먼저 만드세요.
        </p>
      </div>

      <SetForm games={games} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">등록된 세트 ({sets.length})</h2>
        {sets.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 없습니다.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sets.map((s) => (
              <li key={s.id}>
                {/*
                  별도 목록 라우트를 만들지 않는다 — 세트는 개수가 적어 이 목록
                  하나로 충분하다. 카드가 /admin/cards를 따로 가진 이유는 수백 장이
                  되기 때문이고, 그 전제가 여기엔 없다 (plan T1.15a ⓒ).
                */}
                <Link
                  href={`/admin/sets/${s.id}`}
                  className="block rounded border px-2 py-1 text-xs hover:bg-accent"
                >
                  <span className="font-mono">{s.code}</span> · {setDisplayName(s)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
