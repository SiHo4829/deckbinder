import { afterEach, describe, expect, it, vi } from "vitest";

// vi.mock 팩토리는 파일 최상단으로 호이스팅되므로, 그 안에서 참조할 mock 함수도
// vi.hoisted로 같이 끌어올려야 한다. 그냥 top-level const로 두면 TDZ에 걸린다.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath }));

import { revalidateNews } from "@/lib/news/revalidate";

/**
 * 계약(plan T1.12-7): `/news`와 `/news/[slug]`는 동적이라 무효화할 캐시가 없다.
 * 여기서 비우는 것은 **아직 ISR로 남은 두 경로**뿐이다 — 홈과 sitemap.
 *
 * 이 테스트가 지키는 것은 "무엇을 부르는가"가 아니라 **"동적 라우트를 비우려
 * 들지 않는가"**이다. `/news`를 다시 넣는 것은 그 자체로는 무해하지만, 그
 * 라우트가 ISR이라는 오해를 코드에 남긴다.
 */
describe("revalidateNews", () => {
  afterEach(() => {
    revalidatePath.mockClear();
  });

  it("ISR로 남은 경로만 비운다 — 홈과 sitemap", () => {
    revalidateNews();

    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("동적 라우트는 비우지 않는다", () => {
    revalidateNews();

    const paths = revalidatePath.mock.calls.map((c) => c[0] as string);
    expect(paths).not.toContain("/news");
    expect(paths.some((p) => p.startsWith("/news/"))).toBe(false);
  });
});
