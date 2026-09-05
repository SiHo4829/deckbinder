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

// beforeAll이 만든 데이터를 모든 테스트가 공유한다.
// 병렬로 돌리면 워커마다 beforeAll이 다시 실행되어 같은 데이터를 중복 생성한다.
test.describe.configure({ mode: "serial" });

/**
 * 필터는 등록된 데이터에 의존한다. 테스트가 자기 데이터를 만들어 쓰고,
 * 고유 접두사로 다른 테스트와 섞이지 않게 한다.
 */
test.describe("도감 필터 확장", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  const stamp = Date.now().toString().slice(-6);
  const setCode = `F${stamp}`;
  const drawCode = `f${stamp}draw`;
  const counterCode = `f${stamp}counter`;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);

    await page.goto("/admin/keywords");
    for (const [code, label] of [
      [drawCode, `드로우${stamp}`],
      [counterCode, `카운터${stamp}`],
    ]) {
      // 카드도 opcg-kr로 등록한다(아래). 키워드 폼 역시 기본값이 games[0](opcg-jp)라
      // 그대로 두면 카드의 availableKeywords(game_id 일치 필터)에서 빠져 버튼이 안 뜬다.
      await selectGameByCode(page, "opcg-kr");
      await page.getByLabel("키워드 코드").fill(code);
      await page.getByLabel("한국어 표기").fill(label);
      await page.getByRole("button", { name: "키워드 등록" }).click();
      await expect(page.getByTestId("form-status")).toContainText("등록 완료");
    }

    await page.goto("/admin/sets");
    await page.getByLabel("세트 코드").fill(setCode);
    await page.getByLabel("일본어 세트명").fill(`セット${stamp}`);
    await page.getByRole("button", { name: "세트 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    // 드로우만 / 드로우+카운터 두 장을 만든다.
    const cards = [
      { code: `${setCode}-001`, name: `드로만${stamp}`, keywords: [`드로우${stamp}`] },
      {
        code: `${setCode}-002`,
        name: `둘다${stamp}`,
        keywords: [`드로우${stamp}`, `카운터${stamp}`],
      },
    ];
    for (const c of cards) {
      await page.goto("/admin/cards/new");
      // 이 스펙의 조회는 전부 game=opcg-kr을 고정으로 쓴다(78·86·94·102·111행).
      // CardForm의 기본값(games[0])에 기대지 않고 명시적으로 맞춘다.
      await selectGameByCode(page, "opcg-kr");
      await page.getByLabel("카드 코드").fill(c.code);
      await page.getByLabel("일본어 카드명").fill(c.name);
      await page.getByLabel("한국어 카드명").fill(c.name);
      await page.getByLabel("레어도").fill(`RR${stamp}`);
      for (const kw of c.keywords) {
        await page.getByRole("button", { name: kw, exact: true }).click();
      }
      await page.getByRole("button", { name: "카드 등록" }).click();
      await expect(page.getByTestId("form-status")).toContainText("등록 완료");
    }

    await page.close();
  });

  test("레어도 필터가 URL에 반영되고 결과를 좁힌다", async ({ page }) => {
    await page.goto(`/cards?game=opcg-kr&rarity=RR${stamp}`);

    await expect(page.locator("article")).toHaveCount(2);
    await expect(page.locator("article").first()).toContainText(stamp);
  });

  test("키워드 하나를 고르면 그 키워드를 가진 카드가 모두 나온다", async ({ page }) => {
    await page.goto(`/cards?game=opcg-kr&rarity=RR${stamp}&keywords=${drawCode}`);

    await expect(page.locator("article")).toHaveCount(2);
  });

  test("키워드를 여러 개 고르면 모두 가진 카드만 남는다 (AND 조합)", async ({ page }) => {
    // nuqs는 배열을 쉼표로 직렬화한다. 키워드 코드에 쉼표를 못 쓰게 막아둔 이유다.
    await page.goto(
      `/cards?game=opcg-kr&rarity=RR${stamp}&keywords=${drawCode},${counterCode}`,
    );

    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article").first()).toContainText(`둘다${stamp}`);
  });

  test("키워드 칩을 눌러 필터를 걸면 URL에 반영된다", async ({ page }) => {
    await page.goto(`/cards?game=opcg-kr&rarity=RR${stamp}`);

    await page.getByRole("button", { name: `카운터${stamp}` }).click();

    await expect(page).toHaveURL(new RegExp(`keywords=${counterCode}`));
    await expect(page.locator("article")).toHaveCount(1);
  });

  test("게임을 바꾸면 하위 필터가 함께 초기화된다", async ({ page }) => {
    await page.goto(`/cards?game=opcg-kr&rarity=RR${stamp}&keywords=${drawCode}`);

    await page.getByLabel("게임 선택").click();
    await page.getByRole("option", { name: "포켓몬" }).click();

    await expect(page).toHaveURL(/game=ptcg/);
    await expect(page).not.toHaveURL(/rarity=/);
    await expect(page).not.toHaveURL(/keywords=/);
  });
});
