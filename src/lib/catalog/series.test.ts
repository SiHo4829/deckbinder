/**
 * 계열 단위 수집의 **판단** 전량을 고정한다 — plan §4.10 · T1.24 완료 기준 ⓛ.
 *
 * 🚨 이 파일이 있는 이유는 하나다: 이 프로젝트는 판단을 `scripts/`에 두어
 * 결함을 다섯 번 냈고(§4.10 ⓖ), 전부 **테스트가 붙지 않는 자리**였기
 * 때문이다. 계열 확장이 새로 만드는 판단은 여기서 증명된다.
 */

import { describe, expect, it } from "vitest";

import type { ManifestRecovery } from "./manifest";
import { createPaceState, registerAttempt, type PaceState } from "./pace";
import type { CollectStopReason } from "./types";
import {
  assertRefetchAllowed,
  buildSeriesPlan,
  buildSeriesRun,
  classifySetOutcome,
  createSeriesProgress,
  finalizeSeries,
  formatSeriesPlan,
  formatSeriesSummary,
  haltSeries,
  isSetComplete,
  markRobotsCheck,
  markSet,
  nextStep,
  notStartedSets,
  parseSetCodes,
} from "./series";

/** robots가 404인 정상 상태의 pace. 요청 예산만 바꿔 가며 쓴다. */
function paceWith(maxRequests: number, used = 0, status: number | null = 200): PaceState {
  let state = createPaceState({ maxRequests, robotsStatus: 404 });
  for (let i = 0; i < used; i += 1) {
    state = registerAttempt(state, { status });
  }
  return state;
}

const found = (lastPageIndex: number | null): ManifestRecovery => ({ found: true, lastPageIndex });
const notFound: ManifestRecovery = { found: false };

describe("series — ⓛ-1 대상 세트 목록 확정", () => {
  it("1. 쉼표로 나열한 세트를 입력 순서 그대로 돌려준다(공백은 흘린다)", () => {
    expect(parseSetCodes("OPK-01, OPK-02,OPK-03")).toEqual(["OPK-01", "OPK-02", "OPK-03"]);
  });

  it("2. 중복을 제거하되 입력 순서를 보존한다 — 첫 등장 자리를 지킨다", () => {
    // 🚨 정렬하면 ⓕ(코드가 재정렬하지 않는다)를 깨고, 중단 시 무엇이 남는지
    // 사람이 예측할 수 없게 된다.
    expect(parseSetCodes("OPK-02,OPK-01,OPK-02")).toEqual(["OPK-02", "OPK-01"]);
  });

  it("3. 형식 위반은 거부한다 — 조용히 흘리면 예산만 먹고 0장이 된다", () => {
    expect(() => parseSetCodes("opk-01")).toThrow();
    expect(() => parseSetCodes("OPK 01")).toThrow();
    expect(() => parseSetCodes("OPK-1")).toThrow();
    expect(() => parseSetCodes("【프로모션】")).toThrow();
  });

  it("4. 예약 코드 PROMO를 허용한다 (§4.10 ⓔ)", () => {
    expect(parseSetCodes("PROMO")).toEqual(["PROMO"]);
    expect(parseSetCodes("OPK-14,PROMO")).toEqual(["OPK-14", "PROMO"]);
  });

  it("5. 빈 목록을 거부한다", () => {
    expect(() => parseSetCodes("")).toThrow();
    expect(() => parseSetCodes("  ")).toThrow();
    expect(() => parseSetCodes(",,")).toThrow();
  });
});

describe("series — ⓛ-2′ --refetch 범위 (§4.10 ⓑ · T1.24 ⓖ-5)", () => {
  it("6. 세트가 2개 이상이면 --refetch를 거부한다. 1개면 허용한다", () => {
    expect(() => assertRefetchAllowed(["OPK-01", "OPK-02"], true)).toThrow();
    expect(() => assertRefetchAllowed(["OPK-01", "OPK-02"], false)).not.toThrow();
    expect(() => assertRefetchAllowed(["OPK-01"], true)).not.toThrow();
  });
});

describe("series — ⓛ-3 이어받기 판정 isSetComplete", () => {
  it("7. 0..lastPageIndex가 전부 있으면 완료다 — 요청 0회로 건너뛴다", () => {
    expect(isSetComplete(new Set([0, 1, 2]), found(2))).toBe(true);
    // lastPageIndex === null은 「1페이지짜리로 확정」이다. page 0만 있으면 완료.
    expect(isSetComplete(new Set([0]), found(null))).toBe(true);
  });

  it("8. 페이지에 구멍이 있으면 완료가 아니다", () => {
    expect(isSetComplete(new Set([0, 2]), found(2))).toBe(false);
    expect(isSetComplete(new Set([]), found(null))).toBe(false);
  });

  it("9. 🚨 lastPageIndex를 모르면(매니페스트 복구 실패) 완료로 보지 않는다", () => {
    // found:false를 「1페이지짜리(null)」와 섞으면 구멍 뚫린 세트가 완료로
    // 읽힌다 — manifest.ts가 found 플래그를 둔 이유가 그대로 여기에 걸린다.
    expect(isSetComplete(new Set([0, 1, 2, 3]), notFound)).toBe(false);
  });
});

describe("series — classifySetOutcome (세트 종료 사유 → 계열 분류)", () => {
  // 🚨 reviewer 발견 1 — 이 매핑이 scripts/collect-catalog.ts에 삼항식으로
  // 하드코딩돼 있었다. CollectStopReason 9개 전량을 여기서 개별로 고정한다
  // — 이 프로젝트가 "판단이 scripts/에 있어 테스트가 안 붙었다"로 결함을
  // 다섯 번 낸 자리와 정확히 같은 모양이었다(§4.10 ⓖ).
  it.each<[CollectStopReason, "done" | "partial" | "failed"]>([
    ["completed", "done"],
    ["max_requests", "partial"],
    ["consecutive_failures", "failed"],
    ["forbidden", "failed"],
    ["rate_limited", "failed"],
    ["robots_changed", "failed"],
    ["parser_zero_rows", "failed"],
    ["set_not_found", "failed"],
    ["page_zero_unavailable", "failed"],
  ])("%s → %s", (stoppedBy, expected) => {
    expect(classifySetOutcome(stoppedBy)).toBe(expected);
  });
});

describe("series — haltSeries", () => {
  it("먼저 세워진 사유가 이긴다 — 나중 호출로 덮어쓰지 않는다", () => {
    let progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    progress = haltSeries(progress, "forbidden");
    progress = haltSeries(progress, "rate_limited");
    expect(progress.halted).toBe("forbidden");
  });

  it("아직 멈추지 않았으면 사유를 세운다", () => {
    const progress = createSeriesProgress(["OPK-01"]);
    expect(haltSeries(progress, "robots_changed").halted).toBe("robots_changed");
  });
});

describe("series — ⓛ-2 진행 상태 전이", () => {
  it("10. 다음 대상은 입력 순서의 첫 미처리 세트다", () => {
    const progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    const step = nextStep(progress, paceWith(100));
    expect(step).toEqual({ kind: "collect", setCode: "OPK-01", needsRobotsCheck: false });
  });

  it("11. 🚨 robots 재확인은 세트 경계마다. 계열의 첫 세트는 실행 시작 확인이 대신한다", () => {
    let progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    expect(nextStep(progress, paceWith(100))).toMatchObject({ needsRobotsCheck: false });

    progress = markSet(progress, "OPK-01", { status: "done", rowCount: 160, manifestFile: "m.json" });
    expect(nextStep(progress, paceWith(100))).toMatchObject({
      setCode: "OPK-02",
      needsRobotsCheck: true,
    });
  });

  it("12. 예산이 소진되면 max_requests로 멈춘다 — 다음 세트로 넘어가지 않는다", () => {
    const progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    expect(nextStep(progress, paceWith(2, 2))).toEqual({ kind: "stop", reason: "max_requests" });
  });

  it("13. 🚨 403·429는 계열 전체를 멈추고 남은 세트는 전부 「미착수」다", () => {
    // PaceState가 프로세스당 1개라(§4.10 ⓐ) 403이 세트 경계에서 리셋되지 않는다.
    let progress = createSeriesProgress(["OPK-01", "OPK-02", "OPK-03"]);
    progress = markSet(progress, "OPK-01", { status: "done", rowCount: 160, manifestFile: "m.json" });

    const halted = registerAttempt(paceWith(100), { status: 403 });
    const step = nextStep(progress, halted);
    expect(step).toEqual({ kind: "stop", reason: "forbidden" });

    const final = finalizeSeries(progress);
    expect(notStartedSets(final)).toEqual(["OPK-02", "OPK-03"]);
  });

  it("14. 미완(partial)과 미착수(not_started)를 갈라 분류한다", () => {
    let progress = createSeriesProgress(["OPK-01", "OPK-02", "OPK-03"]);
    progress = markSet(progress, "OPK-01", { status: "done", rowCount: 160, manifestFile: "a.json" });
    progress = markSet(progress, "OPK-02", {
      status: "partial",
      rowCount: 40,
      manifestFile: "b.json",
      stoppedBy: "max_requests",
    });
    const final = finalizeSeries(progress);

    expect(final.sets.map((s) => s.status)).toEqual(["done", "partial", "not_started"]);
    expect(notStartedSets(final)).toEqual(["OPK-03"]);
  });

  it("15. 🚨 세트 하나가 실패하면 계열이 멈춘다 — 조용히 다음으로 넘어가지 않는다 (ⓘ-2)", () => {
    // T1.16 결함 2의 교훈. 40개 중 하나가 빠진 카탈로그가 「완주」로 보고되면
    // 사람이 그 구멍을 보지 못한다.
    let progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    progress = markSet(progress, "OPK-01", {
      status: "failed",
      rowCount: 0,
      manifestFile: "a.json",
      stoppedBy: "page_zero_unavailable",
    });
    expect(nextStep(progress, paceWith(100))).toEqual({
      kind: "stop",
      reason: "page_zero_unavailable",
    });
  });

  it("16. 🚨 건너뛴 세트는 경계를 만들지 않는다 — 만들면 「요청 0회」가 말뿐이 된다", () => {
    let progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    progress = markSet(progress, "OPK-01", { status: "skipped_complete", rowCount: 0, manifestFile: null });
    // 앞 세트를 요청 0회로 건너뛰었으므로 시간도 요청도 지나가지 않았다.
    // 여기서 robots를 다시 받으면 건너뛴 세트마다 요청 1건이 나간다.
    expect(nextStep(progress, paceWith(100))).toEqual({
      kind: "collect",
      setCode: "OPK-02",
      needsRobotsCheck: false,
    });
  });

  it("17. 상한 밖 robots 요청 수를 따로 센다 — 숨기지 않는다 (§4.10 ⓑ)", () => {
    let progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    progress = markRobotsCheck(progress);
    progress = markRobotsCheck(progress);
    expect(progress.robotsChecks).toBe(2);
  });
});

describe("series — ⓛ-4 계획 · 요약 · 계열 매니페스트 조립", () => {
  const plan = buildSeriesPlan({
    setCodes: ["OPK-01", "OPK-02", "OPK-03"],
    completed: ["OPK-02"],
    maxRequests: 10,
    knownLastPageIndex: new Map([["OPK-03", 1]]),
    delayMs: 3000,
    jitterMs: 1000,
  });

  it("18. 예상 요청 수 = 셀렉터 1 + 세트별 페이지 수. 아는 값은 쓰고 모르면 크게 잡는다", () => {
    // OPK-02는 건너뛰므로 0. OPK-03은 lastPageIndex 1을 알고 있어 2페이지.
    // OPK-01은 미지 → 보수적 기본값.
    expect(plan.skipped).toEqual(["OPK-02"]);
    expect(plan.targets).toEqual(["OPK-01", "OPK-03"]);
    expect(plan.estimatedRequests).toBe(1 + 8 + 2);
    expect(plan.robotsChecks).toBe(2);
  });

  it("18b. 받을 세트가 하나도 없으면 예상 요청 수는 0이다 — 셀렉터도 보내지 않는다", () => {
    const nothing = buildSeriesPlan({
      setCodes: ["OPK-14"],
      completed: ["OPK-14"],
      maxRequests: 12,
      delayMs: 3000,
      jitterMs: 1000,
    });
    expect(nothing.targets).toEqual([]);
    expect(nothing.estimatedRequests).toBe(0);
    expect(nothing.robotsChecks).toBe(0);
  });

  it("19. 🚨 상한에 걸리면 어느 세트에서 멈추는지 계산한다", () => {
    // 상한 10 = 셀렉터 1 + OPK-01 8페이지 → 9. OPK-03에서 예산이 끊긴다.
    expect(plan.stopsAt).toBe("OPK-03");
    const roomy = buildSeriesPlan({
      setCodes: ["OPK-01"],
      completed: [],
      maxRequests: 100,
      delayMs: 3000,
      jitterMs: 1000,
    });
    expect(roomy.stopsAt).toBeNull();
  });

  it("20. 🚨 계획 문자열이 「추정」임을 밝힌다 — 사람이 확정값으로 읽으면 안 된다", () => {
    const text = formatSeriesPlan(plan, 10);
    expect(text).toContain("추정");
    expect(text).toContain("OPK-01");
    expect(text).toContain("OPK-02"); // 건너뛸 세트도 보여 준다
    expect(text).toContain("10"); // --max-requests 값
  });

  it("21. 🚨 미완 요약 마지막 줄이 완주와 다르다 — 종료 코드가 같기 때문이다 (ⓙ)", () => {
    let progress = createSeriesProgress(["OPK-01", "OPK-02", "OPK-03"]);
    progress = markSet(progress, "OPK-01", { status: "done", rowCount: 160, manifestFile: "a.json" });
    progress = finalizeSeries(progress);

    const line = formatSeriesSummary(progress, "max_requests");
    expect(line).toContain("미완");
    expect(line).toContain("세트 3개 중 1개 완료");
    expect(line).toContain("OPK-02");
    expect(line).toContain("OPK-03");
  });

  it("22. 완주하면 미완 표기를 쓰지 않는다", () => {
    let progress = createSeriesProgress(["OPK-01"]);
    progress = markSet(progress, "OPK-01", { status: "done", rowCount: 160, manifestFile: "a.json" });
    progress = finalizeSeries(progress);

    const line = formatSeriesSummary(progress, "completed");
    expect(line).not.toContain("미완");
    expect(line).toContain("세트 1개 중 1개 완료");
  });

  it("23. 🚨 계열 매니페스트에 argv 원문 · 상한 밖 robots 수 · 미착수 목록이 들어간다 (ⓜ)", () => {
    let progress = createSeriesProgress(["OPK-01", "OPK-02"]);
    progress = markRobotsCheck(progress);
    progress = markSet(progress, "OPK-01", { status: "done", rowCount: 160, manifestFile: "manifest-x.json" });
    progress = finalizeSeries(progress);

    const run = buildSeriesRun({
      game: "opcg",
      argv: ["--sets", "OPK-01,OPK-02", "--max-requests", "20"],
      progress,
      pace: paceWith(20, 9),
      startedAt: "2026-08-29T00:00:00.000Z",
      finishedAt: "2026-08-29T00:30:00.000Z",
      stoppedBy: "max_requests",
    });

    expect(run.schemaVersion).toBe(1);
    expect(run.argv).toEqual(["--sets", "OPK-01,OPK-02", "--max-requests", "20"]);
    expect(run.targetSets).toEqual(["OPK-01", "OPK-02"]);
    expect(run.robotsChecks).toBe(1);
    expect(run.notStarted).toEqual(["OPK-02"]);
    expect(run.requestCount).toBe(9);
    expect(run.maxRequests).toBe(20);
    expect(run.stoppedBy).toBe("max_requests");
  });

  it("24. 🚨 계열 매니페스트는 세트 매니페스트를 대체하지 않는다 — 파일명으로 가리킬 뿐이다", () => {
    let progress = createSeriesProgress(["OPK-01"]);
    progress = markSet(progress, "OPK-01", { status: "done", rowCount: 160, manifestFile: "manifest-x.json" });
    progress = finalizeSeries(progress);

    const run = buildSeriesRun({
      game: "opcg",
      argv: [],
      progress,
      pace: paceWith(20, 9),
      startedAt: "2026-08-29T00:00:00.000Z",
      finishedAt: "2026-08-29T00:30:00.000Z",
      stoppedBy: "completed",
    });

    expect(run.sets[0]).toEqual({
      setCode: "OPK-01",
      status: "done",
      manifestFile: "manifest-x.json",
      rowCount: 160,
      stoppedBy: null,
    });
    // 요청 전량(requests)은 세트 매니페스트 쪽에 있다. 여기에 복제하지 않는다.
    expect(run).not.toHaveProperty("requests");
  });
});
