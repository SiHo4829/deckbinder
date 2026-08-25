import { notFound } from "next/navigation";

import { AdminDeleteButton } from "@/components/features/admin/admin-delete-button";
import { CardForm } from "@/components/features/admin/card-form";
import {
  fetchAdminCard,
  fetchGames,
  fetchKeywords,
  fetchSets,
} from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminEditCardPage(
  props: PageProps<"/admin/cards/[cardId]">,
) {
  const { cardId } = await props.params;
  const [card, games, sets, keywords] = await Promise.all([
    fetchAdminCard(cardId),
    fetchGames(),
    fetchSets(),
    fetchKeywords(),
  ]);
  if (!card) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">카드 수정</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{card.code}</p>
      </div>

      <CardForm
        games={games}
        sets={sets}
        keywords={keywords}
        cardId={card.id}
        initial={{
          game_id: card.game_id,
          set_id: card.set_id ?? "",
          code: card.code,
          name_ja: card.name_ja,
          name_ko: card.name_ko ?? "",
          name_en: card.name_en ?? "",
          rarity: card.rarity ?? "",
          attribute: card.attribute ?? "",
          card_type: card.card_type ?? "",
          sub_type: card.sub_type ?? "",
          image_url: card.image_url ?? "",
          effect_text: card.effect_text ?? "",
        }}
        initialKeywordIds={card.keywordIds}
      />

      {/* <form> 바깥의 형제 컴포넌트로 둔다 — AdminDeleteButton 참고 */}
      <AdminDeleteButton
        endpoint={`/api/admin/cards/${card.id}`}
        redirectTo="/admin/cards"
        label={card.code}
      />
    </div>
  );
}
