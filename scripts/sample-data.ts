/**
 * 디자인 확인용 샘플 데이터.
 *
 * 실행: npx tsx --env-file=.env.local scripts/sample-data.ts
 * 제거: npx tsx --env-file=.env.local scripts/cleanup-sample.ts
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  async function post<T>(table: string, rows: unknown[]): Promise<T[]> {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T[];
  }

  const games = (await (
    await fetch(`${url}/rest/v1/games?select=id,code`, { headers })
  ).json()) as { id: string; code: string }[];
  const opcg = games.find((g) => g.code === "opcg")!.id;
  const ptcg = games.find((g) => g.code === "ptcg")!.id;

  const sets = await post<{ id: string; code: string }>("card_sets", [
    { game_id: opcg, code: "SMPL-OP", name_ja: "サンプル", name_ko: "샘플 팩" },
    { game_id: ptcg, code: "SMPL-PK", name_ja: "サンプル", name_ko: "샘플 팩" },
  ]);
  const opSet = sets.find((s) => s.code === "SMPL-OP")!.id;
  const pkSet = sets.find((s) => s.code === "SMPL-PK")!.id;

  const keywords = await post<{ id: string; code: string }>("keywords", [
    { game_id: opcg, code: "smpl_draw", label_ko: "드로우" },
    { game_id: opcg, code: "smpl_counter", label_ko: "카운터" },
    { game_id: opcg, code: "smpl_discard", label_ko: "버림" },
  ]);

  const img = (n: number) =>
    `https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV5M/SV5M_${String(n).padStart(3, "0")}.png`;

  // PostgREST 벌크 insert는 모든 객체의 키가 같아야 한다.
  type CardRow = {
    code: string; name_ja: string; name_ko: string | null;
    rarity: string | null; card_type: string | null; sub_type: string | null;
    attribute: string | null; effect_text: string | null; image_url: string | null;
    set_id: string; game_id: string;
  };
  const blank = {
    name_ko: null, rarity: null, card_type: null, sub_type: null,
    attribute: null, effect_text: null, image_url: null,
  };
  const cardSeed: Partial<CardRow>[] = [
    { code: "SMPL-OP-001", name_ja: "モンキー・Ｄ・ルフィ", name_ko: "몽키 D 루피", rarity: "L", card_type: "LEADER", attribute: "적색", set_id: opSet, game_id: opcg, effect_text: "【기동: 메인】자신의 카드를 1장 뽑는다.", image_url: img(1) },
    { code: "SMPL-OP-001_p1", name_ja: "モンキー・Ｄ・ルフィ", name_ko: "몽키 D 루피", rarity: "SEC", card_type: "LEADER", attribute: "적색", set_id: opSet, game_id: opcg, image_url: img(2) },
    { code: "SMPL-OP-002", name_ja: "ロロノア・ゾロ", name_ko: "로로노아 조로", rarity: "SR", card_type: "CHARACTER", attribute: "녹색", set_id: opSet, game_id: opcg, effect_text: "【카운터】자신의 리더에게 파워 +2000.", image_url: img(3) },
    { code: "SMPL-OP-003", name_ja: "ナミ", name_ko: "나미", rarity: "R", card_type: "CHARACTER", attribute: "적색", set_id: opSet, game_id: opcg, effect_text: "카드를 2장 뽑고 1장 버린다.", image_url: img(4) },
    { code: "SMPL-OP-004", name_ja: "ウソップ", name_ko: "우솝", rarity: "C", card_type: "EVENT", attribute: "녹색", set_id: opSet, game_id: opcg, image_url: img(5) },
    { code: "SMPL-PK-001", name_ja: "ピカチュウ", name_ko: "피카츄", rarity: "RR", card_type: "Pokemon", sub_type: "basic", attribute: "Lightning", set_id: pkSet, game_id: ptcg, effect_text: "전광석화: 20 데미지.", image_url: img(6) },
    { code: "SMPL-PK-002", name_ja: "博士の研究", name_ko: "박사의 연구", rarity: "U", card_type: "Trainer", sub_type: "supporter", set_id: pkSet, game_id: ptcg, effect_text: "자신의 패를 모두 버리고 카드를 7장 뽑는다." },
    { code: "SMPL-PK-003", name_ja: "基本雷エネルギー", name_ko: "기본 번개 에너지", rarity: "C", card_type: "Energy", sub_type: "basic_energy", set_id: pkSet, game_id: ptcg },
  ];
  const cards = await post<{ id: string; code: string }>(
    "cards",
    cardSeed.map((c) => ({ ...blank, ...c })),
  );

  const byCode = new Map(cards.map((c) => [c.code, c.id]));
  const kw = new Map(keywords.map((k) => [k.code, k.id]));
  await post("card_keywords", [
    { card_id: byCode.get("SMPL-OP-001"), keyword_id: kw.get("smpl_draw") },
    { card_id: byCode.get("SMPL-OP-002"), keyword_id: kw.get("smpl_counter") },
    { card_id: byCode.get("SMPL-OP-003"), keyword_id: kw.get("smpl_draw") },
    { card_id: byCode.get("SMPL-OP-003"), keyword_id: kw.get("smpl_discard") },
  ]);

  await post("news_posts", [
    {
      slug: "smpl-op17",
      title: "부스터팩 「세계 최강의 전사」 발매 안내",
      summary: "OP-17이 발매됩니다. 신규 리더와 주목할 카드를 정리했습니다.",
      content_md:
        "## 발매 개요\n\n부스터팩 **세계 최강의 전사**가 발매됩니다.\n\n- 수록 카드 158종\n- 신규 리더 4종\n\n자세한 내용은 [공식 사이트](https://example.com)를 참고하세요.",
      published_at: new Date(Date.now() - 86400000).toISOString(),
      author_name: "덱바인더 편집부",
    },
    {
      slug: "smpl-meta",
      title: "이번 달 메타 정리 — 상위 티어 덱 분석",
      summary: "대회 입상 덱을 기준으로 현재 환경을 정리했습니다.",
      content_md: "## 상위 티어\n\n환경이 정리되고 있습니다.\n\n| 티어 | 덱 |\n| --- | --- |\n| S | 적색 루피 |\n| A | 녹색 조로 |",
      published_at: new Date(Date.now() - 172800000).toISOString(),
      author_name: "덱바인더 편집부",
    },
    {
      slug: "smpl-guide",
      title: "처음 시작하는 분을 위한 카드 구매 가이드",
      summary: "합리적인 가격에 카드를 모으는 방법을 안내합니다.",
      content_md: "## 시작하기\n\n스타터 덱부터 시작하는 것을 권합니다.",
      published_at: new Date(Date.now() - 259200000).toISOString(),
      author_name: "덱바인더 편집부",
    },
  ]);

  console.log("샘플 데이터 생성 완료: 세트 2 · 카드 8 · 키워드 3 · 기사 3");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// 모듈 스코프를 만들어 다른 스크립트의 main과 충돌하지 않게 한다.
export {};
