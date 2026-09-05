import { z } from "zod";

/**
 * 관리자 등록 입력 스키마.
 * 폼은 빈 문자열을 보내므로 선택 항목은 null로 정규화해 DB에 그대로 넣는다.
 */

const required = (field: string) =>
  z
    .string({ error: `${field}는 필수입니다.` })
    .trim()
    .min(1, `${field}는 필수입니다.`);

// .default(null)이 있어야 객체에서 키 자체를 생략할 수 있다.
const optional = z
  .string()
  .nullish()
  .default(null)
  .transform((v) => {
    const trimmed = typeof v === "string" ? v.trim() : "";
    return trimmed.length > 0 ? trimmed : null;
  });

const optionalUrl = optional.refine(
  (v) => v === null || z.url().safeParse(v).success,
  "올바른 URL이 아닙니다.",
);

const optionalDate = optional.refine(
  (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
  "발매일은 YYYY-MM-DD 형식이어야 합니다.",
);

export const setInputSchema = z
  .object({
    game_id: z.uuid(),
    code: required("세트 코드"),
    // 009(2026-08-29): cards가 008에서 받은 것과 같은 완화다. 유일 원천이 세트
    // 라벨을 한국어로만 준다는 것이 41개 옵션 전량으로 실측됐다(plan §4.8 ⓙ-10).
    // "필수"를 name_ko와 상호 대체 가능으로 바꾼다 — 아래 object-level .refine()이
    // "둘 중 최소 하나"를 강제한다. 🚨 한국어 라벨로 name_ja를 채우는 것은
    // 여전히 금지다(plan §4.11 ⓔ · 사용자 일감 4d).
    // ⚠️ 이 값은 세트 라벨 표기용이다. ~~§5.3 매물 크롤러의 검색 키~~ — 그
    // 크롤러는 2026-09-03에 폐기됐다(plan §5.7).
    name_ja: optional,
    name_ko: optional,
    released_at: optionalDate,
  })
  .refine((v) => v.name_ko !== null || v.name_ja !== null, {
    message: "name_ko와 name_ja 중 최소 하나는 필요합니다.",
    path: ["name_ja"],
  });

export type SetInput = z.infer<typeof setInputSchema>;

export const keywordInputSchema = z.object({
  game_id: z.uuid(),
  /** 필터 URL과 검색 함수에 쓰이는 안정적인 식별자 */
  code: required("키워드 코드")
    .regex(/^[a-z0-9_]+$/, "키워드 코드는 소문자·숫자·밑줄만 쓸 수 있습니다."),
  label_ko: required("한국어 표기"),
  label_ja: optional,
});

export type KeywordInput = z.infer<typeof keywordInputSchema>;

export const newsPostInputSchema = z.object({
  // URL 경로에 그대로 쓰인다. DB의 check 제약과 같은 형식이어야 한다.
  slug: required("슬러그").regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "슬러그는 소문자·숫자·하이픈만 쓸 수 있고 하이픈으로 시작할 수 없습니다.",
  ),
  title: required("제목"),
  summary: optional,
  content_md: required("본문"),
  thumbnail_url: optionalUrl,
  author_name: optional,
  /** published_at으로 변환한다 (src/lib/news/publish.ts) */
  published: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .nullish()
    .default(false)
    .transform((v) => v === true || v === "true"),
});

export type NewsPostInput = z.infer<typeof newsPostInputSchema>;

export const cardInputSchema = z
  .object({
    game_id: z.uuid(),
    set_id: z
      .string()
      .nullish()
      .default(null)
      .transform((v) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null))
      .refine((v) => v === null || z.uuid().safeParse(v).success, "세트 선택이 올바르지 않습니다."),
    code: required("카드 코드"),
    // name_ja는 일본어 카드명이다. 한국어명이 없으면 화면 표기가 이 값이 된다
    // (plan §4.4의 coalesce(name_ko, name_ja)). ⚠️ ~~매물 크롤러의 유일한
    // 검색 키~~라는 옛 근거는 2026-09-03 시세 축 폐기와 함께 사라졌다
    // (plan §5.7).
    // T1.17(2026-08-29): 유일 원천(onepiece-cardgame.kr)이 일본어명을 주지 않는
    // 것이 실측됐다(plan §4.8 ⓙ-1). "필수"는 name_ko와 상호 대체 가능으로
    // 완화한다 — 단독 필수는 유지하지 않는다. 아래 object-level .refine()이
    // "둘 중 최소 하나"를 강제한다. name_ko를 대신 채우는 것은 여전히 금지다
    // (plan §4.8 ⓕ 🚨 — name_ja를 한국어명으로 오염시키지 않는다).
    name_ja: optional,
    name_ko: optional,
    name_en: optional,
    rarity: optional,
    attribute: optional,
    card_type: optional,
    /** basic_energy면 덱 매수 제한에서 면제된다 (plan §4.0) */
    sub_type: optional,
    image_url: optionalUrl,
    effect_text: optional,
    /** 효과 키워드. card_keywords에 별도로 넣는다. */
    keyword_ids: z.array(z.uuid()).nullish().default([]).transform((v) => v ?? []),
  })
  .refine((v) => v.name_ko !== null || v.name_ja !== null, {
    message: "name_ko와 name_ja 중 최소 하나는 필요합니다.",
    path: ["name_ja"],
  });

export type CardInput = z.infer<typeof cardInputSchema>;
