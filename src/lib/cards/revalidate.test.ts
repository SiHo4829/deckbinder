import { afterEach, describe, expect, it, vi } from "vitest";

// vi.mock 팩토리는 파일 최상단으로 호이스팅되므로, 그 안에서 참조할 mock 함수도
// vi.hoisted로 같이 끌어올려야 한다. 그냥 top-level const로 두면 TDZ에 걸린다.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath }));

import { revalidateCards } from "@/lib/cards/revalidate";

/**
 * 계약(plan T1.12-7): `/cards/[cardId]`는 동적이라 무효화할 캐시가 없다.
 * 여기서 비우는 것은 **아직 ISR로 남은 두 경로**뿐이다 — 홈과 sitemap.
 *
 * 카드 상세 경로를 다시 넣는 것은 "그 라우트가 ISR"이라는 오해를 코드에
 * 남긴다. 실제로 그 캐시가 삭제한 카드를 최대 1시간 살려 뒀다(§2.7).
 */
describe("revalidateCards", () => {
  afterEach(() => {
    revalidatePath.mockClear();
  });

  it("ISR로 남은 경로만 비운다 — 홈과 sitemap", () => {
    revalidateCards();

    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("카드 상세는 비우지 않는다 — 동적 라우트다", () => {
    revalidateCards();

    const paths = revalidatePath.mock.calls.map((c) => c[0] as string);
    expect(paths.some((p) => p.startsWith("/cards/"))).toBe(false);
  });
});
