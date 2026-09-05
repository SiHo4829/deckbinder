import { z } from "zod";

/**
 * 환경변수 묶음을 검증한다. 실패하면 누락 · 형식 오류를 한 번에 모아
 * 부팅 시점에 즉시 실패시킨다 (런타임에 undefined가 흘러다니는 것을 막는다).
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: unknown,
  label = "환경변수",
): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `${label} 설정이 올바르지 않습니다. .env.local을 확인하세요.\n${details}`,
    );
  }

  return result.data;
}

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
  // 카드 이미지 리버스 프록시의 base URL (T1.30 · plan §3.5).
  // 🚨 optional이다. 필수로 걸면 프록시를 배포하기 전에는 앱이 부팅조차 못 한다.
  //    없으면 proxiedImageUrl()이 전량 null을 내고 화면은 폴백으로 착지한다
  //    — 그것이 정상 동작이고 T1.31 ⓕ가 단위 테스트로 단언하는 것이다.
  NEXT_PUBLIC_IMAGE_PROXY_BASE: z.string().optional(),
});

// Next는 NEXT_PUBLIC_* 를 빌드 시 리터럴로 치환한다.
// process.env를 통째로 넘기면 치환이 일어나지 않으므로 키마다 직접 참조한다.
export const clientEnv = parseEnv(
  clientSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_IMAGE_PROXY_BASE: process.env.NEXT_PUBLIC_IMAGE_PROXY_BASE,
  },
  "클라이언트 환경변수",
);
