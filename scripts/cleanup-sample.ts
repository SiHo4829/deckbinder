/**
 * 임시 데이터 정리 — 디자인 확인용 샘플 + E2E가 남긴 것.
 *
 * 실행: npx tsx --env-file=.env.local scripts/cleanup-sample.ts
 *
 * 손으로 등록한 카드를 지우지 않도록 **접두사 + 6자리 타임스탬프 정규식**으로만
 * 골라낸다. `D*` 같은 넓은 패턴을 쓰면 실제 세트를 함께 지울 수 있다.
 *
 * | 출처 | 남기는 것 |
 * |------|-----------|
 * | scripts/sample-data.ts | 세트/카드 `SMPL…` · 키워드 `smpl…` · 기사 `smpl-…` |
 * | tests/e2e/admin.spec.ts | 세트/카드 `E2E######` · 카드 `DUP######-001` |
 * | tests/e2e/card-detail.spec.ts | 세트/카드 `D######` · 키워드 `d######draw` |
 * | tests/e2e/filters.spec.ts | 세트/카드 `F######` · 키워드 `f######draw|counter` |
 * | tests/e2e/cursor.spec.ts | 카드 `DUP-######` |
 * | tests/e2e/news.spec.ts | 기사 `pub-######` · `unpub-######` · `draft-######` |
 * | tests/e2e/admin-cards.spec.ts | 카드 `PGE######-###`(페이지네이션 — 스스로 지우지 않는다) · 키워드 `rt######kw`(수정 왕복 — 카드 자체는 스스로 지운다) |
 * | tests/e2e/admin-sets.spec.ts | 세트 `SX######` · `SY######` · 카드 `SX######-001` (모두 스스로 지운다 — 안전망으로만 등록) |
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다");
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  /** PostgREST의 `match` 연산자(= POSIX 정규식 ~). 중괄호가 있어 인코딩이 필요하다. */
  async function delMatch(table: string, column: string, pattern: string) {
    const filter = `${column}=match.${encodeURIComponent(pattern)}`;
    const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: { ...headers, Prefer: "return=representation" },
    });
    if (!res.ok) throw new Error(`${table} ${pattern}: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as unknown[];
    console.log(`  ${table} ${column} ~ ${pattern} → ${rows.length}행`);
  }

  async function count(table: string) {
    const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
    });
    return res.headers.get("content-range")?.split("/")[1] ?? "?";
  }

  const STAMP = "[0-9]{6}";

  // 순서가 중요하다. cards가 card_sets를 on delete restrict로 참조하므로
  // 카드를 먼저 지워야 세트가 지워진다. card_keywords는 cascade라 따로 안 지운다.
  console.log("기사");
  await delMatch("news_posts", "slug", `^smpl-`);
  await delMatch("news_posts", "slug", `^(pub|unpub|draft)-${STAMP}$`);

  console.log("카드");
  await delMatch("cards", "code", `^SMPL`);
  await delMatch("cards", "code", `^(E2E|D|F)${STAMP}-`);
  await delMatch("cards", "code", `^DUP-?${STAMP}`);
  await delMatch("cards", "code", `^PGE${STAMP}-`);
  await delMatch("cards", "code", `^SX${STAMP}-`);

  console.log("키워드");
  await delMatch("keywords", "code", `^smpl`);
  await delMatch("keywords", "code", `^[df]${STAMP}(draw|counter)$`);
  await delMatch("keywords", "code", `^rt${STAMP}kw$`);

  console.log("세트");
  await delMatch("card_sets", "code", `^SMPL`);
  await delMatch("card_sets", "code", `^(E2E|D|F|SX|SY)${STAMP}$`);

  console.log("--- 남은 행 ---");
  for (const t of ["card_sets", "cards", "keywords", "card_keywords", "news_posts"]) {
    console.log(`${t}: ${await count(t)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// 모듈 스코프를 만들어 다른 스크립트의 main과 충돌하지 않게 한다.
export {};
