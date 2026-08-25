import { notFound } from "next/navigation";

import { AdminDeleteButton } from "@/components/features/admin/admin-delete-button";
import { KeywordForm } from "@/components/features/admin/keyword-form";
import { fetchAdminKeyword, fetchGames, fetchKeywordCardCount } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminEditKeywordPage(
  props: PageProps<"/admin/keywords/[keywordId]">,
) {
  const { keywordId } = await props.params;
  const [keyword, games] = await Promise.all([fetchAdminKeyword(keywordId), fetchGames()]);
  if (!keyword) notFound();

  // 세트와 달리 이 값은 삭제를 막지 못한다. card_keywords가 on delete cascade라
  // 삭제는 조용히 성공하고 태그만 사라지므로, **누르기 전에 보여주는 이 경고가
  // 유일한 방어다** (plan T1.15a ⓑ).
  const cardCount = await fetchKeywordCardCount(keyword.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">키워드 수정</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{keyword.code}</p>
      </div>

      <KeywordForm
        games={games}
        keywordId={keyword.id}
        initial={{
          game_id: keyword.game_id,
          code: keyword.code,
          label_ko: keyword.label_ko,
          label_ja: keyword.label_ja ?? "",
        }}
      />

      {/* <form> 바깥의 형제 컴포넌트로 둔다 — AdminDeleteButton 참고 */}
      <AdminDeleteButton
        endpoint={`/api/admin/keywords/${keyword.id}`}
        redirectTo="/admin/keywords"
        label={keyword.label_ko}
        description={
          cardCount > 0
            ? `카드 ${cardCount}장에 붙어 있습니다. 삭제하면 그 카드들에서 이 태그가 함께 사라집니다.`
            : undefined
        }
      />
    </div>
  );
}
