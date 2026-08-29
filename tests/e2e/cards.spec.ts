import { expect, test } from "@playwright/test";

// 카탈로그는 관리자 화면에서 직접 채운다. 데이터 양을 전제하지 않고
// 검색·URL 동기화·빈 결과 처리 같은 동작만 검증한다.
// 등록 후 도감 반영은 admin.spec.ts가 확인한다.
test.describe("카드 도감", () => {
  test("도감 페이지가 열린다", async ({ page }) => {
    const response = await page.goto("/cards");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "카드 도감" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "카드 이름 검색" })).toBeVisible();
  });

  test("검색어가 URL에 반영된다", async ({ page }) => {
    await page.goto("/cards");

    await page.getByRole("searchbox", { name: "카드 이름 검색" }).fill("루피");

    await expect(page).toHaveURL(/q=/);
  });

  test("URL의 검색어가 입력창에 복원된다", async ({ page }) => {
    await page.goto("/cards?q=%EB%A3%A8%ED%94%BC");

    await expect(page.getByRole("searchbox", { name: "카드 이름 검색" })).toHaveValue("루피");
  });

  test("결과가 없으면 안내를 보여준다", async ({ page }) => {
    await page.goto("/cards?q=zzzznonexistentzzzz");

    await expect(
      page.getByRole("heading", { name: "검색 결과가 없습니다" }),
    ).toBeVisible();
  });

  test("게임 필터가 URL에 반영된다", async ({ page }) => {
    await page.goto("/cards");

    await page.getByLabel("게임 선택").click();
    await page.getByRole("option", { name: "원피스" }).click();

    await expect(page).toHaveURL(/game=opcg-kr/);
  });
});
