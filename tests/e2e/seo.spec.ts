import { expect, test } from "@playwright/test";

test.describe("SEO · 정책 페이지", () => {
  test("robots.txt가 관리자 경로를 막고 sitemap을 가리킨다", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /api/");
    expect(body).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/);
    // 애드센스 크롤러를 막으면 광고 게재가 제한된다.
    expect(body).not.toMatch(/Disallow:\s*\/\s*$/m);
  });

  test("sitemap.xml이 정적 페이지를 포함하고 관리자를 제외한다", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);

    const body = await res.text();
    for (const path of ["/cards", "/news", "/privacy", "/disclaimer"]) {
      expect(body).toContain(`${path}<`);
    }
    expect(body).not.toContain("/admin");
    expect(body).not.toContain("/binder");
  });

  test("개인정보처리방침에 애드센스 필수 고지가 있다", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.getByRole("heading", { name: "개인정보처리방침", level: 1 })).toBeVisible();
    // 심사에서 확인하는 항목들
    await expect(page.getByText(/제3자.*쿠키|쿠키.*광고/)).toBeTruthy();
    await expect(
      page.getByRole("link", { name: "Google 광고 설정" }),
    ).toHaveAttribute("href", "https://www.google.com/settings/ads");
  });

  test("면책 조항이 렌더된다", async ({ page }) => {
    await page.goto("/disclaimer");

    await expect(page.getByRole("heading", { name: "면책 조항", level: 1 })).toBeVisible();
    // 푸터에도 같은 문구가 있으므로 본문으로 범위를 좁힌다.
    await expect(
      page.getByRole("main").getByText(/팬 메이드 서포팅 툴/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "되팔이 목적이 아닙니다" }),
    ).toBeVisible();
  });

  test("푸터에서 정책 페이지로 이동할 수 있다", async ({ page }) => {
    await page.goto("/");

    const footer = page.getByRole("navigation", { name: "사이트 정보" });
    await footer.getByRole("link", { name: "개인정보처리방침" }).click();

    await expect(page).toHaveURL(/\/privacy$/);
  });

  test("애드센스 ID가 없으면 광고를 렌더하지 않는다", async ({ page }) => {
    await page.goto("/news");

    await expect(page.locator(".adsbygoogle")).toHaveCount(0);
  });
});
