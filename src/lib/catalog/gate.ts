/**
 * `--apply` 관문 넷의 판정 — T1.18 임포터 계약 (plan §4.11 ⓒ · ⓖ).
 *
 * 🚨 **순수. 읽지 않는다.** `fs`를 import하지 않는다 — mtime·크기·해시를
 * 값으로 받는다. 이래야 「24시간 경계」를 시계 없이 테스트할 수 있다.
 */
import type { ImportConclusion } from "@/lib/catalog/plan";

export const DUMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DUMP_FILE_PATTERN = /^catalog-\d{8}-\d{6}\.sql$/;

export interface DumpFileFact {
  readonly name: string;
  readonly mtimeMs: number;
  readonly sizeBytes: number;
}

/** 🚨 이름 패턴 + 크기>0을 통과한 것 중 mtime이 가장 큰 것. 이름의 시각을 믿지 않는다(ⓖ). */
export function pickLatestDump(files: readonly DumpFileFact[]): DumpFileFact | null {
  const candidates = files.filter((f) => DUMP_FILE_PATTERN.test(f.name) && f.sizeBytes > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, f) => (f.mtimeMs > latest.mtimeMs ? f : latest));
}

export interface ApplyGateInput {
  readonly apply: boolean;
  readonly now: number;
  readonly dump: DumpFileFact | null;
  readonly fromReport: {
    readonly inputSha256: string;
    readonly game: string;
    readonly set: string;
    readonly mode: string;
    readonly conclusionOk: boolean;
  } | null;
  readonly current: { readonly sha256: string; readonly game: string; readonly set: string; readonly mode: string };
  readonly conclusion: ImportConclusion;
}

export type GateFailure = { readonly gate: 1 | 2 | 3 | 4; readonly reason: string };

/** 빈 배열이면 통과. 🚨 첫 실패에서 멈추지 않고 넷을 전부 판정해 모아 돌려준다(ⓖ). */
export function checkApplyGates(input: ApplyGateInput): readonly GateFailure[] {
  // 관문 1 — `--apply` 없으면 관문 판정 자체가 필요 없다(빈 배열).
  if (!input.apply) {
    return [];
  }

  const failures: GateFailure[] = [];

  // 관문 2 — backups/의 최신 덤프가 24시간 이내.
  if (!input.dump) {
    failures.push({ gate: 2, reason: "dump_missing" });
  } else if (input.now - input.dump.mtimeMs > DUMP_MAX_AGE_MS) {
    failures.push({ gate: 2, reason: "dump_stale" });
  }

  // 관문 3 — --from-report 필수 + 해시·game·set·mode 대조 + 리포트 결론 확인.
  if (!input.fromReport) {
    failures.push({ gate: 3, reason: "from_report_missing" });
  } else {
    if (input.fromReport.inputSha256 !== input.current.sha256) {
      failures.push({ gate: 3, reason: "sha256_mismatch" });
    }
    if (input.fromReport.game !== input.current.game) {
      failures.push({ gate: 3, reason: "game_mismatch" });
    }
    if (input.fromReport.set !== input.current.set) {
      failures.push({ gate: 3, reason: "set_mismatch" });
    }
    if (input.fromReport.mode !== input.current.mode) {
      failures.push({ gate: 3, reason: "mode_mismatch" });
    }
    if (!input.fromReport.conclusionOk) {
      failures.push({ gate: 3, reason: "report_conclusion_blocked" });
    }
  }

  // 관문 4 — --game · --set이 DB에 실재.
  if (!input.conclusion.ok) {
    if (input.conclusion.reason === "game_not_found") {
      failures.push({ gate: 4, reason: "game_not_found" });
    } else if (input.conclusion.reason === "set_not_found") {
      failures.push({ gate: 4, reason: "set_not_found" });
    }
  }

  return failures;
}
