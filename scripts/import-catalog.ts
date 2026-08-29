/**
 * 카탈로그 임포터 진입점 — T1.18 (plan §4.11).
 *
 * argv 파싱 · JSONL 읽기 · sha256 계산 · `backups/` 훑기 · Supabase 조회/쓰기 ·
 * 리포트 파일 쓰기 · `console.log` · 종료 코드만 한다. **판단하지 않는다** —
 * 「멈출지」·「몇 건인지」·「무엇이 바뀌는지」를 `src/lib/catalog/{normalize,plan,report,gate}.ts`
 * 에 묻는다(ⓑ).
 *
 * 실행:
 *   드라이런  npm run catalog:import -- --game opcg-kr --set OP01 --file data/catalog/opcg/OP01/cards.jsonl
 *   적재      npm run catalog:import -- --game opcg-kr --set OP01 --file <path> --apply --from-report <report.json>
 *
 * 🚨 이 파일은 `vitest`의 `include`(`src/**\/*.{test,spec}.{ts,tsx}`)가 닿지
 * 않는다 — 판단이 들어가는 로직은 전부 `src/lib/catalog/`로 올렸다.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildImportPlan, type ExistingCardRow } from "@/lib/catalog/plan";
import {
  renderReport,
  shouldAbortApply,
  summarizePlan,
  type ApplyOutcome,
  type ImportReport,
} from "@/lib/catalog/report";
import { checkApplyGates, pickLatestDump, type DumpFileFact } from "@/lib/catalog/gate";
import { normalizedCardSchema, type NormalizedCard } from "@/lib/validation/catalog";

const BACKUPS_DIR = "backups";
const OUT_DIR = "data";

interface Args {
  readonly game: string;
  readonly set: string;
  readonly file: string;
  readonly apply: boolean;
  readonly mode: "insert-only" | "update";
  readonly fromReport: string | null;
}

function readArgValue(argv: readonly string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function parseArgs(argv: readonly string[]): Args {
  const game = readArgValue(argv, "--game");
  const set = readArgValue(argv, "--set");
  const file = readArgValue(argv, "--file");
  const fromReport = readArgValue(argv, "--from-report") ?? null;
  const apply = argv.includes("--apply");
  const mode = argv.includes("--update") ? "update" : "insert-only";

  if (!game) throw new Error("--game이 필요하다.");
  if (!set) throw new Error("--set이 필요하다.");
  if (!file) throw new Error("--file이 필요하다.");

  return { game, set, file, apply, mode, fromReport };
}

function sha256Of(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

/** `<stamp> = 20260829T091234Z` (collect-catalog.ts와 같은 형식). */
function stampUtc(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function readJsonl(path: string): { readonly text: string; readonly cards: readonly NormalizedCard[] } {
  const text = readFileSync(path, "utf-8");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const cards = lines.map((line) => normalizedCardSchema.parse(JSON.parse(line)));
  return { text, cards };
}

function readBackupDumps(): readonly DumpFileFact[] {
  let names: string[];
  try {
    names = readdirSync(BACKUPS_DIR);
  } catch {
    return [];
  }
  return names.map((name) => {
    const stat = statSync(join(BACKUPS_DIR, name));
    return { name, mtimeMs: stat.mtimeMs, sizeBytes: stat.size };
  });
}

interface SupabaseRest {
  readonly get: <T>(path: string) => Promise<T>;
  readonly post: <T>(table: string, rows: readonly unknown[]) => Promise<{ readonly data: T[] | null; readonly error: { readonly code: string; readonly message: string } | null }>;
  readonly patch: (table: string, match: Record<string, string>, values: Record<string, unknown>) => Promise<{ readonly error: { readonly code: string; readonly message: string } | null }>;
  readonly host: string;
}

function createSupabaseRest(): SupabaseRest {
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

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  async function post<T>(
    table: string,
    rows: readonly unknown[],
  ): Promise<{ data: T[] | null; error: { code: string; message: string } | null }> {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (res.ok) {
      return { data: (await res.json()) as T[], error: null };
    }
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    return { data: null, error: { code: body.code ?? "unknown", message: body.message ?? (await res.text().catch(() => res.statusText)) } };
  }

  async function patch(
    table: string,
    match: Record<string, string>,
    values: Record<string, unknown>,
  ): Promise<{ error: { code: string; message: string } | null }> {
    const qs = Object.entries(match)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
      .join("&");
    const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(values),
    });
    if (res.ok) return { error: null };
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    return { error: { code: body.code ?? "unknown", message: body.message ?? (await res.text().catch(() => res.statusText)) } };
  }

  return { get, post, patch, host: new URL(url).host };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rest = createSupabaseRest();

  const { text: fileText, cards } = readJsonl(args.file);
  const inputSha256 = sha256Of(fileText);

  const games = await rest.get<{ id: string; code: string }[]>(`games?code=eq.${args.game}&select=id,code`);
  const game = games[0] ? { code: games[0].code, id: games[0].id } : null;

  const setsRows = game
    ? await rest.get<{ id: string; code: string }[]>(
        `card_sets?game_id=eq.${game.id}&code=eq.${args.set}&select=id,code`,
      )
    : [];
  const set = setsRows[0] ? { code: setsRows[0].code, id: setsRows[0].id } : null;

  type ExistingRow = { code: string; set_id: string | null } & Record<string, unknown>;
  const codes = cards.map((c) => c.code);
  const codesFilter = codes.length > 0 ? `(${codes.map((c) => `"${c}"`).join(",")})` : "()";
  const existingRows: readonly ExistingRow[] = game
    ? await rest.get<ExistingRow[]>(
        `cards?game_id=eq.${game.id}&code=in.${codesFilter}` +
          `&select=code,set_id,name_ko,name_en,rarity,attribute,card_type,sub_type,effect_text,colors,life,cost,power,counter,traits,trigger_text,illustration_type,block_number,source_image_url`,
      )
    : [];
  const existing: ExistingCardRow[] = existingRows.map((row) => {
    const { code, set_id, ...values } = row;
    return { code, set_id, values: values as ExistingCardRow["values"] };
  });

  const plan = buildImportPlan({ game, set, cards, existing, mode: args.mode });

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = stampUtc();
  const reportPath = join(OUT_DIR, `import-report-${stamp}.json`);

  let apply: ApplyOutcome | null = null;

  if (args.apply) {
    const dumps = readBackupDumps();
    const dump = pickLatestDump(dumps);

    let fromReportShape: {
      inputSha256: string;
      game: string;
      set: string;
      mode: string;
      conclusionOk: boolean;
    } | null = null;
    if (args.fromReport) {
      const raw = JSON.parse(readFileSync(args.fromReport, "utf-8")) as ImportReport;
      fromReportShape = {
        inputSha256: raw.input.sha256,
        game: raw.input.game,
        set: raw.input.set,
        mode: raw.target.mode,
        conclusionOk: raw.conclusion.ok,
      };
    }

    const failures = checkApplyGates({
      apply: true,
      now: Date.now(),
      dump,
      fromReport: fromReportShape,
      current: { sha256: inputSha256, game: args.game, set: args.set, mode: args.mode },
      conclusion: plan.conclusion,
    });

    if (failures.length > 0) {
      console.error("적재 관문 실패:");
      for (const f of failures) console.error(`  관문 ${f.gate}: ${f.reason}`);
      process.exitCode = 1;
      return;
    }

    const failed: { code: string; pgCode: string | null; message: string }[] = [];
    const raced: string[] = [];
    let succeeded = 0;
    let attempted = 0;
    let consecutiveFailures = 0;
    let stoppedBy: "completed" | "consecutive_failures" = "completed";

    const writable = plan.rows.filter((r) => r.verdict === "insert" || r.verdict === "update");
    for (const planned of writable) {
      attempted += 1;
      if (planned.verdict === "insert" && planned.row) {
        const insertRow: Record<string, unknown> = {
          ...(planned.row as unknown as Record<string, unknown>),
          game_id: game?.id,
          set_id: set?.id,
        };
        const { error } = await rest.post("cards", [insertRow]);
        if (!error) {
          succeeded += 1;
          consecutiveFailures = 0;
        } else if (error.code === "23505") {
          raced.push(planned.code);
          consecutiveFailures = 0;
        } else {
          failed.push({ code: planned.code, pgCode: error.code, message: error.message });
          consecutiveFailures += 1;
        }
      } else if (planned.verdict === "update") {
        const values: Record<string, unknown> = {};
        for (const change of planned.changes) values[change.column] = change.after;
        const { error } = await rest.patch("cards", { game_id: game?.id ?? "", code: planned.code }, values);
        if (!error) {
          succeeded += 1;
          consecutiveFailures = 0;
        } else if (error.code === "23505") {
          raced.push(planned.code);
          consecutiveFailures = 0;
        } else {
          failed.push({ code: planned.code, pgCode: error.code, message: error.message });
          consecutiveFailures += 1;
        }
      }

      if (shouldAbortApply(consecutiveFailures)) {
        stoppedBy = "consecutive_failures";
        break;
      }
    }

    apply = { attempted, succeeded, failed, raced, stoppedBy };
  }

  const report = summarizePlan(plan, {
    file: args.file,
    sha256: inputSha256,
    collectedAt: null,
    game: args.game,
    set: args.set,
    host: rest.host,
    mode: args.mode,
    applied: args.apply,
    gameId: game?.id ?? null,
    setId: set?.id ?? null,
    now: () => new Date().toISOString(),
    apply,
  });

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(renderReport(report));
  console.log(`\n리포트: ${reportPath}`);

  if (apply?.stoppedBy === "consecutive_failures") {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
