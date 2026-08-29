import { describe, expect, it, vi } from "vitest";

import type { CardRowDraft } from "@/lib/catalog/normalize";
import type { ImportPlan, PlannedRow } from "@/lib/catalog/plan";
import { renderReport, shouldAbortApply, summarizePlan, type ReportMeta } from "@/lib/catalog/report";

const draft: CardRowDraft = {
  code: "OP01-001",
  name_ko: "테스트 카드",
  name_ja: null,
  card_type: "캐릭터",
  colors: ["적색"],
  life: null,
  cost: 5000,
  power: 5000,
  counter: 1000,
  attribute: "타격",
  traits: ["초신성"],
  rarity: "R",
  effect_text: "효과 텍스트",
  trigger_text: null,
  illustration_type: "오리지널",
  block_number: 2,
  source_image_url: "https://onepiece-cardgame.kr/fileDownload?downname=abc",
};

function row(overrides: Partial<PlannedRow>): PlannedRow {
  return {
    code: "OP01-001",
    verdict: "insert",
    row: draft,
    changes: [],
    issues: [],
    existingSetId: null,
    prefixMismatch: false,
    ...overrides,
  };
}

function meta(overrides: Partial<ReportMeta> = {}): ReportMeta {
  return {
    file: "data/catalog/opcg/OP01/cards.jsonl",
    sha256: "abc123",
    collectedAt: "2026-08-29T00:00:00.000Z",
    game: "opcg",
    set: "OP01",
    host: "https://xxxxx.supabase.co",
    mode: "insert-only",
    applied: false,
    gameId: "game-1",
    setId: "set-1",
    now: () => "2026-08-29T12:00:00.000Z",
    apply: null,
    ...overrides,
  };
}

function plan(rows: readonly PlannedRow[]): ImportPlan {
  const insert = rows.filter((r) => r.verdict === "insert").length;
  const skipSameSet = rows.filter((r) => r.verdict === "skip:same_set").length;
  const skipOtherSet = rows.filter((r) => r.verdict === "skip:other_set").length;
  const update = rows.filter((r) => r.verdict === "update").length;
  const invalid = rows.filter((r) => r.verdict === "invalid").length;
  return {
    rows,
    conclusion: {
      ok: true,
      counts: { total: rows.length, insert, skipSameSet, skipOtherSet, update, invalid },
    },
  };
}

describe("summarizePlan", () => {
  it("1. counts가 5종 + total로 맞아떨어진다(합이 입력 행 수와 같다)", () => {
    const rows = [
      row({ code: "A", verdict: "insert" }),
      row({ code: "B", verdict: "skip:same_set" }),
      row({ code: "C", verdict: "skip:other_set", existingSetId: "set-other" }),
      row({ code: "D", verdict: "update", changes: [{ column: "power", before: 1, after: 2 }] }),
      row({ code: "E", verdict: "invalid", row: null }),
    ];
    const report = summarizePlan(plan(rows), meta());
    const c = report.counts;
    expect(c.insert + c.skipSameSet + c.skipOtherSet + c.update + c.invalid).toBe(c.total);
    expect(c.total).toBe(5);
  });

  it("2. 🚨 skip을 합치지 않는다 — skipSameSet·skipOtherSet이 따로 나온다", () => {
    const rows = [
      row({ code: "A", verdict: "skip:same_set" }),
      row({ code: "B", verdict: "skip:other_set", existingSetId: "set-other" }),
    ];
    const report = summarizePlan(plan(rows), meta());
    expect(report.counts.skipSameSet).toBe(1);
    expect(report.counts.skipOtherSet).toBe(1);
  });

  it("3. 결론 문자열이 적재 가능/적재 불가를 정확히 가른다", () => {
    const ok = summarizePlan(plan([row({ verdict: "insert" })]), meta());
    expect(renderReport(ok)).toContain("적재 가능:");

    const blocked = summarizePlan(
      { rows: [], conclusion: { ok: false, reason: "set_not_found" } },
      meta(),
    );
    expect(renderReport(blocked)).toContain("적재 불가: set_not_found");
  });

  it("4. 샘플이 insert 앞 5건이고 5건 미만이면 있는 만큼", () => {
    const sixInserts = Array.from({ length: 6 }, (_, i) =>
      row({ code: `CODE-${i}`, verdict: "insert", row: { ...draft, code: `CODE-${i}` } }),
    );
    const report6 = summarizePlan(plan(sixInserts), meta());
    expect(report6.samples).toHaveLength(5);
    expect(report6.samples.map((s) => s.code)).toEqual(["CODE-0", "CODE-1", "CODE-2", "CODE-3", "CODE-4"]);

    const twoInserts = [
      row({ code: "A", verdict: "insert", row: { ...draft, code: "A" } }),
      row({ code: "B", verdict: "insert", row: { ...draft, code: "B" } }),
    ];
    const report2 = summarizePlan(plan(twoInserts), meta());
    expect(report2.samples).toHaveLength(2);
  });

  it("5. shouldAbortApply — 9 → false · 10 → true", () => {
    expect(shouldAbortApply(9)).toBe(false);
    expect(shouldAbortApply(10)).toBe(true);
  });

  it("6. renderReport가 문자열을 돌려주고 console을 부르지 않는다", () => {
    const spy = vi.spyOn(console, "log");
    const report = summarizePlan(plan([row({ verdict: "insert" })]), meta());
    const output = renderReport(report);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("summarizePlan — 접두사 불일치 분류", () => {
  it("r = 0 → silent", () => {
    const rows = [row({ prefixMismatch: false }), row({ code: "B", prefixMismatch: false })];
    const report = summarizePlan(plan(rows), meta());
    expect(report.prefix.kind).toBe("silent");
    expect(report.prefix.rows).toEqual([]);
  });

  it("0 < r < 100 → suspect (행 목록이 채워진다)", () => {
    const rows = [
      row({ code: "A", prefixMismatch: false }),
      row({ code: "B", prefixMismatch: true }),
    ];
    const report = summarizePlan(plan(rows), meta());
    expect(report.prefix.kind).toBe("suspect");
    expect(report.prefix.rows).toEqual(["B"]);
  });

  it("r = 100 → reprint_set (행 목록이 비어 있다)", () => {
    const rows = [
      row({ code: "A", prefixMismatch: true }),
      row({ code: "B", prefixMismatch: true }),
    ];
    const report = summarizePlan(plan(rows), meta());
    expect(report.prefix.kind).toBe("reprint_set");
    expect(report.prefix.rows).toEqual([]);
  });
});
