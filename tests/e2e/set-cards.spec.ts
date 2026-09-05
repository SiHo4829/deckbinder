import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const ADMIN_TOKEN = /^ADMIN_TOKEN=(.+)$/m
  .exec(readFileSync(".env.local", "utf8"))?.[1]
  ?.trim();

/**
 * 도감 「관련 카드」 세트 축 E2E (plan §4.9 · T2.13 ⓙ).
 *
 * 🚨 **픽스처 판단.** 실제 카탈로그(PROMO 276 · OPK-13 192 등)가 60장을
 * 넘는 세트를 이미 갖고 있지만(§4.9 ⓖ), 그 데이터에 걸지 않는다 —
 * ⓐ `cards.spec.ts`가 이미 세운 관행("카탈로그는 관리자 화면에서 직접
 * 채운다. 데이터 양을 전제하지 않는다")과 같은 이유로, 프로덕션 카탈로그의
 * 존재·행 수는 이 테스트 환경(별도 Supabase 프로젝트일 수 있다)에서 보장되지
 * 않는다 ⓑ E-5가 남긴 교훈 — 마이그레이션이 바꿀 수 있는 참조 데이터의
 * 문자열(`name_ko` 등)에 픽스처를 걸지 않는다는 원칙을 데이터의 **존재**
 * 자체로도 확장한다. 대신 `admin-cards.spec.ts`(22건 · 페이지네이션 2쪽)와
 * 같은 방식으로 **API 직접 등록**으로 61장짜리 세트를 스스로 만든다 — 폼을
 * 61번 채우는 대신 `/api/admin/cards`를 61번 부른다.
 */
test.describe("도감 「관련 카드」 세트 축", () => {
  test.skip(!ADMIN_TOKEN, "ADMIN_TOKEN이 .env.local에 없습니다");

  test("상세 → 전체 N장 보기 → 2페이지", async ({ page }) => {
    // 61건 등록 + 세트/카드 이동을 모두 한 테스트에서 하므로 기본 30초로는
    // 빠듯하다 (admin-cards.spec.ts와 같은 이유).
    test.setTimeout(90_000);

    const stamp = Date.now().toString().slice(-6);
    const setCode = `ST${stamp}`;
    const nameKo = `세트카드${stamp}`;
    const total = 61; // 60장/페이지(§4.9 ⓓ)를 넘겨 2페이지를 만든다.

    await page.goto("/admin/login");
    await page.getByLabel("관리자 토큰").fill(ADMIN_TOKEN!);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/sets");
    await page.getByLabel("세트 코드").fill(setCode);
    await page.getByLabel("일본어 세트명").fill(`セット${stamp}`);
    await page.getByRole("button", { name: "세트 등록" }).click();
    await expect(page.getByTestId("form-status")).toContainText("등록 완료");

    await page.getByRole("link", { name: new RegExp(setCode) }).click();
    await expect(page).toHaveURL(/\/admin\/sets\/[0-9a-f-]{36}$/);
    const setId = page.url().split("/").pop()!;

    await page.goto("/admin/cards/new");
    const gameId = await page.locator("#card-game").inputValue();
    expect(gameId).toBeTruthy();

    for (let i = 1; i <= total; i += 1) {
      const code = `${setCode}-${String(i).padStart(3, "0")}`;
      const res = await page.request.post("/api/admin/cards", {
        data: { game_id: gameId, set_id: setId, code, name_ko: nameKo },
      });
      expect(res.ok(), `카드 ${code} 생성 실패`).toBeTruthy();
    }

    // 첫 카드(001)의 id를 찾아 상세로 들어간다. 61건이 같은 이름을 쓰므로
    // limit을 늘려 전량을 받는다(card-detail.spec.ts와 같은 방식).
    const searchRes = await page.request.get(
      `/api/cards?q=${encodeURIComponent(nameKo)}&limit=100`,
    );
    const body = (await searchRes.json()) as { items: { id: string; code: string }[] };
    const firstCard = body.items.find((c) => c.code === `${setCode}-001`);
    expect(firstCard, "첫 카드를 찾지 못했습니다").toBeTruthy();

    await page.goto(`/cards/${firstCard!.id}`);

    const previewSection = page.locator("section", {
      has: page.getByRole("heading", { name: "같은 세트의 카드" }),
    });
    await expect(previewSection).toBeVisible();
    await expect(
      previewSection.getByRole("link", { name: `전체 ${total}장 보기 →` }),
    ).toBeVisible();

    await previewSection.getByRole("link", { name: `전체 ${total}장 보기 →` }).click();
    await expect(page).toHaveURL(new RegExp(`/sets/${setId}$`));

    // 그리드 타일 하나는 코드를 두 곳(CardImage의 폴백 표시 + 캡션)에 그린다 —
    // `getByText(code)`가 그 둘을 모두 잡아 strict mode 위반이 난다(전역 셀렉터
    // 사고). `.first()`로 "떠 있다/없다"만 확인한다 — 어느 타일인지는 이미
    // `code`가 유일하므로 묻지 않는다.
    await expect(page.getByText(`전체 ${total}장 중 1–60장 표시`)).toBeVisible();
    await expect(page.getByText(`${setCode}-001`).first()).toBeVisible();
    await expect(page.getByText(`${setCode}-061`)).toHaveCount(0);

    const pagination = page.getByTestId("admin-pagination");
    await expect(pagination).toBeVisible();
    await pagination.getByRole("link", { name: "다음" }).click();

    await expect(page).toHaveURL(new RegExp(`/sets/${setId}\\?page=2$`));
    await expect(page.getByText(`전체 ${total}장 중 61–61장 표시`)).toBeVisible();
    await expect(page.getByText(`${setCode}-061`).first()).toBeVisible();
    await expect(page.getByText(`${setCode}-001`)).toHaveCount(0);
  });
});

