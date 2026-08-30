/**
 * 이미지 회수(purge) 진입점 — T1.21 (plan §8 T1.21 ⓐ~ⓘ · §9.4 ⓕ-4).
 *
 * 인자 파싱 · Supabase 호출 · 파일 I/O · 리포트 쓰기만 한다. **판단하지
 * 않는다** — 무엇이 범위에 드는지 · 결론이 초록인지 · `--apply`를 열어도 되는지 ·
 * 어느 순서로 지우는지는 전부 `src/lib/catalog/purge.ts`에 묻는다(ⓖ).
 *
 * 실행:
 *   드라이런  npm run images:purge -- --scope set --game opcg --set OPK-14
 *   실행      npm run images:purge -- --scope set --game opcg --set OPK-14 --apply
 *
 * 🚨 **`--apply`가 없으면 한 객체도 지우지 않는다**(ⓐ). 그리고 드라이런 결론이
 * 초록이 아니면 `--apply`가 있어도 거부한다(ⓑ) — **대상 0건은 「깨끗이 지웠다」가
 * 아니라 「범위를 잘못 주었다」이기 때문이다.**
 *
 * 🚨 **DELETE 대상은 `card-images` 버킷과 `cards.image_url`뿐이다**(ⓗ).
 * `--include-source-url`은 `cards.source_image_url`을, `--local`은
 * `data/images/`를 추가로 연다 — **둘 다 기본 꺼짐이고 중지 요청 대응에서만
 * 켠다.** 다른 테이블·다른 버킷에는 접근하지 않는다.
 */
import { existsSync, readdirSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildPurgePlan,
  decideApply,
  formatPurgePlan,
  parsePurgeRange,
  pickVerifySample,
  purgeConclusion,
  purgePrefix,
  type BucketObject,
  type CardImageRow,
  type PurgePlan,
  type PurgeRange,
} from "@/lib/catalog/purge";

/** §9.4 ⓕ-2가 정한 유일한 버킷. **다른 버킷 이름이 이 파일에 등장하지 않는다**(ⓗ). */
const BUCKET = "card-images";

const IMAGE_ROOT = "data/images";

interface Args {
  readonly range: PurgeRange;
  readonly apply: boolean;
  readonly includeSourceUrl: boolean;
  readonly local: boolean;
}

function readArgValue(argv: readonly string[], name: string): string | null {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function parseArgs(argv: readonly string[]): Args {
  const parsed = parsePurgeRange({
    scope: readArgValue(argv, "--scope"),
    game: readArgValue(argv, "--game"),
    setCode: readArgValue(argv, "--set"),
  });
  if ("error" in parsed) {
    throw new Error(
      `범위 인자가 잘못됐다 (${parsed.error}). ` +
        "사용: --scope <all|game|set> [--game …] [--set …]. " +
        "🚨 남는 인자를 무시하지 않는다 — 의도와 다른 범위를 지우지 않기 위해서다.",
    );
  }
  return {
    range: parsed.range,
    apply: argv.includes("--apply"),
    includeSourceUrl: argv.includes("--include-source-url"),
    local: argv.includes("--local"),
  };
}

function stampUtc(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

// ─── Supabase (REST) ───────────────────────────────────────────────────────

interface Supa {
  readonly listObjects: (prefix: string) => Promise<BucketObject[]>;
  readonly listCards: () => Promise<CardImageRow[]>;
  readonly clearColumn: (column: "image_url" | "source_image_url", ids: readonly string[]) => Promise<void>;
  readonly removeObjects: (names: readonly string[]) => Promise<void>;
  readonly publicUrl: (name: string) => string;
}

function createSupa(): Supa {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다 (.env.local).");
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  return {
    async listObjects(prefix: string): Promise<BucketObject[]> {
      // Storage list는 한 「폴더」씩 돌려주므로 접두사 아래를 재귀로 훑는다.
      const out: BucketObject[] = [];
      async function walk(dir: string): Promise<void> {
        const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ prefix: dir, limit: 1000, offset: 0 }),
        });
        if (!res.ok) {
          throw new Error(`버킷 목록 조회 실패 (${res.status}): ${await res.text()}`);
        }
        const items = (await res.json()) as { name: string; id: string | null; metadata: { size?: number } | null }[];
        for (const item of items) {
          const full = dir === "" ? item.name : `${dir}${item.name}`;
          // id가 null이면 실제 객체가 아니라 「폴더」다.
          if (item.id === null) {
            await walk(`${full}/`);
          } else {
            out.push({ name: full, sizeBytes: item.metadata?.size ?? 0 });
          }
        }
      }
      await walk(prefix);
      return out;
    },

    async listCards(): Promise<CardImageRow[]> {
      const rows: CardImageRow[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const res = await fetch(
          `${url}/rest/v1/cards?select=id,image_url,source_image_url,games(code),card_sets(code)` +
            `&limit=${pageSize}&offset=${offset}`,
          { headers },
        );
        if (!res.ok) throw new Error(`cards 조회 실패 (${res.status}): ${await res.text()}`);
        const page = (await res.json()) as {
          id: string;
          image_url: string | null;
          source_image_url: string | null;
          games: { code: string } | null;
          card_sets: { code: string } | null;
        }[];
        for (const row of page) {
          rows.push({
            id: row.id,
            game: row.games?.code ?? "",
            setCode: row.card_sets?.code ?? "",
            imageUrl: row.image_url,
            sourceImageUrl: row.source_image_url,
          });
        }
        if (page.length < pageSize) break;
      }
      return rows;
    },

    async clearColumn(column, ids): Promise<void> {
      // 🚨 대상 테이블은 `cards` 하나다(ⓗ).
      const chunkSize = 200;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const res = await fetch(`${url}/rest/v1/cards?id=in.(${chunk.join(",")})`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ [column]: null }),
        });
        if (!res.ok) throw new Error(`${column} 비우기 실패 (${res.status}): ${await res.text()}`);
      }
    },

    async removeObjects(names): Promise<void> {
      const chunkSize = 100;
      for (let i = 0; i < names.length; i += chunkSize) {
        const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
          method: "DELETE",
          headers,
          body: JSON.stringify({ prefixes: names.slice(i, i + chunkSize) }),
        });
        if (!res.ok) throw new Error(`객체 삭제 실패 (${res.status}): ${await res.text()}`);
      }
    },

    publicUrl(name) {
      return `${url}/storage/v1/object/public/${BUCKET}/${name}`;
    },
  };
}

// ─── 로컬 파일 ─────────────────────────────────────────────────────────────

function listLocalFiles(range: PurgeRange): string[] {
  if (!existsSync(IMAGE_ROOT)) return [];
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name).split("\\").join("/");
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  }
  walk(IMAGE_ROOT);
  const prefix = purgePrefix(range);
  return prefix === "" ? out : out.filter((path) => path.startsWith(`${IMAGE_ROOT}/${prefix}`));
}

// ─── 본체 ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const supa = createSupa();
  const stamp = stampUtc();

  const [objects, cards] = await Promise.all([
    supa.listObjects(purgePrefix(args.range)),
    supa.listCards(),
  ]);
  const localFiles = listLocalFiles(args.range);

  const plan = buildPurgePlan({
    range: args.range,
    objects,
    cards,
    localFiles,
    includeSourceUrl: args.includeSourceUrl,
    local: args.local,
  });
  const conclusion = purgeConclusion(plan);

  console.log(formatPurgePlan(plan, conclusion));
  console.log("");

  const gate = decideApply({ apply: args.apply, conclusion });
  if (!gate.allowed) {
    console.log(
      gate.reason === "not_requested"
        ? "── 드라이런이다. 한 객체도 지우지 않았다. 실행하려면 --apply를 붙인다. ──"
        : "🚨 결론이 초록이 아니다. --apply를 거부한다.",
    );
    writeReport(args, plan, conclusion, stamp, { applied: false, verified: [] });
    if (gate.reason === "conclusion_not_green") process.exitCode = 1;
    return;
  }

  // ── 🚨 여기서부터 되돌릴 수 없다. 순서는 purge.ts가 정한다. ────────────
  const inScopeCards = cards.filter((card) => {
    if (args.range.scope === "all") return true;
    if (args.range.scope === "game") return card.game === args.range.game;
    return card.game === args.range.game && card.setCode === args.range.setCode;
  });

  // 1단계 — DB를 먼저 비운다(§9.4 ⓕ-4). 화면에서 즉시 사라진다.
  const imageIds = inScopeCards.filter((c) => c.imageUrl !== null).map((c) => c.id);
  await supa.clearColumn("image_url", imageIds);
  console.log(`1. image_url 비움 — ${imageIds.length}행`);

  // 2단계 — 버킷 객체 삭제.
  await supa.removeObjects(plan.objects.map((o) => o.name));
  console.log(`2. 버킷 객체 삭제 — ${plan.objectCount}건`);

  if (args.includeSourceUrl) {
    const srcIds = inScopeCards.filter((c) => c.sourceImageUrl !== null).map((c) => c.id);
    await supa.clearColumn("source_image_url", srcIds);
    console.log(`3. source_image_url 비움 — ${srcIds.length}행`);
  }

  if (args.local) {
    for (const path of localFiles) rmSync(path, { force: true });
    console.log(`4. 로컬 파일 삭제 — ${localFiles.length}개`);
  }

  // 4단계 — 표본 검증(ⓔ). 무작위 20건에 GET해 404를 확인한다.
  const sample = pickVerifySample(plan.objects);
  const verified: { name: string; status: number }[] = [];
  for (const name of sample) {
    const res = await fetch(supa.publicUrl(name), { method: "GET" });
    verified.push({ name, status: res.status });
  }
  const notGone = verified.filter((v) => v.status !== 404);
  console.log(
    `표본 검증 — ${verified.length}건 중 404 ${verified.length - notGone.length}건` +
      (notGone.length > 0 ? ` 🚨 남아 있는 것 ${notGone.length}건` : ""),
  );

  writeReport(args, plan, conclusion, stamp, { applied: true, verified });
  if (notGone.length > 0) process.exitCode = 1;
}

function writeReport(
  args: Args,
  plan: PurgePlan,
  conclusion: ReturnType<typeof purgeConclusion>,
  stamp: string,
  result: { applied: boolean; verified: { name: string; status: number }[] },
): void {
  const dir = join("data", "purge-reports");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `purge-${stamp}.json`);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        stamp,
        range: plan.range,
        prefix: plan.prefix,
        applied: result.applied,
        includeSourceUrl: args.includeSourceUrl,
        local: args.local,
        objectCount: plan.objectCount,
        totalBytes: plan.totalBytes,
        imageUrlCleared: result.applied ? plan.imageUrlToClear : 0,
        sourceUrlCleared: result.applied ? plan.sourceUrlToClear : 0,
        localDeleted: result.applied ? plan.localFileCount : 0,
        conclusion,
        verifiedSample: result.verified,
        verified404: result.verified.filter((v) => v.status === 404).length,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  console.log(`리포트: ${path}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
