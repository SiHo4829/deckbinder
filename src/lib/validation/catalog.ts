import { z } from "zod";

import type { CollectedCard } from "@/lib/catalog/types";

/**
 * 중간 파일 1행의 형식 계약 — plan §4.8 ⓚ-1 · ⓚ-4.
 *
 * DB 컬럼명을 모른다. `cardInputSchema`(src/lib/validation/admin.ts)와는
 * 별개다 — 그쪽은 관리자 폼의 계약(빈 문자열 → null · uuid FK)이고,
 * 이쪽은 원천의 계약(세트 라벨 문자열 · 아직 uuid 없음 · 코스트/파워 원문)이다.
 */

/**
 * 카탈로그 수집기가 절대 URL을 만들 때 쓰는 유일한 출처.
 *
 * `scripts/collect-catalog.ts`의 호스트 화이트리스트와 **같은 상수**다 —
 * 두 개를 두면 언젠가 하나만 바뀐다(plan §4.8 ⓚ-4).
 */
export const CATALOG_ORIGIN = "https://onepiece-cardgame.kr";

export const collectedCardSchema: z.ZodType<CollectedCard> = z.object({
  sourceSetLabel: z.string(),
  code: z.string(),
  nameKo: z.string(),
  cardType: z.string(),
  colorRaw: z.string(),
  lifeRaw: z.string(),
  powerRaw: z.string(),
  counterRaw: z.string(),
  attribute: z.string(),
  traitsRaw: z.string(),
  rarity: z.string(),
  effectText: z.string(),
  triggerText: z.string(),
  illustrationType: z.string(),
  blockNumberRaw: z.string(),
  imagePath: z.string(),
  page: z.number(),
});

/** 숫자 칸 1개의 정규화 결과. "-"·""은 null, 그 밖의 비숫자 문자열은 invalid + 원문 보존. */
export interface NumericField {
  readonly value: number | null;
  readonly invalid: boolean;
  readonly raw: string;
}

function parseNumericField(raw: string): NumericField {
  const trimmed = raw.trim();
  if (trimmed === "-" || trimmed === "") {
    return { value: null, invalid: false, raw };
  }
  if (/^\d+$/.test(trimmed)) {
    return { value: Number(trimmed), invalid: false, raw };
  }
  // 🚨 null로 삼키지 않는다 — 알려진 "없음" 표기(-·"")와 모르는 문자열을 가른다.
  return { value: null, invalid: true, raw };
}

function parseListField(raw: string, separator: string): readonly string[] {
  return raw
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

interface ParsedCode {
  readonly code: string;
  readonly invalid: boolean;
  readonly multipleUnderscoresWarning: boolean;
}

function parseCode(raw: string): ParsedCode {
  const trimmed = raw.trim();
  const invalid = trimmed.length === 0 || /\s/.test(trimmed);
  const underscoreCount = (trimmed.match(/_/g) ?? []).length;
  return { code: trimmed, invalid, multipleUnderscoresWarning: underscoreCount >= 2 };
}

function toAbsoluteImageUrl(imagePath: string): string {
  return new URL(imagePath, CATALOG_ORIGIN).toString();
}

export const normalizedCardSchema = collectedCardSchema.transform((card) => {
  const codeResult = parseCode(card.code);
  const attributeTrimmed = card.attribute.trim();

  return {
    sourceSetLabel: card.sourceSetLabel,
    code: codeResult.code,
    codeInvalid: codeResult.invalid,
    codeMultipleUnderscoresWarning: codeResult.multipleUnderscoresWarning,
    nameKo: card.nameKo,
    cardType: card.cardType,
    colors: parseListField(card.colorRaw, ","),
    life: parseNumericField(card.lifeRaw),
    power: parseNumericField(card.powerRaw),
    counter: parseNumericField(card.counterRaw),
    // ⚠️ power의 "-"와 cardAttr의 빈 문자열은 다른 표기지만 둘 다 null로 만든다(ⓚ-4).
    attribute: attributeTrimmed.length === 0 ? null : attributeTrimmed,
    traits: parseListField(card.traitsRaw, "/"),
    rarity: card.rarity,
    effectText: normalizeNewlines(card.effectText),
    triggerText: normalizeNewlines(card.triggerText),
    illustrationType: card.illustrationType,
    blockNumber: parseNumericField(card.blockNumberRaw),
    imageUrl: toAbsoluteImageUrl(card.imagePath),
    page: card.page,
  };
});

export type NormalizedCard = z.infer<typeof normalizedCardSchema>;
