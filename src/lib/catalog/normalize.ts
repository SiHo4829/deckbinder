/**
 * `NormalizedCard`(중간 파일 1행, 파싱 완료) → `CardRowDraft`(`cards` Insert에
 * 그대로 실릴 값) — T1.18 임포터 계약 (plan §4.11 ⓒ · ⓓ).
 *
 * 🚨 **순수.** DB를 모른다 — `set_id`·`game_id`·`id`를 채우지 않는다(그 셋은
 * `plan.ts`가 조회 결과로 채운다). 네트워크·파일 I/O 0건.
 */
import type { NormalizedCard, NumericField } from "@/lib/validation/catalog";

/** `cards` Insert에 그대로 실릴 값. */
export interface CardRowDraft {
  readonly code: string;
  readonly name_ko: string | null;
  readonly name_ja: null; // ★ 타입이 `null` 리터럴이다 — 값을 넣을 수 없다(ⓚ-1)
  readonly card_type: string;
  readonly colors: readonly string[] | null;
  readonly life: number | null;
  readonly cost: number | null;
  readonly power: number | null;
  readonly counter: number | null;
  readonly attribute: string | null;
  readonly traits: readonly string[] | null;
  readonly rarity: string | null;
  readonly effect_text: string | null;
  readonly trigger_text: string | null;
  readonly illustration_type: string | null;
  readonly block_number: number | null;
  readonly source_image_url: string;
}

export type NormalizeIssueReason =
  | "code_empty" // code가 비었거나 공백을 포함한다
  | "no_name" // name_ko도 name_ja도 없다 (§4.8 ⓕ ★★ · 008의 check 제약)
  | "card_type_empty" // 🚨 실측 4건 (ⓓ-3)
  | "card_type_unknown" // 알려진 4종 밖 (ⓓ-2)
  | "non_numeric"; // 알려진 표기 밖의 수치 문자열 (ⓕ)

export interface NormalizeIssue {
  readonly field: string; // "code" | "cardType" | "power" | ...
  readonly reason: NormalizeIssueReason;
  readonly raw: string; // 🚨 원문. 어떤 경우에도 비우지 않는다
}

export type NormalizeResult =
  | { readonly ok: true; readonly row: CardRowDraft; readonly warnings: readonly NormalizeIssue[] }
  | { readonly ok: false; readonly issues: readonly NormalizeIssue[] };

/** 🚨 life/cost 분배. 이 함수 하나가 §4.8 ⓗ #8이 T1.18에 넘긴 판정의 전부다. */
export const LIFE_CARD_TYPES = ["리더"] as const;
export const COST_CARD_TYPES = ["캐릭터", "이벤트", "스테이지"] as const;

export function distributeLifeCost(
  cardType: string,
  life: NumericField,
): { readonly life: number | null; readonly cost: number | null } | NormalizeIssue {
  if ((LIFE_CARD_TYPES as readonly string[]).includes(cardType)) {
    return { life: life.value, cost: null };
  }
  if ((COST_CARD_TYPES as readonly string[]).includes(cardType)) {
    return { life: null, cost: life.value };
  }
  // 🚨 그 밖의 값 — 조용히 둘 다 null로 두지 않는다. 새 카드 종류가 나오는
  // 날 그것이 조용히 코스트로 들어가는 것을 막는다.
  return { field: "cardType", reason: "card_type_unknown", raw: cardType };
}

function isNormalizeIssue(
  value: { readonly life: number | null; readonly cost: number | null } | NormalizeIssue,
): value is NormalizeIssue {
  return "reason" in value;
}

function numericIssue(field: string, numeric: NumericField): NormalizeIssue | null {
  if (!numeric.invalid) return null;
  return { field, reason: "non_numeric", raw: numeric.raw };
}

export function normalizeCard(card: NormalizedCard): NormalizeResult {
  const issues: NormalizeIssue[] = [];
  const warnings: NormalizeIssue[] = [];

  if (card.codeInvalid) {
    issues.push({ field: "code", reason: "code_empty", raw: card.code });
  }

  const nameKo = card.nameKo.trim().length === 0 ? null : card.nameKo;
  if (nameKo === null) {
    // 🚨 원천이 name_ja를 절대 주지 않으므로(ⓓ) name_ko가 없으면 둘 다 없다.
    issues.push({ field: "nameKo", reason: "no_name", raw: card.nameKo });
  }

  if (card.cardType.trim().length === 0) {
    issues.push({ field: "cardType", reason: "card_type_empty", raw: card.cardType });
  }

  const powerIssue = numericIssue("power", card.power);
  if (powerIssue) issues.push(powerIssue);
  const counterIssue = numericIssue("counter", card.counter);
  if (counterIssue) issues.push(counterIssue);
  const blockIssue = numericIssue("blockNumber", card.blockNumber);
  if (blockIssue) issues.push(blockIssue);

  let life: number | null = null;
  let cost: number | null = null;
  // 빈 문자열은 card_type_empty로 이미 잡혔으니, 그 밖의 알 수 없는 값에서만
  // distributeLifeCost를 부른다(빈 문자열도 알 수 없는 값 목록에 없으므로
  // 함께 걸러진다 — 아래에서 별도 처리).
  if (card.cardType.trim().length > 0) {
    const distributed = distributeLifeCost(card.cardType, card.life);
    if (isNormalizeIssue(distributed)) {
      issues.push(distributed);
    } else {
      life = distributed.life;
      cost = distributed.cost;
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const colors = card.colors.length > 0 ? card.colors : null;
  const traits = card.traits.length > 0 ? card.traits : null;

  // attribute: "-" → null (빈 문자열은 이미 validation/catalog.ts가 null로 만든다).
  // "?"·복합값("/")은 원문 그대로 보존한다(ⓓ-5).
  const attribute = card.attribute === "-" ? null : card.attribute;

  const row: CardRowDraft = {
    code: card.code,
    name_ko: nameKo,
    name_ja: null,
    card_type: card.cardType,
    colors,
    life,
    cost,
    power: card.power.value,
    counter: card.counter.value,
    attribute,
    traits,
    rarity: card.rarity.trim().length === 0 ? null : card.rarity,
    effect_text: card.effectText.trim().length === 0 ? null : card.effectText,
    trigger_text: card.triggerText.trim().length === 0 ? null : card.triggerText,
    illustration_type: card.illustrationType.trim().length === 0 ? null : card.illustrationType,
    block_number: card.blockNumber.value,
    source_image_url: card.imageUrl,
  };

  return { ok: true, row, warnings };
}
