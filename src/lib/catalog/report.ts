/**
 * `ImportPlan`(+적재 결과) → 리포트 — T1.18 임포터 계약 (plan §4.11 ⓒ · ⓘ).
 *
 * 🚨 **세는 일 전부 여기.** `console.log`를 부르지 않고 **문자열을 돌려준다**.
 * 파일도 쓰지 않는다. 이 모듈에 판단이 있는 것이 계약이다 — T1.16 결함 1
 * (`failureCount` 오집계)이 이 자리를 `scripts/`에 둬서 났다(ⓘ-3).
 */
import type { CardRowDraft, NormalizeIssue } from "@/lib/catalog/normalize";
import type { ColumnChange, ImportConclusion, ImportPlan, PlannedRow } from "@/lib/catalog/plan";

export interface ImportCounts {
  readonly total: number;
  readonly insert: number;
  readonly skipSameSet: number;
  readonly skipOtherSet: number; // ★ 합치지 않는다(§4.8 ⓕ ★4)
  readonly update: number;
  readonly invalid: number;
}

export type PrefixMismatchKind = "silent" | "suspect" | "reprint_set"; // r=0 / 0<r<100 / r=100

export interface PrefixMismatchSummary {
  readonly mismatched: number;
  readonly total: number;
  readonly ratio: number;
  readonly kind: PrefixMismatchKind;
  readonly rows: readonly string[]; // suspect일 때만 채운다(ⓘ)
}

export interface ImportReport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly input: {
    readonly file: string;
    readonly sha256: string;
    readonly collectedAt: string | null;
    readonly rowCount: number;
    readonly game: string;
    readonly set: string;
  };
  readonly target: { readonly host: string; readonly mode: "insert-only" | "update"; readonly applied: boolean };
  readonly mapping: { readonly gameId: string | null; readonly setId: string | null };
  readonly counts: ImportCounts;
  readonly prefix: PrefixMismatchSummary;
  readonly otherSetRows: readonly { code: string; existingSetId: string; targetSetId: string }[];
  readonly invalidRows: readonly { code: string; issues: readonly NormalizeIssue[] }[];
  readonly updates: readonly { code: string; changes: readonly ColumnChange[] }[];
  readonly samples: readonly CardRowDraft[]; // insert 앞 5건 전문
  readonly conclusion: ImportConclusion;
  readonly apply: ApplyOutcome | null; // 드라이런이면 null
}

export interface ReportMeta {
  readonly file: string;
  readonly sha256: string;
  readonly collectedAt: string | null;
  readonly game: string;
  readonly set: string;
  readonly host: string;
  readonly mode: "insert-only" | "update";
  readonly applied: boolean;
  readonly gameId: string | null;
  readonly setId: string | null;
  readonly now: () => string; // ★ 시계를 값으로 받는다 — gate.ts와 같은 이유
  readonly apply: ApplyOutcome | null;
}

export const CONSECUTIVE_FAILURE_LIMIT = 10;

export interface ApplyOutcome {
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: readonly { readonly code: string; readonly pgCode: string | null; readonly message: string }[];
  readonly raced: readonly string[]; // 23505 — 계획 뒤 다른 경로가 먼저 넣었다(ⓗ-5)
  readonly stoppedBy: "completed" | "consecutive_failures";
}

export function shouldAbortApply(consecutiveFailures: number): boolean {
  return consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT;
}

function countRows(rows: readonly PlannedRow[]): ImportCounts {
  let insert = 0;
  let skipSameSet = 0;
  let skipOtherSet = 0;
  let update = 0;
  let invalid = 0;
  for (const row of rows) {
    switch (row.verdict) {
      case "insert":
        insert += 1;
        break;
      case "skip:same_set":
        skipSameSet += 1;
        break;
      case "skip:other_set":
        skipOtherSet += 1;
        break;
      case "update":
        update += 1;
        break;
      case "invalid":
        invalid += 1;
        break;
    }
  }
  return { total: rows.length, insert, skipSameSet, skipOtherSet, update, invalid };
}

function summarizePrefixMismatch(rows: readonly PlannedRow[]): PrefixMismatchSummary {
  const total = rows.length;
  const mismatchedRows = rows.filter((r) => r.prefixMismatch);
  const mismatched = mismatchedRows.length;
  const ratio = total === 0 ? 0 : mismatched / total;
  let kind: PrefixMismatchKind;
  if (mismatched === 0) {
    kind = "silent";
  } else if (mismatched === total) {
    kind = "reprint_set";
  } else {
    kind = "suspect";
  }
  // 🚨 reprint_set(r=100)에서는 행 목록을 비운다 — STK 전체가 소음이 되지 않게(ⓙ-16).
  const rowsOut = kind === "suspect" ? mismatchedRows.map((r) => r.code) : [];
  return { mismatched, total, ratio, kind, rows: rowsOut };
}

export function summarizePlan(plan: ImportPlan, meta: ReportMeta): ImportReport {
  const counts = countRows(plan.rows);
  const prefix = summarizePrefixMismatch(plan.rows);

  const otherSetRows = plan.rows
    .filter((r) => r.verdict === "skip:other_set")
    .map((r) => ({
      code: r.code,
      existingSetId: r.existingSetId ?? "",
      targetSetId: meta.setId ?? "",
    }));

  const invalidRows = plan.rows
    .filter((r) => r.verdict === "invalid")
    .map((r) => ({ code: r.code, issues: r.issues }));

  const updates = plan.rows
    .filter((r) => r.verdict === "update")
    .map((r) => ({ code: r.code, changes: r.changes }));

  const samples = plan.rows
    .filter((r) => r.verdict === "insert" && r.row !== null)
    .slice(0, 5)
    .map((r) => r.row as CardRowDraft);

  return {
    schemaVersion: 1,
    generatedAt: meta.now(),
    input: {
      file: meta.file,
      sha256: meta.sha256,
      collectedAt: meta.collectedAt,
      rowCount: plan.rows.length,
      game: meta.game,
      set: meta.set,
    },
    target: { host: meta.host, mode: meta.mode, applied: meta.applied },
    mapping: { gameId: meta.gameId, setId: meta.setId },
    counts,
    prefix,
    otherSetRows,
    invalidRows,
    updates,
    samples,
    conclusion: plan.conclusion,
    apply: meta.apply,
  };
}

function conclusionLine(report: ImportReport): string {
  if (!report.conclusion.ok) {
    return `적재 불가: ${report.conclusion.reason}`;
  }
  const c = report.counts;
  return (
    `적재 가능: insert ${c.insert} / skip ${c.skipSameSet + c.skipOtherSet}` +
    `(same ${c.skipSameSet}, other ${c.skipOtherSet}) / update ${c.update} / invalid ${c.invalid}`
  );
}

export function renderReport(report: ImportReport): string {
  const lines: string[] = [];

  lines.push("=== 1. 입력 요약 ===");
  lines.push(`파일: ${report.input.file}`);
  lines.push(`sha256: ${report.input.sha256}`);
  lines.push(`행 수: ${report.input.rowCount}`);
  lines.push(`game: ${report.input.game} / set: ${report.input.set}`);
  lines.push(`대상 호스트: ${report.target.host} (mode=${report.target.mode}, applied=${report.target.applied})`);
  lines.push("");

  lines.push("=== 2. 매핑 판정 ===");
  lines.push(`gameId: ${report.mapping.gameId ?? "(없음)"}`);
  lines.push(`setId: ${report.mapping.setId ?? "(없음)"}`);
  lines.push("");

  lines.push("=== 3. 행 분류 ===");
  lines.push(
    `insert ${report.counts.insert} / skip:same_set ${report.counts.skipSameSet} / ` +
      `skip:other_set ${report.counts.skipOtherSet} / update ${report.counts.update} / invalid ${report.counts.invalid}`,
  );
  const mismatchPct = (report.prefix.ratio * 100).toFixed(0);
  lines.push(`접두사 불일치 ${report.prefix.mismatched} / ${report.prefix.total} (${mismatchPct}%, ${report.prefix.kind})`);
  lines.push("");

  lines.push("=== 4. 결론 ===");
  lines.push(conclusionLine(report));

  if (report.samples.length > 0) {
    lines.push("");
    lines.push("=== 샘플 (insert 앞 5건) ===");
    for (const sample of report.samples) {
      lines.push(JSON.stringify(sample));
    }
  }

  return lines.join("\n");
}
