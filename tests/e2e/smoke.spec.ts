import { expect, test } from "@playwright/test";

// T1.3 앱 셸 검증. 실제 사용자 흐름 E2E(카드 검색 / 덱 빌더 / 컬렉션)는 T3.7에서 추가한다.
test.describe("앱 셸", () => {
  test("홈 페이지가 200으로 응답하고 렌더링된다", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("덱바인더 (DeckBinder)");
    await expect(
      page.getByRole("heading", { name: "수집과 플레이를 하나로" }),
    ).toBeVisible();
  });

  test("헤더 내비로 카드 도감으로 이동한다", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "카드 도감" }).first().click();

    await expect(page).toHaveURL(/\/cards$/);
    await expect(page.getByRole("heading", { name: "카드 도감" })).toBeVisible();
  });

  test("하위 페이지 타이틀에 템플릿이 적용된다", async ({ page }) => {
    await page.goto("/decks");

    await expect(page).toHaveTitle("덱 레시피 | 덱바인더");
  });

  test("테마 토글이 다크 모드를 적용한다", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: "테마 전환" }).click();

    await expect(html).toHaveClass(/dark/);
  });
});
