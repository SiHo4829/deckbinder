import { describe, expect, it } from "vitest";

import {
  checkApplyGates,
  DUMP_MAX_AGE_MS,
  pickLatestDump,
  type ApplyGateInput,
  type DumpFileFact,
} from "@/lib/catalog/gate";
import type { ImportConclusion } from "@/lib/catalog/plan";

const NOW = 1_700_000_000_000;

const validDump: DumpFileFact = {
  name: "catalog-20260829-120000.sql",
  mtimeMs: NOW - 1000,
  sizeBytes: 1024,
};

const validReport: ApplyGateInput["fromReport"] = {
  inputSha256: "abc123",
  game: "opcg",
  set: "OP01",
  mode: "insert-only",
  conclusionOk: true,
};

const current: ApplyGateInput["current"] = {
  sha256: "abc123",
  game: "opcg",
  set: "OP01",
  mode: "insert-only",
};

const okConclusion: ImportConclusion = {
  ok: true,
  counts: { total: 1, insert: 1, skipSameSet: 0, skipOtherSet: 0, update: 0, invalid: 0 },
};

function baseInput(overrides: Partial<ApplyGateInput> = {}): ApplyGateInput {
  return {
    apply: true,
    now: NOW,
    dump: validDump,
    fromReport: validReport,
    current,
    conclusion: okConclusion,
    ...overrides,
  };
}

describe("checkApplyGates", () => {
  it("1. --apply 없음 → 관문 판정 자체가 필요 없다(빈 배열)", () => {
    const failures = checkApplyGates(baseInput({ apply: false, dump: null, fromReport: null }));
    expect(failures).toEqual([]);
  });

  it("2. 덤프 없음 → 관문 2 실패", () => {
    const failures = checkApplyGates(baseInput({ dump: null }));
    expect(failures).toContainEqual({ gate: 2, reason: "dump_missing" });
  });

  it("3. 23시간 59분 → 통과 · 24시간 1분 → 실패(경계)", () => {
    const almostStale: DumpFileFact = { ...validDump, mtimeMs: NOW - (23 * 60 + 59) * 60 * 1000 };
    const withinBoundary = checkApplyGates(baseInput({ dump: almostStale }));
    expect(withinBoundary.some((f) => f.gate === 2)).toBe(false);

    const justStale: DumpFileFact = { ...validDump, mtimeMs: NOW - DUMP_MAX_AGE_MS - 60 * 1000 };
    const pastBoundary = checkApplyGates(baseInput({ dump: justStale }));
    expect(pastBoundary).toContainEqual({ gate: 2, reason: "dump_stale" });
  });

  it("4. 0바이트 덤프는 후보에서 빠진다(pickLatestDump)", () => {
    const zero: DumpFileFact = { name: "catalog-20260829-120000.sql", mtimeMs: NOW, sizeBytes: 0 };
    expect(pickLatestDump([zero])).toBeNull();
  });

  it("5. 이름 패턴이 다른 파일은 후보에서 빠진다(pickLatestDump)", () => {
    const wrongName: DumpFileFact = { name: "backup.sql", mtimeMs: NOW, sizeBytes: 100 };
    expect(pickLatestDump([wrongName])).toBeNull();
  });

  it("6. pickLatestDump가 mtime 최대를 고른다 — 이름이 더 최근인 다른 파일이 있어도", () => {
    const older: DumpFileFact = { name: "catalog-20260829-120000.sql", mtimeMs: NOW - 5000, sizeBytes: 100 };
    // 파일명은 더 최근처럼 보이지만(20260830) mtime이 더 이르다.
    const newerNameOlderMtime: DumpFileFact = {
      name: "catalog-20260830-000000.sql",
      mtimeMs: NOW - 10_000,
      sizeBytes: 100,
    };
    expect(pickLatestDump([older, newerNameOlderMtime])).toEqual(older);
  });

  it("7. 리포트 해시 불일치 → 관문 3 실패 / set만 다른 경우도 실패", () => {
    const shaMismatch = checkApplyGates(
      baseInput({ fromReport: { ...validReport, inputSha256: "different" } }),
    );
    expect(shaMismatch).toContainEqual({ gate: 3, reason: "sha256_mismatch" });

    const setMismatch = checkApplyGates(baseInput({ fromReport: { ...validReport, set: "OP02" } }));
    expect(setMismatch).toContainEqual({ gate: 3, reason: "set_mismatch" });
    // 나머지가 일치하면 그 자체로는 다른 관문을 건드리지 않는다.
    expect(setMismatch.some((f) => f.gate === 2)).toBe(false);
  });

  it("8. 🚨 관문 넷이 동시에 실패하면 실패 넷이 전부 배열에 담긴다(첫 실패에서 멈추지 않는다)", () => {
    const failures = checkApplyGates(
      baseInput({
        dump: null,
        fromReport: null,
        conclusion: { ok: false, reason: "set_not_found" },
      }),
    );
    const gates = failures.map((f) => f.gate);
    expect(gates).toContain(2);
    expect(gates).toContain(3);
    expect(gates).toContain(4);
    expect(failures.length).toBeGreaterThanOrEqual(3);
  });
});
