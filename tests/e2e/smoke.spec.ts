import { expect, test } from "@playwright/test";

// T1.1 하네스 검증용 스모크 테스트.
// 실제 사용자 흐름 E2E(카드 검색 / 덱 빌더 / 컬렉션)는 T3.7에서 추가한다.
test.describe("애플리케이션 기동", () => {
  test("홈 페이지가 200으로 응답하고 렌더링된다", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("DeckBinder");
    await expect(page.locator("body")).toBeVisible();
  });
});
