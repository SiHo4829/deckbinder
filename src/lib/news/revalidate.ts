import "server-only";

import { revalidatePath } from "next/cache";

/**
 * 뉴스 관련 라우트 캐시 무효화.
 *
 * **`/news`와 `/news/[slug]`는 여기서 비우지 않는다 — 두 라우트는 동적이다**
 * (T1.12-7). 원래는 `revalidate = 300`짜리 ISR이었고, 그 세그먼트 값이
 * `createSupabaseAnonClient`가 부르는 fetch까지 태그 없는 Data Cache 항목으로
 * 만들어서 **발행한 글이 목록에 나타나지 않았다.** 라우트 캐시는 정상적으로
 * 비워졌는데(첫 요청이 `x-nextjs-cache: MISS`) 재생성이 낡은 Data Cache를 다시
 * 읽었다. `revalidateTag`로 그 항목을 비우려 했으나 이 Next 버전에서는 문서가
 * 안내하는 `{ expire: 0 }`으로도 닿지 않는다(§2.7 — 실측). 그래서 캐시를
 * 비우는 대신 **애초에 만들지 않는** 쪽으로 갔다.
 *
 * 여기 남은 두 경로는 **여전히 ISR이라 라우트 캐시 무효화가 필요하고, 그쪽은
 * 확실히 듣는다.**
 */
export function revalidateNews() {
  // 홈은 최신 기사를 보여준다 (ISR 10분).
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
}
