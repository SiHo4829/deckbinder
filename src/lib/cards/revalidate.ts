import "server-only";

import { revalidatePath } from "next/cache";

/**
 * 카드 상세 ISR 캐시 무효화.
 *
 * `/cards/[cardId]`는 `revalidate = 3600`으로 캐시된다(익명 클라이언트 + ISR —
 * `cookies()`를 쓰면 강제 동적 렌더링이 되므로 T1.9에서 이 방식으로 바꿨다).
 * 관리자가 수정·삭제해도 캐시가 자연 만료될 때까지 낡은 페이지가 남는다 —
 * 특히 삭제 뒤에도 한동안 200을 계속 돌려준다. `src/lib/news/revalidate.ts`의
 * `revalidateNews`와 같은 패턴이다.
 */
export function revalidateCardDetail(cardId: string) {
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/sitemap.xml");
}
