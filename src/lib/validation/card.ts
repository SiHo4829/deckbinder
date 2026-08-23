import { z } from "zod";

/** 지원 게임 코드 (plan §4.0) */
export const GAME_CODES = ["ptcg", "opcg"] as const;

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v.length > 0 ? v : undefined))
  .optional();

/**
 * 도감 검색 파라미터.
 * limit 상한을 두는 이유는 성능뿐 아니라 대량 수집 억제다 (plan P3).
 */
export const cardSearchParamsSchema = z.object({
  q: optionalText,
  game: z.enum(GAME_CODES).optional(),
  set: optionalText,
  rarity: optionalText,
  attribute: optionalText,
  cardType: optionalText,
  keywords: z.array(z.string().trim().min(1)).default([]),
  cursor: optionalText,
  // URL은 사용자가 직접 고칠 수 있으므로 범위를 벗어나면 400 대신 상한으로 잘라낸다.
  // 상한 100은 성능뿐 아니라 대량 수집 억제 목적이다 (plan P3).
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((value) =>
      value === undefined || Number.isNaN(value)
        ? 40
        : Math.min(100, Math.max(1, value)),
    ),
});

export type CardSearchParams = z.infer<typeof cardSearchParamsSchema>;

/** URLSearchParams를 스키마 입력 형태로 정규화한다. */
export function parseCardSearchParams(params: URLSearchParams): CardSearchParams {
  const keywords = params
    .getAll("keywords")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const raw: Record<string, unknown> = { keywords };
  for (const key of ["q", "game", "set", "rarity", "attribute", "cardType", "cursor"]) {
    const value = params.get(key);
    if (value !== null && value.trim().length > 0) raw[key] = value;
  }
  const limit = params.get("limit");
  if (limit !== null && limit.trim().length > 0) raw.limit = limit;

  return cardSearchParamsSchema.parse(raw);
}
