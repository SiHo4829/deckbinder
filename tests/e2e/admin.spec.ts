import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

// .env.local의 ADMIN_TOKEN을 읽어 실제 로그인 흐름을 검증한다.
const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m
  .exec(readFileSync(".env.local", "utf8"))?.[1]
  ?.trim();

test.describe("관리자 등록", () => {
  test("로그인 없이 관리자 화면에 접근하면 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: "관리자 로그인" })).toBeVisible();
  });

  test("인증 없이 카드 등록 API를 호출하면 401이다", async ({ request }) => {
    const res = await request.post("/api/admin/cards", {
      data: { game_id: "00000000-0000-4000-8000-000000000000", code: "X", name_ja: "x" },
    });

    expect(res.status()).toBe(401);
  });

  test("잘못된 토큰은 거부된다", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("관리자 토큰").fill("wrong-token-value-1234567890");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page.getByTestId("form-error")).toContainText("토큰이 올바르지 않습니다");
  });

  test("세트를 만들고 카드를 등록하면 도감에 나타난다", async ({ page }) => {
    test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

    const stamp = Date.now().toString().slice(-6);
    const setCode = `E2E${stamp}`;
    const cardCode = `${setCode}-001`;
    const nameJa = `テスト${stamp}`;
    const nameKo = `테스트${stamp}`;

    await page.goto("/admin/login");
    await page.getByLabel("관리자 토큰").fill(ADMIN_TOKEN!);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 세트 등록
    await page.goto("/admin/sets");
    await page.getByLabel("세트 코드").fill(setCode);
    await page.getByLabel("일본어 세트명").fill(`セット${stamp}`);
    await page.getByRole("button", { name: "세트 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    // 카드 등록
    await page.goto("/admin/cards/new");
    await page.getByLabel("카드 코드").fill(cardCode);
    await page.getByLabel("일본어 카드명").fill(nameJa);
    await page.getByLabel("한국어 카드명").fill(nameKo);
    await page.getByLabel("레어도").fill("SR");
    await page.getByRole("button", { name: "카드 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    // 도감 반영 — 한국어명이 있으므로 한국어로 표기된다
    await page.goto(`/cards?q=${encodeURIComponent(nameKo)}`);
    await expect(page.locator("article").first()).toContainText(nameKo);
    await expect(page.locator("article").first()).toContainText(cardCode);
  });

  test("같은 카드 코드를 두 번 등록하면 막힌다", async ({ page }) => {
    test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

    await page.goto("/admin/login");
    await page.getByLabel("관리자 토큰").fill(ADMIN_TOKEN!);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const code = `DUP${Date.now().toString().slice(-6)}-001`;
    for (const expectSuccess of [true, false]) {
      await page.goto("/admin/cards/new");
      await page.getByLabel("카드 코드").fill(code);
      await page.getByLabel("일본어 카드명").fill("重複テスト");
      await page.getByRole("button", { name: "카드 등록" }).click();

      if (expectSuccess) {
        await expect(page.getByTestId("form-status")).toContainText("등록 완료");
      } else {
        await expect(page.getByTestId("form-error")).toContainText("이미 등록된");
      }
    }
  });
});
