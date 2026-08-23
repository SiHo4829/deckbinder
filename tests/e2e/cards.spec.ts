import { expect, test } from "@playwright/test";

test.describe("카드 도감", () => {
  test("카드 목록이 렌더링된다", async ({ page }) => {
    await page.goto("/cards");

    await expect(page.getByRole("heading", { name: "카드 도감" })).toBeVisible();
    // 첫 페이지는 40장. 최소 몇 장이라도 카드 타일이 그려져야 한다.
    await expect(page.locator("article").first()).toBeVisible();
    expect(await page.locator("article").count()).toBeGreaterThan(10);
  });

  test("검색어가 URL에 반영되고 결과가 걸러진다", async ({ page }) => {
    await page.goto("/cards");
    await page.locator("article").first().waitFor();

    await page.getByRole("searchbox", { name: "카드 이름 검색" }).fill("マグマ団");

    await expect(page).toHaveURL(/q=/);
    await expect(page.locator("article").first()).toContainText("マグマ団");
  });

  test("URL의 검색어로 진입하면 그대로 복원된다", async ({ page }) => {
    await page.goto(`/cards?q=${encodeURIComponent("マグマ団")}`);

    await expect(page.getByRole("searchbox", { name: "카드 이름 검색" })).toHaveValue(
      "マグマ団",
    );
    await expect(page.locator("article").first()).toContainText("マグマ団");
  });

  test("결과가 없으면 안내를 보여준다", async ({ page }) => {
    await page.goto("/cards?q=zzzznonexistentzzzz");

    await expect(
      page.getByRole("heading", { name: "검색 결과가 없습니다" }),
    ).toBeVisible();
  });

  test("아래로 스크롤하면 다음 페이지를 이어 불러온다", async ({ page }) => {
    await page.goto("/cards");
    await page.locator("article").first().waitFor();

    const initial = await page.locator("article").count();
    await page.mouse.wheel(0, 20000);

    await expect
      .poll(() => page.locator("article").count(), { timeout: 15_000 })
      .toBeGreaterThan(initial);
  });
});
