/**
 * 디자인 확인용 샘플 데이터 + E2E 잔여 데이터 제거.
 *
 * 실행: npx tsx --env-file=.env.local scripts/cleanup-sample.ts
 *
 * 지우는 것은 접두사로 식별되는 것만이다. 손으로 등록한 카드는 건드리지 않는다.
 *   - card_sets / cards : code가 `SMPL`로 시작
 *   - keywords          : code가 `smpl`로 시작
 *   - news_posts        : slug가 `smpl-` / `pub-` / `draft-`로 시작
 *                         (뒤 둘은 tests/e2e/news.spec.ts가 만든다)
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다");
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  async function del(table: string, filter: string) {
    const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    console.log(`  삭제 ${table}?${filter}`);
  }

  async function count(table: string) {
    const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
    });
    return res.headers.get("content-range")?.split("/")[1] ?? "?";
  }

  // card_keywords는 cards FK가 on delete cascade라 따로 지우지 않는다.
  await del("news_posts", "slug=like.smpl-*");
  await del("news_posts", "slug=like.pub-*");
  await del("news_posts", "slug=like.draft-*");
  await del("cards", "code=like.SMPL*");
  await del("keywords", "code=like.smpl*");
  await del("card_sets", "code=like.SMPL*");

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
