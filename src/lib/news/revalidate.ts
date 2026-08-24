import "server-only";

import { revalidatePath } from "next/cache";

/**
 * 뉴스 관련 ISR 캐시 무효화.
 *
 * 라우트마다 경로 목록을 따로 적으면 하나를 빠뜨려도 **에러 없이 낡은 페이지가 남는다.**
 * `revalidate`(300)만 믿으면 최대 5분 지연되므로 저장 직후 명시적으로 비운다.
 */
export function revalidateNews(slug: string, previousSlug?: string | null) {
  revalidatePath("/news");
  revalidatePath(`/news/${slug}`);
  // 슬러그를 바꿨다면 예전 경로도 비운다. 안 그러면 옛 URL이 낡은 내용을 계속 준다.
  if (previousSlug && previousSlug !== slug) revalidatePath(`/news/${previousSlug}`);
  revalidatePath("/sitemap.xml");
}
