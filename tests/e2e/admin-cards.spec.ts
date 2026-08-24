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

test.describe("관리자 카드 목록", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  test("검색으로 등록 카드를 찾고 페이지를 넘긴다", async ({ page }) => {
    // 22건을 API로 직접 등록한다 — 폼을 22번 채우는 것보다 훨씬 빠르다.
    test.setTimeout(60_000);
    await login(page);

    // 별도 게임 조회 API가 없다 — 등록 폼의 기본 선택값(첫 게임)을 그대로 쓴다.
    await page.goto("/admin/cards/new");
    const gameId = await page.locator("#card-game").inputValue();
    expect(gameId).toBeTruthy();

    const stamp = Date.now().toString().slice(-6);
    const prefix = `PGE${stamp}`;
    const total = 22; // 페이지당 20건이므로 2페이지로 나뉜다.

    for (let i = 1; i <= total; i += 1) {
      const code = `${prefix}-${String(i).padStart(3, "0")}`;
      const res = await page.request.post("/api/admin/cards", {
        data: { game_id: gameId, code, name_ja: `ページ${stamp}` },
      });
      expect(res.ok(), `카드 ${code} 생성 실패`).toBeTruthy();
    }

    await page.goto(`/admin/cards?q=${encodeURIComponent(prefix)}`);
    await expect(page.getByText(`총 ${total}건`)).toBeVisible();

    const pagination = page.getByTestId("admin-pagination");
    await expect(pagination).toBeVisible();
    await expect(page.getByText(`${prefix}-001`)).toBeVisible();
    await expect(page.getByText(`${prefix}-022`)).toHaveCount(0);

    await pagination.getByRole("link", { name: "다음" }).click();

    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(`${prefix}-022`)).toBeVisible();
    await expect(page.getByText(`${prefix}-001`)).toHaveCount(0);
  });

  test("등록한 카드를 수정(키워드 토글 포함)하고 삭제한다", async ({ page }) => {
    // 왕복 하나에 이동·등록·수정·삭제가 모두 들어 있어 콜드 라우트가 몰리면
    // 기본 30초로는 빠듯하다 (plan §2.7 "E2E 단언 타임아웃 < 콜드 라우트").
    test.setTimeout(60_000);
    const stamp = Date.now().toString().slice(-6);
    const code = `RT${stamp}-001`;
    const nameJa = `テスト${stamp}`;
    const nameJaEdited = `テスト${stamp}改`;
    const keywordCode = `rt${stamp}kw`;
    const keywordLabel = `되찾기${stamp}`;

    await login(page);

    // 키워드를 먼저 만들어야 카드 폼에서 태깅할 수 있다.
    await page.goto("/admin/keywords");
    await page.getByLabel("키워드 코드").fill(keywordCode);
    await page.getByLabel("한국어 표기").fill(keywordLabel);
    await page.getByRole("button", { name: "키워드 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    // 카드 등록 (태깅 없이)
    await page.goto("/admin/cards/new");
    await page.getByLabel("카드 코드").fill(code);
    await page.getByLabel("일본어 카드명").fill(nameJa);
    await page.getByRole("button", { name: "카드 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    // 목록에서 검색해 수정 화면으로 들어간다 — 카드 도달 경로는 목록 하나로 모은다(plan §4.5).
    await page.goto(`/admin/cards?q=${encodeURIComponent(code)}`);
    await page.getByRole("link", { name: "수정" }).click();
    await expect(page).toHaveURL(/\/admin\/cards\/[0-9a-f-]{36}$/);
    const cardId = page.url().split("/").pop()!;
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    // 이름을 고치고 키워드를 하나 켠 뒤 저장한다.
    await page.getByLabel("일본어 카드명").fill(nameJaEdited);
    await page.getByRole("button", { name: keywordLabel, exact: true }).click();
    await page.locator("form").getByRole("button", { name: "저장" }).click();
    await expect(page.getByTestId("form-status")).toContainText("저장 완료");

    // 도감 상세에 즉시 반영된다 (T1.12-2 완료 기준).
    const detailRes = await page.goto(`/cards/${cardId}`);
    expect(detailRes?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: nameJaEdited })).toBeVisible();
    await expect(page.getByRole("link", { name: keywordLabel })).toBeVisible();

    // 키워드 필터에도 반영된다 (T1.12-3 완료 기준). 공개 검색(search_cards)은 q에서
    // code를 보지 않으므로(관리자 검색과 다른 이유가 plan §8 T1.12-1에 있다) 여기서는
    // 이 테스트에서만 쓰는 고유 키워드만으로 좁힌다.
    await page.goto(`/cards?keywords=${keywordCode}`);
    await expect(page.locator("article").first()).toContainText(code);

    // 삭제 — 확인 → 삭제 2단계.
    await page.goto(`/admin/cards/${cardId}`);
    const deleteZone = page.getByTestId("admin-delete-zone");
    await deleteZone.getByRole("button", { name: "삭제" }).click();
    await deleteZone.getByRole("button", { name: `"${code}" 삭제` }).click();

    await expect(page).toHaveURL(/\/admin\/cards$/);

    // 목록에서 사라졌고, 상세는 404다 — 이 스펙이 스스로 만든 데이터를 정리한다(plan §9.9).
    await page.goto(`/admin/cards?q=${encodeURIComponent(code)}`);
    await expect(page.getByText("총 0건")).toBeVisible();

    const goneRes = await page.goto(`/cards/${cardId}`);
    expect(goneRes?.status()).toBe(404);
  });
});

test.describe("404", () => {
  test("존재하지 않는 주소는 헤더·푸터가 있는 404를 보여준다", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist-e2e");

    expect(res?.status()).toBe(404);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "도감으로" })).toBeVisible();
  });
});
