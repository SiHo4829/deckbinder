/**
 * 카드 마스터 데이터 수집 (plan §4.4 / T1.6)
 *
 * 실행: npm run db:seed -- --game=ptcg [--limit-sets=N] [--skeleton-only]
 *       npm run db:seed -- --enrich-only [--card-type=Energy]   # 매핑 수정 후 부분 재보강
 *
 * 2단계로 나눈다.
 *  1) 세트 + 카드 골격(code, name_ja)  — 요청 1 + 세트 수
 *  2) 카드 상세 보강(rarity/type/effect/image) — 카드 수만큼
 *
 * 1단계만으로도 DB가 사용 가능한 상태가 되고, 2단계는 중단·재개해도 안전하다.
 * TCGdex는 "과하게 호출하지 말고 로컬에 캐시하라"는 방침이므로 동시성을 제한한다.
 */
import {
  mapTcgdexCard,
  mapTcgdexSet,
  type TcgdexCard,
  type TcgdexSet,
} from "../src/lib/domain/ingest/tcgdex";

const TCGDEX = "https://api.tcgdex.net/v2/ja";
const CONCURRENCY = 8;
const CHUNK = 500;

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. --env-file=.env.local 확인",
  );
}

/**
 * PostgREST를 직접 호출한다.
 * supabase-js는 생성 시 realtime 클라이언트를 초기화하는데, 이때 네이티브
 * WebSocket(Node 22+)을 요구해 현재 개발 환경(Node 20.15)에서 즉시 실패한다.
 * 시드는 REST만 쓰므로 의존성을 걷어내는 편이 단순하고 이식성도 높다.
 */
const rest = {
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },

  async select<T>(path: string): Promise<T> {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: this.headers });
    if (!res.ok) throw new Error(`SELECT ${path} 실패: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  },

  /** on_conflict 기준으로 upsert 한다 (merge-duplicates). */
  async upsert(table: string, onConflict: string, rows: unknown[]): Promise<void> {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
      {
        method: "POST",
        headers: {
          ...this.headers,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(rows),
      },
    );
    if (!res.ok) throw new Error(`UPSERT ${table} 실패: ${res.status} ${await res.text()}`);
  },
};

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    return fetchJson<T>(url, attempt + 1);
  }
}

/** 동시성을 제한해 순서대로 소비한다. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let done = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]!, index);
        done += 1;
        if (done % 200 === 0) onProgress?.(done, items.length);
      }
    }),
  );

  onProgress?.(done, items.length);
  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const gameCode = args.get("game") ?? "ptcg";
  if (gameCode !== "ptcg") {
    throw new Error(`현재 TCGdex 수집은 ptcg만 지원합니다 (요청: ${gameCode}). opcg는 T1.6c`);
  }

  const games = await rest.select<{ id: string; code: string }[]>(
    `games?select=id,code&code=eq.${gameCode}`,
  );
  const game = games[0];
  if (!game) throw new Error(`games에서 ${gameCode}를 찾지 못했습니다`);

  // 매핑 규칙이 바뀌어 일부만 다시 채워야 할 때 쓴다.
  // 세트·골격 수집을 건너뛰고 DB에 있는 코드만 상세 재조회하므로 요청 수가 크게 준다.
  if (args.has("enrich-only")) {
    const cardType = args.get("card-type");
    const filter = cardType ? `&card_type=eq.${encodeURIComponent(cardType)}` : "";
    const stored = await rest.select<{ code: string }[]>(
      `cards?select=code&game_id=eq.${game.id}${filter}&limit=100000`,
    );
    console.log(`[enrich-only] 대상 ${stored.length}장${cardType ? ` (${cardType})` : ""}`);
    await enrich(
      stored.map((c) => c.code),
      game.id,
    );
    return;
  }

  // ── 1단계: 세트 ──────────────────────────────────────────
  console.log("[1/3] 세트 목록 수집…");
  let sets = await fetchJson<TcgdexSet[]>(`${TCGDEX}/sets`);
  const limitSets = Number(args.get("limit-sets") ?? 0);
  if (limitSets > 0) sets = sets.slice(0, limitSets);

  const setRows = sets.map((s) => ({ ...mapTcgdexSet(s), game_id: game.id }));
  for (const part of chunk(setRows, CHUNK)) {
    await rest.upsert("card_sets", "game_id,code", part);
  }
  console.log(`      세트 ${setRows.length}개 적재 완료`);

  const storedSets = await rest.select<{ id: string; code: string }[]>(
    `card_sets?select=id,code&game_id=eq.${game.id}&limit=10000`,
  );
  const setIdByCode = new Map(storedSets.map((s) => [s.code, s.id]));

  // ── 2단계: 카드 골격 ─────────────────────────────────────
  console.log("[2/3] 세트별 카드 목록 수집…");
  type SetDetail = { id: string; cards?: { id: string; name: string }[] };
  const details = await mapPool(
    sets,
    CONCURRENCY,
    (s) => fetchJson<SetDetail>(`${TCGDEX}/sets/${encodeURIComponent(s.id)}`),
    (d, t) => console.log(`      ${d}/${t} 세트`),
  );

  const skeleton = details.flatMap((detail) =>
    (detail.cards ?? [])
      .filter((c) => c.name?.trim())
      .map((c) => ({
        game_id: game.id,
        set_id: setIdByCode.get(detail.id) ?? null,
        code: c.id,
        name_ja: c.name.trim(),
      })),
  );
  for (const part of chunk(skeleton, CHUNK)) {
    await rest.upsert("cards", "game_id,code", part);
  }
  console.log(`      카드 ${skeleton.length}장 골격 적재 완료`);

  if (args.has("skeleton-only")) {
    console.log("skeleton-only 지정 — 상세 보강을 건너뜁니다.");
    return;
  }

  // ── 3단계: 카드 상세 보강 ────────────────────────────────
  console.log("[3/3] 카드 상세 보강…");
  await enrich(
    skeleton.map((c) => c.code),
    game.id,
  );
}

/** 카드 코드 목록을 TCGdex에서 상세 조회해 보강 컬럼을 채운다. */
async function enrich(codes: string[], gameId: string): Promise<void> {
  const enriched = await mapPool(
    codes,
    CONCURRENCY,
    async (code) => {
      try {
        const card = await fetchJson<TcgdexCard>(
          `${TCGDEX}/cards/${encodeURIComponent(code)}`,
        );
        return mapTcgdexCard(card);
      } catch {
        return null;
      }
    },
    (d, t) => console.log(`      ${d}/${t} 카드`),
  );

  const rows = enriched
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({ ...c, game_id: gameId }));

  for (const part of chunk(rows, CHUNK)) {
    await rest.upsert("cards", "game_id,code", part);
  }

  const failed = enriched.length - rows.length;
  console.log(`      ${rows.length}장 보강 완료${failed > 0 ? ` (${failed}장 실패)` : ""}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
