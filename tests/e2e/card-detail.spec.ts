import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m
  .exec(readFileSync(".env.local", "utf8"))?.[1]
  ?.trim();

// beforeAll이 만든 데이터를 모든 테스트가 공유한다.
// 병렬로 돌리면 워커마다 beforeAll이 각자 다른 stamp로 다시 실행되어 어긋난다.
test.describe.configure({ mode: "serial" });

test.describe("카드 상세", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  const stamp = Date.now().toString().slice(-6);
  const setCode = `D${stamp}`;
  const baseCode = `${setCode}-001`;
  const nameKo = `상세${stamp}`;
  const keywordCode = `d${stamp}draw`;
  const keywordLabel = `드로우${stamp}`;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    await page.goto("/admin/login");
    await page.getByLabel("관리자 토큰").fill(ADMIN_TOKEN!);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/keywords");
    await page.getByLabel("키워드 코드").fill(keywordCode);
    await page.getByLabel("한국어 표기").fill(keywordLabel);
    await page.getByRole("button", { name: "키워드 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    await page.goto("/admin/sets");
    await page.getByLabel("세트 코드").fill(setCode);
    await page.getByLabel("일본어 세트명").fill(`セット${stamp}`);
    await page.getByRole("button", { name: "세트 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    // 같은 base_code의 인쇄본 3장 + 무관한 카드 1장
    const cards = [
      { code: baseCode, rarity: "L", tagged: true },
      { code: `${baseCode}_p1`, rarity: "SEC", tagged: false },
      { code: `${baseCode}_p2`, rarity: "SP", tagged: false },
      { code: `${setCode}-002`, rarity: "R", tagged: false },
    ];
    for (const c of cards) {
      await page.goto("/admin/cards/new");
      await page.getByLabel("카드 코드").fill(c.code);
      await page.getByLabel("일본어 카드명").fill(`テスト${stamp}`);
      await page.getByLabel("한국어 카드명").fill(nameKo);
      await page.getByLabel("레어도").fill(c.rarity);
      if (c.tagged) {
        await page.getByRole("button", { name: keywordLabel, exact: true }).click();
        await page.getByLabel("효과 텍스트").fill(`카드를 ${stamp}장 뽑는다.`);
      }
      await page.getByRole("button", { name: "카드 등록" }).click();
      await expect(page.getByTestId("form-status")).toContainText("등록 완료");
    }

    await page.close();
  });

  /** 코드로 카드 id를 찾아 상세로 바로 간다. 그리드 클릭은 별도 테스트가 본다. */
  async function openByCode(page: Page, code: string) {
    const res = await page.request.get(
      `/api/cards?q=${encodeURIComponent(nameKo)}&limit=100`,
    );
    const body = (await res.json()) as { items: { id: string; code: string }[] };
    const card = body.items.find((c) => c.code === code);
    expect(card, `${code} 카드를 찾지 못했습니다`).toBeTruthy();
    await page.goto(`/cards/${card!.id}`);
  }

  test("도감에서 카드를 누르면 상세로 이동한다", async ({ page }) => {
    await page.goto(`/cards?q=${encodeURIComponent(nameKo)}`);

    // 코드가 정확히 일치하는 타일만 고른다. 접두사만 보면 패러렐과 겹친다.
    const tile = page
      .locator("article")
      .filter({ has: page.getByText(baseCode, { exact: true }) });
    await expect(tile).toHaveCount(1);
    await tile.getByRole("link").click();

    await expect(page).toHaveURL(/\/cards\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: nameKo })).toBeVisible();
  });

  test("같은 base_code의 다른 인쇄본이 대체 카드로 나온다", async ({ page }) => {
    await openByCode(page, baseCode);

    const section = page.locator("section", {
      has: page.getByRole("heading", { name: "같은 카드의 다른 버전" }),
    });
    await expect(section.getByRole("link")).toHaveCount(2);
    await expect(section).toContainText(`${baseCode}_p1`);
    await expect(section).toContainText(`${baseCode}_p2`);
    // 다른 카드는 섞이지 않는다.
    await expect(section).not.toContainText(`${setCode}-002`);
  });

  test("효과 키워드를 누르면 그 키워드로 도감이 걸러진다", async ({ page }) => {
    await openByCode(page, baseCode);

    await page.getByRole("link", { name: keywordLabel }).click();

    await expect(page).toHaveURL(new RegExp(`keywords=${keywordCode}`));
  });

  test("대체본이 없는 카드에는 해당 섹션이 없다", async ({ page }) => {
    await openByCode(page, `${setCode}-002`);

    await expect(
      page.getByRole("heading", { name: "같은 카드의 다른 버전" }),
    ).toHaveCount(0);
  });

  // E-6이 "기준가 데이터가 없으면 산출 불가" E2E를 지웠고 그 자리를 자체
  // 희귀도 점수 배지가 받는다(T2.15). 점수 숫자는 시드 데이터에 따라 달라지므로
  // 단언하지 않는다 — 항상 그려지는 표식(고지 문구)만 본다.
  test("자체 희귀도 점수 배지가 카드 상세에 뜬다", async ({ page }) => {
    await openByCode(page, baseCode);

    await expect(page.getByText("덱바인더 자체 산정값")).toBeVisible();
  });
});
