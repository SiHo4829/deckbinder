/**
 * 기존 DB 행 + `NormalizedCard[]` → `ImportPlan` — T1.18 임포터 계약 (plan §4.11 ⓒ).
 *
 * 🚨 **순수. 조회하지 않는다.** 기존 행 목록을 인자로 받는다(§4.8 ⓘ가 「그러면
 * 분류기가 순수 함수가 된다」고 이미 적었다).
 */
import { normalizeCard, type CardRowDraft, type NormalizeIssue } from "@/lib/catalog/normalize";
// 🚨 `ImportCounts`는 report.ts가 정의한다("세는 일 전부" — ⓘ-3). plan.ts는
// 그 결과 형태를 타입으로만 참조한다(런타임 순환은 없다 — `import type`).
import type { ImportCounts } from "@/lib/catalog/report";
import type { NormalizedCard } from "@/lib/validation/catalog";

/** DB에서 읽어 온 기존 행. */
export interface ExistingCardRow {
  readonly code: string;
  readonly set_id: string | null;
  readonly values: Readonly<Partial<Record<UpdatableColumn, unknown>>>; // 화이트리스트 컬럼의 현재 값
}

export type UpdatableColumn =
  | "name_ko"
  | "name_en"
  | "rarity"
  | "attribute"
  | "card_type"
  | "sub_type"
  | "effect_text"
  | "colors"
  | "life"
  | "cost"
  | "power"
  | "counter"
  | "traits"
  | "trigger_text"
  | "illustration_type"
  | "block_number"
  | "source_image_url";
// 🚨 `image_url`은 없다(§8 T1.18 ⓕ ★★) · `name_ja`·`code`·`game_id`·`set_id`도 없다(§4.8 ⓕ)

const UPDATABLE_COLUMNS: readonly UpdatableColumn[] = [
  "name_ko",
  "rarity",
  "attribute",
  "card_type",
  "effect_text",
  "colors",
  "life",
  "cost",
  "power",
  "counter",
  "traits",
  "trigger_text",
  "illustration_type",
  "block_number",
  "source_image_url",
];

export type RowVerdict = "insert" | "skip:same_set" | "skip:other_set" | "update" | "invalid";

export interface ColumnChange {
  readonly column: UpdatableColumn;
  readonly before: unknown;
  readonly after: unknown;
}

export interface PlannedRow {
  readonly code: string;
  readonly verdict: RowVerdict;
  readonly row: CardRowDraft | null; // invalid면 null
  readonly changes: readonly ColumnChange[]; // update일 때만 비지 않는다
  readonly issues: readonly NormalizeIssue[];
  readonly existingSetId: string | null; // skip:other_set의 「기존 세트」
  readonly prefixMismatch: boolean; // code 접두사가 --set과 어긋난다
}

export type ImportConclusion =
  | { readonly ok: true; readonly counts: ImportCounts }
  | { readonly ok: false; readonly reason: BlockReason };

export type BlockReason =
  | "set_not_found"
  | "game_not_found"
  | "duplicate_code_in_file"
  | "empty_file"
  | "schema_mismatch";

export interface BuildImportPlanInput {
  readonly game: { readonly code: string; readonly id: string } | null; // null = 조회 실패
  readonly set: { readonly code: string; readonly id: string } | null; // null = card_sets에 없다
  readonly cards: readonly NormalizedCard[]; // 중간 파일 전량 (파싱 완료)
  readonly existing: readonly ExistingCardRow[]; // 같은 game_id에서 code로 조회한 결과
  readonly mode: "insert-only" | "update";
}

export interface ImportPlan {
  readonly rows: readonly PlannedRow[];
  readonly conclusion: ImportConclusion;
}

function isPrefixMismatch(code: string, setCode: string): boolean {
  // "OP01-001" 형태 — 접두사는 첫 `-` 앞. `setCode`(예: "OPK-14")와 정확히
  // 같아야 한다는 규칙이 아니라, 관측된 세트 코드 접두사 규칙을 따른다.
  // §4.11 ⓖ의 「비율로 보고한다」에 쓰일 신호일 뿐 여기서는 판정하지 않는다 —
  // code 정규식을 만들지 않는다(ⓚ-4)는 방침에 따라 아주 단순한 형태만 본다.
  const prefix = code.split("-")[0]?.split("_")[0] ?? code;
  return prefix !== setCode;
}

function blockedPlan(reason: BlockReason): ImportPlan {
  return { rows: [], conclusion: { ok: false, reason } };
}

function hasDuplicateCode(cards: readonly NormalizedCard[]): boolean {
  const seen = new Set<string>();
  for (const c of cards) {
    // 🚨 대소문자를 접지 않는다(ⓗ-6). "_P1"과 "_p1"은 다른 코드다.
    if (seen.has(c.code)) return true;
    seen.add(c.code);
  }
  return false;
}

function planRow(
  card: NormalizedCard,
  input: BuildImportPlanInput,
  existingByCode: ReadonlyMap<string, ExistingCardRow>,
): PlannedRow {
  const setCode = input.set?.code ?? "";
  const prefixMismatch = isPrefixMismatch(card.code, setCode);
  const normalized = normalizeCard(card);

  if (!normalized.ok) {
    return {
      code: card.code,
      verdict: "invalid",
      row: null,
      changes: [],
      issues: normalized.issues,
      existingSetId: null,
      prefixMismatch,
    };
  }

  const existing = existingByCode.get(card.code);
  if (!existing) {
    return {
      code: card.code,
      verdict: "insert",
      row: normalized.row,
      changes: [],
      issues: normalized.warnings,
      existingSetId: null,
      prefixMismatch,
    };
  }

  if (existing.set_id !== input.set?.id) {
    return {
      code: card.code,
      verdict: "skip:other_set",
      row: normalized.row,
      changes: [],
      issues: normalized.warnings,
      existingSetId: existing.set_id,
      prefixMismatch,
    };
  }

  if (input.mode !== "update") {
    return {
      code: card.code,
      verdict: "skip:same_set",
      row: normalized.row,
      changes: [],
      issues: normalized.warnings,
      existingSetId: existing.set_id,
      prefixMismatch,
    };
  }

  const changes: ColumnChange[] = [];
  for (const column of UPDATABLE_COLUMNS) {
    const before = existing.values[column] ?? null;
    const after = (normalized.row as unknown as Record<UpdatableColumn, unknown>)[column] ?? null;
    if (!valuesEqual(before, after)) {
      changes.push({ column, before, after });
    }
  }

  if (changes.length === 0) {
    return {
      code: card.code,
      verdict: "skip:same_set",
      row: normalized.row,
      changes: [],
      issues: normalized.warnings,
      existingSetId: existing.set_id,
      prefixMismatch,
    };
  }

  return {
    code: card.code,
    verdict: "update",
    row: normalized.row,
    changes,
    issues: normalized.warnings,
    existingSetId: existing.set_id,
    prefixMismatch,
  };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
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

export function buildImportPlan(input: BuildImportPlanInput): ImportPlan {
  if (input.cards.length === 0) {
    return blockedPlan("empty_file");
  }
  if (hasDuplicateCode(input.cards)) {
    return blockedPlan("duplicate_code_in_file");
  }
  if (!input.game) {
    return blockedPlan("game_not_found");
  }
  if (!input.set) {
    return blockedPlan("set_not_found");
  }

  const existingByCode = new Map(input.existing.map((row) => [row.code, row]));
  const rows = input.cards.map((card) => planRow(card, input, existingByCode));
  const counts = countRows(rows);

  return { rows, conclusion: { ok: true, counts } };
}
