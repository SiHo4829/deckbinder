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

/**
 * `<option>`의 value는 games.code가 아니라 games.id(uuid)라 하드코딩할 수 없고,
 * name_ko는 마이그레이션 010이 이미 한 번 바꿨듯 언제든 또 바뀔 수 있다.
 * 대신 fetchGames()가 `order("code")`로 정렬한다는 사실(query.ts)과 games.code
 * 포맷이 `<기본게임>[-<판>]`으로 고정된다는 사실(마이그레이션 010 주석)에 기대,
 * 코드의 알파벳 순으로 옵션 위치를 찾아 그 option의 value(id)를 읽어 넘긴다.
 * name_ko 문자열에는 전혀 의존하지 않는다.
 *
 * `src/lib/validation/card.ts`의 `GAME_CODES`는 값 집합은 같지만 선언 순서라
 * 알파벳 순이 아니다 — 여기 순서와 다른 별개의 목록이니 게임을 추가/삭제할 때
 * 그쪽만 보고 여기를 빠뜨리지 말 것.
 */
const GAME_CODE_ORDER = ["opcg-jp", "opcg-kr", "ptcg"] as const;

async function selectGameByCode(page: Page, code: (typeof GAME_CODE_ORDER)[number]) {
  const index = GAME_CODE_ORDER.indexOf(code);
  const select = page.getByLabel("게임");
  const options = select.locator("option");
  // 게임이 추가/삭제되면 GAME_CODE_ORDER의 인덱스가 밀려 엉뚱한 게임을 가리키게 된다.
  // selectOption({ value })는 어떤 값이든 유효하면 조용히 통과하므로, 그 전에
  // 실제 option 개수와 목록 길이가 어긋나는지 여기서 시끄럽게 확인한다.
  await expect(
    options,
    "games 테이블의 게임 수가 GAME_CODE_ORDER와 어긋납니다. " +
      "게임이 추가/삭제됐다면 이 파일의 GAME_CODE_ORDER를 갱신하세요.",
  ).toHaveCount(GAME_CODE_ORDER.length);
  const value = await options.nth(index).getAttribute("value");
  await select.selectOption({ value: value! });
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
    // 어느 게임인지는 이 테스트의 관심사가 아니다 — game_id가 서로 다르기만 하면 된다.
    for (const gameCode of ["opcg-kr", "ptcg"] as const) {
      await page.goto("/admin/cards/new");
      await selectGameByCode(page, gameCode);
      await page.getByLabel("카드 코드").fill(dupCode);
      await page.getByLabel("일본어 카드명").fill(`${gameCode}${stamp}`);
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
