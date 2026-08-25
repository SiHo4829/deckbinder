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

test.describe("관리자 키워드 운영", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  const stamp = Date.now().toString().slice(-6);
  const code = `kx${stamp}`;
  const labelKo = `테스트태그${stamp}`;
  const labelKoEdited = `고친태그${stamp}`;
  const cardCode = `KX${stamp}-001`;

  test("등록 → 수정 → 삭제, 삭제하면 카드에서 태그가 사라진다", async ({ page }) => {
    await login(page);

    // 키워드를 만들고 목록에서 상세로 들어간다.
    await page.goto("/admin/keywords");
    const gameId = await page.getByLabel("게임").inputValue();
    await page.getByLabel("키워드 코드").fill(code);
    await page.getByLabel("한국어 표기").fill(labelKo);
    await page.getByRole("button", { name: "키워드 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    await page.getByRole("link", { name: new RegExp(labelKo) }).click();
    await expect(page).toHaveURL(/\/admin\/keywords\/[0-9a-f-]{36}$/);
    const keywordId = page.url().split("/").pop()!;

    // 게임은 잠겨 있다. keywords에는 게임 FK가 없어서, 바뀌면 에러 없이 저장되고
    // 다른 게임 카드에 태그가 붙은 채 남는다 (plan T1.15a ⓐ).
    await expect(page.getByLabel("게임")).toBeDisabled();

    // 표기를 고친다.
    await page.getByLabel("한국어 표기").fill(labelKoEdited);
    await page.locator("form").getByRole("button", { name: "저장" }).click();
    await expect(page.getByTestId("form-status")).toContainText("저장 완료");

    // 이 키워드를 단 카드를 만든다 — 폼 대신 API로 넣는다.
    const created = await page.request.post("/api/admin/cards", {
      data: {
        game_id: gameId,
        code: cardCode,
        name_ja: `タグ${stamp}`,
        keyword_ids: [keywordId],
      },
    });
    expect(created.ok(), `카드 생성 실패: ${created.status()}`).toBeTruthy();
    const cardId = ((await created.json()) as { card: { id: string } }).card.id;

    // 카드 상세에 칩이 보인다.
    await page.goto(`/cards/${cardId}`);
    await expect(page.getByRole("link", { name: labelKoEdited })).toBeVisible();

    // 삭제 확인 단계에 "카드 N장" 경고가 뜬다 — cascade라 삭제를 막을 방법이
    // 없으므로 이 경고가 유일한 방어다 (plan T1.15a ⓑ).
    await page.goto(`/admin/keywords/${keywordId}`);
    const deleteZone = page.getByTestId("admin-delete-zone");
    await deleteZone.getByRole("button", { name: "삭제" }).click();
    await expect(deleteZone.getByTestId("admin-delete-warning")).toContainText("1장");

    await deleteZone.getByRole("button", { name: `"${labelKoEdited}" 삭제` }).click();
    await expect(page).toHaveURL(/\/admin\/keywords$/);
    await expect(page.getByRole("link", { name: new RegExp(labelKoEdited) })).toHaveCount(0);

    // 카드는 남아 있지만 칩은 사라졌다. 새 goto로 확인한다 — TanStack Query의
    // staleTime이 같은 탭에서 옛 결과를 보여줄 수 있다 (plan T1.15a ⓓ).
    await page.goto(`/cards/${cardId}`);
    await expect(page.getByRole("link", { name: labelKoEdited })).toHaveCount(0);

    // 자기 데이터를 지운다 (§9.9).
    await page.goto(`/admin/cards/${cardId}`);
    const cardZone = page.getByTestId("admin-delete-zone");
    await cardZone.getByRole("button", { name: "삭제" }).click();
    await cardZone.getByRole("button", { name: `"${cardCode}" 삭제` }).click();
    await expect(page).toHaveURL(/\/admin\/cards$/);
  });
});
