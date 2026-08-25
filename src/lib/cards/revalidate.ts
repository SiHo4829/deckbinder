import "server-only";

import { revalidatePath } from "next/cache";

/**
 * 카드 관련 라우트 캐시 무효화.
 *
 * 이름을 `revalidateCardDetail`에서 `revalidateCards`로 바꿨다(T1.12-7).
 * 이 함수가 비우는 것은 카드 상세뿐이 아니다 — 홈 쇼케이스(`fetchShowcaseCards`)와
 * sitemap의 카드 URL(`fetchAllCardUrls`)도 같은 쓰기에 영향을 받는다.
 * "상세만 비운다"고 읽히는 옛 이름은 다음 사람을 오도한다.
 *
 * **`/cards/[cardId]`는 여기서 비우지 않는다 — 그 라우트는 동적이다**(T1.12-7).
 * 원래는 `revalidate = 3600`짜리 ISR이었고, 그 세그먼트 값이 `createSupabaseAnonClient`가
 * 부르는 fetch까지 태그 없는 Data Cache 항목으로 만들어서 **삭제한 카드가 최대
 * 1시간 동안 200을 계속 돌려줬다.** `revalidateTag`로 그 항목을 비우려 했으나
 * 이 Next 버전에서는 어떤 형태로도 닿지 않는다(§2.7 — 실측). 그래서 캐시를
 * 비우는 대신 **애초에 만들지 않는** 쪽으로 갔다.
 *
 * 여기 남은 두 경로는 **여전히 ISR이라 라우트 캐시 무효화가 필요하고, 그쪽은
 * 확실히 듣는다**(무효화 직후 첫 요청이 `x-nextjs-cache: MISS`).
 */
export function revalidateCards() {
  // 홈은 최신 카드 쇼케이스를 보여준다 (ISR 10분).
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
}
