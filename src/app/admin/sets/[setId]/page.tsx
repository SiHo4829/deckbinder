import { notFound } from "next/navigation";

import { AdminDeleteButton } from "@/components/features/admin/admin-delete-button";
import { SetForm } from "@/components/features/admin/set-form";
import { fetchAdminSet, fetchGames, fetchSetCardCount } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminEditSetPage(props: PageProps<"/admin/sets/[setId]">) {
  const { setId } = await props.params;
  const [set, games] = await Promise.all([fetchAdminSet(setId), fetchGames()]);
  if (!set) notFound();

  // 삭제가 막힐지를 누르기 전에 알려 준다. cards.set_id가 on delete restrict라
  // 카드가 한 장이라도 걸려 있으면 삭제는 실패한다 (plan T1.15a ⓑ).
  const cardCount = await fetchSetCardCount(set.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">세트 수정</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{set.code}</p>
      </div>

      <SetForm
        games={games}
        setId={set.id}
        initial={{
          game_id: set.game_id,
          code: set.code,
          name_ja: set.name_ja ?? "",
          name_ko: set.name_ko ?? "",
          released_at: set.released_at ?? "",
        }}
      />

      {/* <form> 바깥의 형제 컴포넌트로 둔다 — AdminDeleteButton 참고 */}
      <AdminDeleteButton
        endpoint={`/api/admin/sets/${set.id}`}
        redirectTo="/admin/sets"
        label={set.code}
        description={
          cardCount > 0
            ? `이 세트를 쓰는 카드가 ${cardCount}장 있습니다. 삭제할 수 없습니다.`
            : undefined
        }
      />
    </div>
  );
}
