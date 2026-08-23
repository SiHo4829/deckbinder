import { SetForm } from "@/components/features/admin/set-form";
import { fetchGames, fetchSets } from "@/lib/admin/queries";

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
              <li key={s.id} className="rounded border px-2 py-1 text-xs">
                <span className="font-mono">{s.code}</span> · {s.name_ja}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
