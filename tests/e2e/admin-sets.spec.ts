import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m
  .exec(readFileSync(".env.local", "utf8"))?.[1]
  ?.trim();

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("관리자 토큰").fill(ADMIN_TOKEN!);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** 목록에서 세트 하나를 만들고 그 상세 URL의 id를 돌려준다. */
async function createSet(page: Page, code: string, nameJa: string): Promise<string> {
  await page.goto("/admin/sets");
  await page.getByLabel("세트 코드").fill(code);
  await page.getByLabel("일본어 세트명").fill(nameJa);
  await page.getByRole("button", { name: "세트 등록" }).click();
  await expect(page.getByTestId("form-status")).toContainText("등록 완료");

  await page.getByRole("link", { name: new RegExp(code) }).click();
  await expect(page).toHaveURL(/\/admin\/sets\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

test.describe("관리자 세트 운영", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  const stamp = Date.now().toString().slice(-6);

  test("등록 → 수정 → 삭제 왕복", async ({ page }) => {
    const code = `SX${stamp}`;
    const nameJa = `テスト${stamp}`;
    const nameJaEdited = `テスト改${stamp}`;

    await login(page);
    const setId = await createSet(page, code, nameJa);

    // 수정 모드에서는 게임을 바꿀 수 없다 — 이미 붙은 카드와 어긋나기 때문이다
    // (plan T1.15a ⓐ). 이 잠금이 풀리면 조용히 잘못된 데이터가 생긴다.
    await expect(page.getByLabel("게임")).toBeDisabled();

    await page.getByLabel("일본어 세트명").fill(nameJaEdited);
    await page.locator("form").getByRole("button", { name: "저장" }).click();
    await expect(page.getByTestId("form-status")).toContainText("저장 완료");

    // 목록에 새 이름이 반영된다.
    await page.goto("/admin/sets");
    await expect(page.getByRole("link", { name: new RegExp(nameJaEdited) })).toBeVisible();

    // 카드가 없으므로 삭제된다 — 확인 → 삭제 2단계.
    await page.goto(`/admin/sets/${setId}`);
    const deleteZone = page.getByTestId("admin-delete-zone");
    await deleteZone.getByRole("button", { name: "삭제" }).click();
    await deleteZone.getByRole("button", { name: `"${code}" 삭제` }).click();

    await expect(page).toHaveURL(/\/admin\/sets$/);
    await expect(page.getByRole("link", { name: new RegExp(code) })).toHaveCount(0);
  });

  // cards.set_id가 on delete restrict라 카드가 걸린 세트는 지워지지 않는다.
  // 그냥 실패하면 원인이 안 보이므로, 누르기 전 경고와 누른 뒤 문구를 함께 고정한다.
  test("카드가 걸린 세트는 삭제되지 않고 이유를 보여준다", async ({ page }) => {
    const code = `SY${stamp}`;
    const cardCode = `SX${stamp}-001`;

    await login(page);
    const setId = await createSet(page, code, `使用中${stamp}`);

    // 카드는 폼 대신 API로 넣는다 — 이 테스트가 검증하는 것은 카드 등록이 아니다.
    const gameId = await page
      .getByLabel("게임")
      .inputValue()
      .catch(() => "");
    const res = await page.request.post("/api/admin/cards", {
      data: { game_id: gameId, set_id: setId, code: cardCode, name_ja: `使用中${stamp}` },
    });
    expect(res.ok(), `카드 ${cardCode} 생성 실패: ${res.status()}`).toBeTruthy();

    // 누르기 전에 경고가 보인다 (AdminDeleteButton의 description).
    await page.goto(`/admin/sets/${setId}`);
    const deleteZone = page.getByTestId("admin-delete-zone");
    await deleteZone.getByRole("button", { name: "삭제" }).click();
    await expect(deleteZone.getByTestId("admin-delete-warning")).toContainText("1장");

    // 눌러도 막히고, 이유가 보인다. 23503 기본 문구("세트가 이 게임에 속하지
    // 않습니다")가 그대로 나오면 뜻이 통하지 않는다 (plan T1.15a ⓑ).
    await deleteZone.getByRole("button", { name: `"${code}" 삭제` }).click();
    await expect(deleteZone.getByTestId("form-error")).toContainText("삭제할 수 없습니다");
    await expect(page).toHaveURL(new RegExp(`/admin/sets/${setId}$`));

    // 카드를 지우면 세트도 지워진다 — 이 스펙이 스스로 만든 데이터를 정리한다(§9.9).
    await page.goto(`/admin/cards?q=${encodeURIComponent(cardCode)}`);
    await page.getByRole("link", { name: "수정" }).click();
    const cardZone = page.getByTestId("admin-delete-zone");
    await cardZone.getByRole("button", { name: "삭제" }).click();
    await cardZone.getByRole("button", { name: `"${cardCode}" 삭제` }).click();
    await expect(page).toHaveURL(/\/admin\/cards$/);

    await page.goto(`/admin/sets/${setId}`);
    const zone = page.getByTestId("admin-delete-zone");
    await zone.getByRole("button", { name: "삭제" }).click();
    await zone.getByRole("button", { name: `"${code}" 삭제` }).click();
    await expect(page).toHaveURL(/\/admin\/sets$/);
  });
});
