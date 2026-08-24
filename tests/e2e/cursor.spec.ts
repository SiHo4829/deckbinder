import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m
  .exec(readFileSync(".env.local", "utf8"))?.[1]
  ?.trim();

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("관리자 토큰").fill(ADMIN_TOKEN!);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.configure({ mode: "serial" });

/**
 * 커서 페이지네이션 (마이그레이션 007).
 *
 * cards의 유니크 제약은 `(game_id, code)`라 code만으로는 정렬 키가 유일하지 않다.
 * 구버전 search_cards는 `c.code > p_cursor`로 넘겨서, **게임 필터 없이** 훑을 때
 * 두 게임에 같은 code가 있으면 뒤 카드를 통째로 건너뛰었다.
 * 에러도 빈 화면도 없이 카드가 사라지는 유형이라 UI가 아니라 API로 직접 확인한다.
 */
test.describe("도감 커서", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  const stamp = Date.now().toString().slice(-6);
  const dupCode = `DUP-${stamp}`;
  // 레어도로 이 테스트의 카드 2장만 골라낸다. 게임 필터는 쓰면 안 된다 —
  // 게임을 좁히면 재현하려는 상황 자체가 사라진다.
  const rarity = `CUR${stamp}`;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);

    // 같은 코드를 두 게임에 하나씩. (game_id, code) 유니크라 DB는 이를 허용한다.
    for (const game of ["원피스 카드 게임", "포켓몬 카드 게임"]) {
      await page.goto("/admin/cards/new");
      await page.getByLabel("게임").selectOption({ label: game });
      await page.getByLabel("카드 코드").fill(dupCode);
      await page.getByLabel("일본어 카드명").fill(`${game}${stamp}`);
      await page.getByLabel("레어도").fill(rarity);
      await page.getByRole("button", { name: "카드 등록" }).click();
      await expect(page.getByTestId("form-status")).toContainText("등록 완료");
    }

    await page.close();
  });

  test("같은 코드가 두 게임에 있어도 페이지를 넘기며 둘 다 받는다", async ({ request }) => {
    const first = await request.get(`/api/cards?rarity=${rarity}&limit=1`);
    expect(first.status()).toBe(200);
    const page1 = (await first.json()) as {
      items: { id: string; code: string }[];
      nextCursor: { code: string; id: string } | null;
    };

    expect(page1.items).toHaveLength(1);
    // 아직 한 장 남았으므로 커서가 있어야 한다.
    expect(page1.nextCursor).not.toBeNull();
    expect(page1.nextCursor!.code).toBe(dupCode);

    const second = await request.get(
      `/api/cards?rarity=${rarity}&limit=1` +
        `&cursor=${encodeURIComponent(page1.nextCursor!.code)}` +
        `&cursorId=${page1.nextCursor!.id}`,
    );
    expect(second.status()).toBe(200);
    const page2 = (await second.json()) as {
      items: { id: string; code: string }[];
      nextCursor: { code: string; id: string } | null;
    };

    // 구버전이라면 `code > 'DUP-...'`가 같은 코드를 통째로 걸러 여기가 0장이 됐다.
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]!.code).toBe(dupCode);
    expect(page2.items[0]!.id).not.toBe(page1.items[0]!.id);
    expect(page2.nextCursor).toBeNull();
  });

  test("커서 없이 한 번에 받으면 두 장이 모두 나온다", async ({ request }) => {
    const res = await request.get(`/api/cards?rarity=${rarity}&limit=40`);
    const body = (await res.json()) as { items: { code: string }[] };

    expect(body.items).toHaveLength(2);
    expect(body.items.every((c) => c.code === dupCode)).toBe(true);
  });

  test("잘못된 형식의 cursorId는 400이다", async ({ request }) => {
    const res = await request.get(`/api/cards?rarity=${rarity}&cursor=X&cursorId=not-a-uuid`);

    expect(res.status()).toBe(400);
  });
});
