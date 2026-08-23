import { CardForm } from "@/components/features/admin/card-form";
import { fetchGames, fetchKeywords, fetchSets } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminNewCardPage() {
  const [games, sets, keywords] = await Promise.all([
    fetchGames(),
    fetchSets(),
    fetchKeywords(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">카드 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          등록 즉시 도감에 반영됩니다. 저장 후 폼은 비워지고 게임·세트 선택은 유지됩니다.
        </p>
      </div>
      <CardForm games={games} sets={sets} keywords={keywords} />
    </div>
  );
}
