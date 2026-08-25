import Link from "next/link";

import { KeywordForm } from "@/components/features/admin/keyword-form";
import { fetchGames, fetchKeywords } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminKeywordsPage() {
  const [games, keywords] = await Promise.all([fetchGames(), fetchKeywords()]);
  const gameName = new Map(games.map((g) => [g.id, g.name_ko]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">효과 키워드 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          드로우 · 버림 · 카운터처럼 카드 성능을 나타내는 태그입니다. 도감에서 여러 개를
          고르면 <strong>모두</strong> 가진 카드만 남습니다.
        </p>
      </div>

      <KeywordForm games={games} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">등록된 키워드 ({keywords.length})</h2>
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 없습니다.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <li key={k.id}>
                {/* 세트와 같은 이유로 별도 목록 라우트를 만들지 않는다 (plan T1.15a ⓒ) */}
                <Link
                  href={`/admin/keywords/${k.id}`}
                  className="block rounded border px-2 py-1 text-xs hover:bg-accent"
                >
                  {k.label_ko}
                  <span className="ml-1.5 font-mono text-muted-foreground">{k.code}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    · {gameName.get(k.game_id) ?? "?"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
