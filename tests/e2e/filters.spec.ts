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
    await page.goto(`/cards?game=opcg&rarity=RR${stamp}`);

    await expect(page.locator("article")).toHaveCount(2);
    await expect(page.locator("article").first()).toContainText(stamp);
  });

  test("키워드 하나를 고르면 그 키워드를 가진 카드가 모두 나온다", async ({ page }) => {
    await page.goto(`/cards?game=opcg&rarity=RR${stamp}&keywords=${drawCode}`);

    await expect(page.locator("article")).toHaveCount(2);
  });

  test("키워드를 여러 개 고르면 모두 가진 카드만 남는다 (AND 조합)", async ({ page }) => {
    // nuqs는 배열을 쉼표로 직렬화한다. 키워드 코드에 쉼표를 못 쓰게 막아둔 이유다.
    await page.goto(
      `/cards?game=opcg&rarity=RR${stamp}&keywords=${drawCode},${counterCode}`,
    );

    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article").first()).toContainText(`둘다${stamp}`);
  });

  test("키워드 칩을 눌러 필터를 걸면 URL에 반영된다", async ({ page }) => {
    await page.goto(`/cards?game=opcg&rarity=RR${stamp}`);

    await page.getByRole("button", { name: `카운터${stamp}` }).click();

    await expect(page).toHaveURL(new RegExp(`keywords=${counterCode}`));
    await expect(page.locator("article")).toHaveCount(1);
  });

  test("게임을 바꾸면 하위 필터가 함께 초기화된다", async ({ page }) => {
    await page.goto(`/cards?game=opcg&rarity=RR${stamp}&keywords=${drawCode}`);

    await page.getByLabel("게임 선택").click();
    await page.getByRole("option", { name: "포켓몬" }).click();

    await expect(page).toHaveURL(/game=ptcg/);
    await expect(page).not.toHaveURL(/rarity=/);
    await expect(page).not.toHaveURL(/keywords=/);
  });
});
