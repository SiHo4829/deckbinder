import "server-only";

import { cache } from "react";

import { withProxiedImage } from "@/lib/cards/image-src";
import { toPrintingFacts, type PrintingGroupAggregate } from "@/lib/cards/printing-facts";
import type { PrintingFacts } from "@/lib/domain/achievement/rarity-score";
import { clientEnv } from "@/lib/env";
import { createSupabaseAnonClient } from "@/lib/supabase/public";
import type { CardDetail, CardListItem } from "@/types/card";

// 쿠키를 읽지 않는 익명 클라이언트를 쓴다. server.ts(cookies 사용)를 쓰면
// 세그먼트가 강제로 동적 렌더링되어 ISR·정적 생성이 성립하지 않는다.
// illustration_type은 T2.15(희귀도 점수 번역)의 입력이다 — 여기 없으면
// 배지가 일러스트 근거를 절대 그리지 못한다.
const DETAIL_COLUMNS =
  "id,code,base_code,name_ko,name_ja,name_en,rarity,attribute,card_type,sub_type,illustration_type,image_url,source_image_url,effect_text,set_id,game_id";

/**
 * 상세 페이지용 카드 1건. 없으면 null.
 *
 * `cache()`로 감싼 이유: 같은 렌더에서 generateMetadata와 페이지 본문이 각각
 * 이 함수를 부른다. Next 15+ 에서 fetch의 기본은 캐시하지 않음이라 감싸지 않으면
 * **요청마다 DB를 두 번 왕복한다.** 캐시 범위는 렌더 1회이므로 최신성은 그대로다.
 */
export const fetchCardDetail = cache(async (
  cardId: string,
): Promise<CardDetail | null> => {
  const supabase = createSupabaseAnonClient();

  const { data, error } = await supabase
    .from("cards")
    .select(
      `${DETAIL_COLUMNS},
       card_sets(code,name_ko,name_ja),
       games(code,name_ko),
       card_keywords(keywords(code,label_ko))`,
    )
    .eq("id", cardId)
    .maybeSingle();

  if (error || !data) return null;

  return withProxiedImage({
    ...data,
    set: data.card_sets
      ? {
          code: data.card_sets.code,
          label: data.card_sets.name_ko ?? data.card_sets.name_ja,
        }
      : null,
    game: data.games ? { code: data.games.code, label: data.games.name_ko } : null,
    keywords: (data.card_keywords ?? [])
      .map((row) => row.keywords)
      .filter((k): k is { code: string; label_ko: string } => k !== null)
      .map((k) => ({ code: k.code, label: k.label_ko })),
  } as CardDetail, clientEnv.NEXT_PUBLIC_IMAGE_PROXY_BASE);
});

/**
 * 대체 카드 — 같은 게임에서 base_code가 같은 다른 인쇄본.
 * 게임상 동일한 카드이므로 가장 싼 것을 사면 된다 (plan §4.6).
 */
export async function fetchCardAlternatives(
  card: Pick<CardDetail, "id" | "game_id" | "base_code">,
): Promise<CardListItem[]> {
  const supabase = createSupabaseAnonClient();

  const { data } = await supabase
    .from("cards")
    .select(
      "id,code,name_ko,name_ja,rarity,attribute,card_type,sub_type,image_url,source_image_url,set_id",
    )
    .eq("game_id", card.game_id)
    .eq("base_code", card.base_code)
    .neq("id", card.id)
    .order("code");

  return (data ?? []).map((row) => withProxiedImage(row, clientEnv.NEXT_PUBLIC_IMAGE_PROXY_BASE) as CardListItem);
}

/** `/sets/[setId]` 전체 보기의 페이지당 장수 (plan §4.9 ⓓ — 여기서 고치지 않는다). */
export const SET_CARDS_PAGE_SIZE = 60;

export interface SetMeta {
  id: string;
  code: string;
  name_ko: string | null;
  name_ja: string | null;
  game: { code: string; name_ko: string } | null;
}

/**
 * 세트 메타(코드 · 라벨 · 게임) 조회. `/sets/[setId]`가 존재 확인에도 쓴다 —
 * 없으면 `null`이고 호출부가 `notFound()`를 던진다(plan §4.9 ⓑ).
 */
export async function fetchSetMeta(setId: string): Promise<SetMeta | null> {
  const supabase = createSupabaseAnonClient();

  const { data, error } = await supabase
    .from("card_sets")
    .select("id,code,name_ko,name_ja,games(code,name_ko)")
    .eq("id", setId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    code: data.code,
    name_ko: data.name_ko,
    name_ja: data.name_ja,
    game: data.games ? { code: data.games.code, name_ko: data.games.name_ko } : null,
  };
}

/**
 * 세트 총 카드 수. `fetchPrintingFacts`(:108)와 정확히 같은 모양의 count다 —
 * 같은 세트에 대해 이미 도는 부하이지 새로 생기는 부하가 아니다(plan §4.9 ⓖ-ⓑ).
 */
export async function fetchSetCardCount(setId: string): Promise<number> {
  const supabase = createSupabaseAnonClient();

  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("set_id", setId);

  return count ?? 0;
}

/**
 * 세트 카드 한 페이지. `code` 오름차순 고정(정렬 옵션을 넣지 않는다 — ⓘ) ·
 * 오프셋 `range()`(커서를 쓰지 않는다 — ⓒ). `code`는 `(game_id, code)`
 * unique 제약(마이그레이션 001)과 세트가 한 게임에 속한다는 FK로 세트
 * 안에서 유일해 타이브레이커가 필요 없다(§4.9 ⓖ 재료).
 *
 * `pageSize`는 기본값 60(§4.9 ⓓ)이지만, 카드 상세의 미리보기 12장
 * (`SetCardsPreview`)도 이 함수를 그대로 쓴다 — `page=1, pageSize=12`로
 * 부르면 같은 정렬 위에서 앞 12장만 가져온다. 새 쿼리 모양을 만들지 않는다.
 */
export async function fetchSetCards(
  setId: string,
  page: number,
  pageSize: number = SET_CARDS_PAGE_SIZE,
): Promise<CardListItem[]> {
  const supabase = createSupabaseAnonClient();
  const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data } = await supabase
    .from("cards")
    .select(
      "id,code,name_ko,name_ja,rarity,attribute,card_type,sub_type,image_url,source_image_url,set_id",
    )
    .eq("set_id", setId)
    .order("code")
    .range(from, to);

  return (data ?? []).map((row) => withProxiedImage(row, clientEnv.NEXT_PUBLIC_IMAGE_PROXY_BASE) as CardListItem);
}

/**
 * 희귀도 점수(T2.15)의 번역 입력을 만든다. 번역 자체는 순수 함수
 * `toPrintingFacts`(`src/lib/cards/printing-facts.ts`)가 하고, 여기는 DB
 * 왕복만 한다 (plan §4.13 ⓒ).
 *
 * `group.printingsInGroup`은 `fetchCardAlternatives(card).length + 1`을
 * 그대로 넘겨받는다 — 같은 조회를 두 번 하지 않는다(§4.13 T2.15 ⓑ).
 *
 * `set_id`가 없으면 세트 집계 조회 자체를 하지 않고 `null`을 넘긴다 —
 * `toPrintingFacts`가 그 신호로 `set_unknown` 경로에 떨어뜨린다.
 * `rarity`가 없으면 `peerCount` 조회도 하지 않는다 — 도메인이 `rarityLabel`
 * 없음을 먼저 보고 `rarity_unknown`으로 떨어지므로 그 값은 점수에 영향을
 * 주지 않는다.
 */
export async function fetchPrintingFacts(
  card: Pick<CardDetail, "code" | "base_code" | "rarity" | "illustration_type" | "set_id">,
  group: PrintingGroupAggregate,
): Promise<PrintingFacts> {
  if (!card.set_id) {
    return toPrintingFacts(card, group, null);
  }

  const supabase = createSupabaseAnonClient();
  const setId = card.set_id;

  const [setSizeResult, peerCountResult] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("set_id", setId),
    card.rarity === null
      ? Promise.resolve({ count: null })
      : supabase
          .from("cards")
          .select("id", { count: "exact", head: true })
          .eq("set_id", setId)
          .eq("rarity", card.rarity),
  ]);

  const setSize = setSizeResult.count;
  const peerCount = peerCountResult.count;

  if (setSize === null || peerCount === null) {
    return toPrintingFacts(card, group, null);
  }

  return toPrintingFacts(card, group, { peerCount, setSize });
}
