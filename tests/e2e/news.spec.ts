import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m
  .exec(readFileSync(".env.local", "utf8"))?.[1]
  ?.trim();

// beforeAll이 만든 데이터를 모든 테스트가 공유한다.
test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("관리자 토큰").fill(ADMIN_TOKEN!);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("뉴스", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  const stamp = Date.now().toString().slice(-6);
  const publishedSlug = `pub-${stamp}`;
  const draftSlug = `draft-${stamp}`;
  const publishedTitle = `발행글${stamp}`;
  const draftTitle = `초안글${stamp}`;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);

    const posts = [
      {
        slug: publishedSlug,
        title: publishedTitle,
        published: "발행",
        body: `## 소제목${stamp}\n\n본문입니다.\n\n- 첫째\n- 둘째\n\n[외부](https://example.com)`,
      },
      { slug: draftSlug, title: draftTitle, published: "초안", body: "초안 본문" },
    ];

    for (const p of posts) {
      await page.goto("/admin/news/new");
      await page.getByLabel("슬러그").fill(p.slug);
      await page.getByLabel("제목").fill(p.title);
      await page.getByLabel("요약").fill(`${p.title} 요약`);
      await page.getByLabel("본문").fill(p.body);
      await page.getByLabel("발행 상태").selectOption({ label: p.published });
      await page.getByRole("button", { name: "등록" }).click();
      await expect(page.getByTestId("form-status")).toContainText("등록 완료");
    }

    await page.close();
  });

  test("발행된 글은 목록에 보이고 초안은 보이지 않는다", async ({ page }) => {
    await page.goto("/news");

    await expect(page.getByRole("link", { name: new RegExp(publishedTitle) })).toBeVisible();
    await expect(page.getByText(draftTitle)).toHaveCount(0);
  });

  test("목록에서 기사로 이동한다", async ({ page }) => {
    await page.goto("/news");

    await page.getByRole("link", { name: new RegExp(publishedTitle) }).click();

    await expect(page).toHaveURL(new RegExp(`/news/${publishedSlug}$`));
    await expect(page.getByRole("heading", { name: publishedTitle, level: 1 })).toBeVisible();
  });

  // RLS가 초안을 막는지 확인한다. slug를 알아도 열리면 안 된다.
  test("초안은 주소를 알아도 404다", async ({ page }) => {
    const res = await page.goto(`/news/${draftSlug}`);

    expect(res?.status()).toBe(404);
  });

  test("없는 slug는 404다", async ({ page }) => {
    const res = await page.goto(`/news/does-not-exist-${stamp}`);

    expect(res?.status()).toBe(404);
  });

  test("마크다운이 HTML로 렌더된다", async ({ page }) => {
    await page.goto(`/news/${publishedSlug}`);

    // 푸터에도 목록이 있으므로 기사 본문으로 범위를 좁힌다.
    const article = page.getByRole("article");

    await expect(
      article.getByRole("heading", { name: `소제목${stamp}`, level: 2 }),
    ).toBeVisible();
    await expect(article.getByRole("listitem")).toHaveCount(2);

    const external = article.getByRole("link", { name: "외부" });
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", /noopener/);
  });

  test("상세 타이틀에 템플릿이 적용된다", async ({ page }) => {
    await page.goto(`/news/${publishedSlug}`);

    await expect(page).toHaveTitle(`${publishedTitle} | 덱바인더`);
  });

  test("인증 없이 뉴스 API를 호출하면 401이다", async ({ request }) => {
    const res = await request.post("/api/admin/news", {
      data: { slug: "x", title: "t", content_md: "c" },
    });

    expect(res.status()).toBe(401);
  });

  test("잘못된 슬러그는 400이다", async ({ page }) => {
    await login(page);
    await page.goto("/admin/news/new");

    await page.getByLabel("슬러그").fill("Hello World");
    await page.getByLabel("제목").fill("t");
    await page.getByLabel("본문").fill("c");
    await page.getByRole("button", { name: "등록" }).click();

    await expect(page.getByTestId("form-error")).toContainText("슬러그");
  });

  test("초안을 발행하면 목록에 나타난다", async ({ page }) => {
    await login(page);
    await page.goto("/admin/news");

    await page
      .getByRole("row", { name: new RegExp(draftTitle) })
      .getByRole("link", { name: "수정" })
      .click();
    await page.getByLabel("발행 상태").selectOption({ label: "발행" });
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByTestId("form-status")).toContainText("저장 완료");

    // 첫 방문에 보인다 — /news는 동적이다(T1.12-7). ISR이던 때는 여기서
    // 재방문 폴링이 필요했고, 그마저도 실제로는 듣지 않았다(§2.7).
    // 제목은 h2와 요약("…글 요약") 두 곳에 나타나므로 링크로 좁힌다.
    await page.goto("/news");
    await expect(page.getByRole("link", { name: new RegExp(draftTitle) })).toBeVisible();
  });

  // 내려야 할 글이 계속 열리는 것은 지연이 아니라 사고다. 위 "초안은 주소를
  // 알아도 404다"는 처음부터 초안인 글이라 이 경로를 덮지 못한다 —
  // **한 번 열어 본 뒤** 내린 글이어야 캐시가 관여한다(T1.12-7 완료 기준 4).
  test("발행을 취소하면 상세가 즉시 404다", async ({ page }) => {
    await login(page);

    const slug = `unpub-${stamp}`;
    const title = `취소글${stamp}`;

    await page.goto("/admin/news/new");
    await page.getByLabel("슬러그").fill(slug);
    await page.getByLabel("제목").fill(title);
    await page.getByLabel("요약").fill("요약");
    await page.getByLabel("본문").fill("본문");
    await page.getByLabel("발행 상태").selectOption({ label: "발행" });
    await page.getByRole("button", { name: "등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    // 먼저 열어 본다 — 이 방문이 캐시를 만든다.
    const published = await page.goto(`/news/${slug}`);
    expect(published?.status()).toBe(200);

    await page.goto("/admin/news");
    await page
      .getByRole("row", { name: new RegExp(title) })
      .getByRole("link", { name: "수정" })
      .click();
    await page.getByLabel("발행 상태").selectOption({ label: "초안" });
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByTestId("form-status")).toContainText("저장 완료");

    const unpublished = await page.goto(`/news/${slug}`);
    expect(unpublished?.status()).toBe(404);
  });
});
