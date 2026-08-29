/**
 * 계열 단위 수집의 **판단** — plan §4.10 · T1.24 완료 기준 ⓛ.
 *
 * 39번 실행을 4번으로 줄이면서 §4.8 ⓔ의 승인 장치를 무력화하지 않는 것이
 * 이 모듈이 지키는 것 전부다. 새로 생기는 판단 넷이 여기 있다:
 * ⓛ-1 대상 세트 목록 확정 · ⓛ-2 진행 상태 전이 · ⓛ-3 이어받기 판정 ·
 * ⓛ-4 예상 요청 수·계획·계열 매니페스트 조립.
 *
 * 🚨 **순수하다. I/O가 0건이다** — 파일 목록 나열 · `readFileSync` ·
 * 매니페스트 쓰기 · `sleep`은 `scripts/collect-catalog.ts`의 일이다(ⓛ-5).
 * 이 경계를 어겨 이 프로젝트가 결함을 다섯 번 냈고 전부 테스트가 안 붙는
 * 자리였다(§4.10 ⓖ).
 *
 * 🚨 **`pace.ts`를 고치지 않는다**(ⓒ). 여기서는 읽기만 한다 — `PaceState`는
 * 프로세스당 1개이고, 연속 실패도 403도 세트 경계에서 리셋되지 않는다는
 * 규율이 「고치지 않는다」에서 그대로 따라 나온다(§4.10 ⓐ · ⓑ).
 */

import type { ManifestRecovery } from "./manifest";
import { PROMO_SET_CODE } from "./parse";
import { canAfford, shouldContinue, type PaceState } from "./pace";
import type {
  CollectStopReason,
  SeriesRun,
  SeriesSetOutcome,
  SeriesSetStatus,
} from "./types";

/**
 * 세트 코드 형식. 실측 41개 옵션 중 39개가 `[영문-두자리숫자]` 형태다
 * (§4.8 ⓙ-10). ⚠️ **카드 `code` 정규식이 아니다**(ⓚ-4가 금지한 것) — 이것은
 * 사람이 CLI에 친 인자의 형식 검증이고, 어긋나면 예산만 먹고 0장이 된다.
 */
const SET_CODE_PATTERN = /^[A-Z]{2,5}-\d{2,3}$/;

/**
 * `lastPageIndex`를 모르는 세트의 페이지 수 가정. **관측이 아니라 원칙이다** —
 * §4.10 ⓕ의 「모르면 크게 잡는다」. 실측 2점(`OPK-14` 8페이지 · `STK-28`
 * 1페이지) 중 큰 쪽을 쓴다.
 *
 * 🚨 크게 잡아 빗나가면 **예산이 남은 채 끝난다**(안전). 작게 잡아 빗나가면
 * 상한에 걸려 끊기는데 그것도 안전하다 — 다음 실행이 요청 0회로 이어받는다.
 */
export const ASSUMED_PAGES_PER_SET = 8;

// ─── ⓛ-1 대상 세트 목록 확정 ───────────────────────────────────────────────

/**
 * `--sets` 원문을 세트 코드 목록으로 확정한다.
 *
 * 🚨 **정렬하지 않는다.** 중복을 지울 때도 **첫 등장 자리**를 지킨다 — 코드가
 * 재정렬하면 사람이 승인한 목록과 실행 순서가 달라지고, 상한에 걸려 끊길 때
 * 「무엇이 남았는가」를 사람이 계산해야 한다(§4.10 ⓒ).
 */
export function parseSetCodes(raw: string): readonly string[] {
  const seen = new Set<string>();
  const codes: string[] = [];

  for (const piece of raw.split(",")) {
    const code = piece.trim();
    if (code === "") {
      continue;
    }
    if (code !== PROMO_SET_CODE && !SET_CODE_PATTERN.test(code)) {
      throw new Error(
        `세트 코드 "${code}"의 형식이 맞지 않는다. ` +
          `"OPK-14" 형태이거나 예약 코드 "${PROMO_SET_CODE}"여야 한다.`,
      );
    }
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);
    codes.push(code);
  }

  if (codes.length === 0) {
    throw new Error("대상 세트가 없다. --sets에 최소 한 개를 적는다 — 기본값은 없다.");
  }
  return codes;
}

/**
 * `--refetch`의 범위를 막는다 (§4.10 ⓑ · T1.24 ⓖ-5).
 *
 * 재수집은 **세트 단위 판단**이다. 계열에 걸면 이미 받은 세트를 통째로 다시
 * 받는데, 상한 안이더라도 「한 번 받은 것을 다시 받지 않는다」(§0.1 ⓓ ⓒ)를
 * 대량으로 깨는 것이다. 다시 받아야 하면 그 세트만 단독으로 돌린다.
 */
export function assertRefetchAllowed(setCodes: readonly string[], refetch: boolean): void {
  if (refetch && setCodes.length > 1) {
    throw new Error(
      "--refetch는 세트가 1개일 때만 쓴다. 계열에 걸면 이미 받은 세트를 통째로 다시 받는다 — " +
        "다시 받아야 하는 세트만 단독으로 돌린다(plan §4.10 ⓑ).",
    );
  }
}

// ─── ⓛ-3 이어받기 판정 ─────────────────────────────────────────────────────

/**
 * 이 세트를 **요청 0회로 건너뛰어도 되는가**.
 *
 * 🚨 둘째 인자가 `number | null`이 아니라 `ManifestRecovery`인 이유 —
 * `null`은 「1페이지짜리로 확정」이라는 **유효한 값**이고 「모른다」와 다르다.
 * 섞이면 구멍 뚫린 세트가 완료로 읽히고, 그것이 §4.10 ⓓ가 「합성되지 않는
 * 조각」이라 부른 자리다. `manifest.ts`가 `found` 플래그를 둔 이유가 그대로
 * 여기에 걸린다.
 */
export function isSetComplete(
  existingPages: ReadonlySet<number>,
  recovery: ManifestRecovery,
): boolean {
  if (!recovery.found) {
    return false;
  }
  const last = recovery.lastPageIndex ?? 0;
  for (let page = 0; page <= last; page += 1) {
    if (!existingPages.has(page)) {
      return false;
    }
  }
  return true;
}

// ─── ⓛ-2 진행 상태 전이 ────────────────────────────────────────────────────

export interface SeriesSetState {
  readonly setCode: string;
  readonly status: SeriesSetStatus;
  readonly manifestFile: string | null;
  readonly rowCount: number;
  readonly stoppedBy: CollectStopReason | null;
}

export interface SeriesProgress {
  readonly sets: readonly SeriesSetState[];
  /** 🚨 상한 **밖** robots 요청 수. 별도 항목으로 남긴다(§4.10 ⓑ). */
  readonly robotsChecks: number;
  /** 세트 하나의 실패가 계열을 멈춘 사유. 세워지면 취소되지 않는다(ⓘ-2). */
  readonly halted: CollectStopReason | null;
}

export function createSeriesProgress(setCodes: readonly string[]): SeriesProgress {
  return {
    sets: setCodes.map((setCode) => ({
      setCode,
      status: "pending" as const,
      manifestFile: null,
      rowCount: 0,
      stoppedBy: null,
    })),
    robotsChecks: 0,
    halted: null,
  };
}

export type SeriesNextStep =
  | { readonly kind: "collect"; readonly setCode: string; readonly needsRobotsCheck: boolean }
  | { readonly kind: "stop"; readonly reason: CollectStopReason };

/**
 * 다음에 무엇을 할 것인가. **한 자리에서만 정한다** — `scripts/`가 스스로
 * 정하면 T1.16 결함 2(조용한 완주)가 계열 규모로 재현된다(§4.10 ⓖ).
 *
 * 판정 순서에 뜻이 있다: **계열이 이미 멈췄는가 → 부하 규율이 멈추라는가 →
 * 남은 세트가 있는가.** 규율이 목록보다 앞선다.
 */
export function nextStep(progress: SeriesProgress, pace: PaceState): SeriesNextStep {
  if (progress.halted !== null) {
    return { kind: "stop", reason: progress.halted };
  }

  const decision = shouldContinue(pace);
  if (decision.stop) {
    return { kind: "stop", reason: decision.reason ?? "max_requests" };
  }
  if (!canAfford(pace)) {
    return { kind: "stop", reason: "max_requests" };
  }

  const index = progress.sets.findIndex((s) => s.status === "pending");
  if (index === -1) {
    return { kind: "stop", reason: "completed" };
  }

  // ⓖ-1 — 세트 경계마다 1회. 계열의 **첫** 세트는 실행 시작 확인이 대신하므로
  // 중복하지 않는다.
  //
  // 🚨 「경계」는 **앞에서 실제로 받은 세트가 있다**는 뜻이다. 요청 0회로
  // 건너뛴 세트는 경계를 만들지 않는다 — 시간도 요청도 지나가지 않았으므로
  // 다시 확인할 것이 없고, 세면 ⓘ-1의 「요청 0회로 건너뛴다」가 깨진다.
  const collectedBefore = progress.sets.some(
    (s) => s.status === "done" || s.status === "partial" || s.status === "failed",
  );

  return {
    kind: "collect",
    setCode: progress.sets[index].setCode,
    needsRobotsCheck: collectedBefore,
  };
}

/**
 * 세트 하나의 종료 사유(`CollectStopReason`, 9개 값)를 계열의 분류로 옮긴다.
 *
 * 🚨 **이 매핑 자체가 판단이다** — `"failed"`가 되는 순간 `markSet`을 거쳐
 * 계열 전체가 멈춘다(ⓘ-2). `scripts/`가 이 판단을 직접 하면 T1.16이 이미
 * 겪은 실패(판단이 `scripts/`에 있어 테스트가 안 붙었다, §4.10 ⓖ)가
 * 그대로 재현된다 — 실제로 한 번 그렇게 만들었다가 리뷰에서 고쳤다.
 *
 * `completed` 하나만 성공, `max_requests`(승인된 예산의 정상 소진)만
 * 재시작 가능한 `partial`이고, 나머지 일곱은 전부 `failed`다 — 계열은
 * 「이 세트만의 문제인가 우리 전체의 문제인가」를 구분할 수 없고, 구분
 * 못 하는 것을 낙관적으로 가정하지 않는다(§4.10 ⓑ).
 */
export function classifySetOutcome(
  stoppedBy: CollectStopReason,
): Exclude<SeriesSetStatus, "pending" | "skipped_complete" | "not_started"> {
  if (stoppedBy === "completed") {
    return "done";
  }
  if (stoppedBy === "max_requests") {
    return "partial";
  }
  return "failed";
}

export interface SetOutcomeInput {
  readonly status: Exclude<SeriesSetStatus, "pending" | "not_started">;
  readonly rowCount: number;
  readonly manifestFile: string | null;
  readonly stoppedBy?: CollectStopReason | null;
}

/**
 * 세트 하나의 결과를 반영한다.
 *
 * 🚨 `failed`는 계열을 멈춘다(ⓘ-2). 한 세트의 망가진 기록이 계열 전체를
 * 멈추는 대가는 받아들인다 — **비싼 것은 구멍이지 재시작이 아니다.** 이미
 * 받은 세트는 다음 실행에서 요청 0회로 건너뛴다.
 */
export function markSet(
  progress: SeriesProgress,
  setCode: string,
  outcome: SetOutcomeInput,
): SeriesProgress {
  const sets = progress.sets.map((s) =>
    s.setCode === setCode
      ? {
          setCode: s.setCode,
          status: outcome.status,
          manifestFile: outcome.manifestFile,
          rowCount: outcome.rowCount,
          stoppedBy: outcome.stoppedBy ?? null,
        }
      : s,
  );

  const halted =
    progress.halted ??
    (outcome.status === "failed" ? (outcome.stoppedBy ?? "page_zero_unavailable") : null);

  return { ...progress, sets, halted };
}

/** 상한 밖 robots 요청 1건을 센다. 세는 것 자체가 규율이다(§4.10 ⓑ). */
export function markRobotsCheck(progress: SeriesProgress): SeriesProgress {
  return { ...progress, robotsChecks: progress.robotsChecks + 1 };
}

/** robots가 404가 아니었다 등, 계열 전체를 멈추는 사유를 세운다. */
export function haltSeries(progress: SeriesProgress, reason: CollectStopReason): SeriesProgress {
  return { ...progress, halted: progress.halted ?? reason };
}

/**
 * 실행이 끝났다. 🚨 **차례가 오지 않은 세트를 `not_started`로 확정한다** —
 * `pending`인 채로 기록되면 「받다 말았다」와 「한 번도 시도되지 않았다」가
 * 구분되지 않는다(§4.10 ⓑ · ⓓ).
 */
export function finalizeSeries(progress: SeriesProgress): SeriesProgress {
  return {
    ...progress,
    sets: progress.sets.map((s) => (s.status === "pending" ? { ...s, status: "not_started" as const } : s)),
  };
}

export function notStartedSets(progress: SeriesProgress): readonly string[] {
  return progress.sets
    .filter((s) => s.status === "not_started" || s.status === "pending")
    .map((s) => s.setCode);
}

/** 「완료」로 셀 수 있는 것 — 이번에 완주했거나 이미 완주해 건너뛴 세트. */
export function completedCount(progress: SeriesProgress): number {
  return progress.sets.filter((s) => s.status === "done" || s.status === "skipped_complete").length;
}

// ─── ⓛ-4 계획 · 요약 · 계열 매니페스트 조립 ────────────────────────────────

export interface SeriesPlanInput {
  readonly setCodes: readonly string[];
  /** 이미 완주해 요청 0회로 건너뛸 세트. */
  readonly completed: readonly string[];
  readonly maxRequests: number;
  /** 매니페스트에서 복구한 세트별 `lastPageIndex`. 없으면 가정값을 쓴다. */
  readonly knownLastPageIndex?: ReadonlyMap<string, number | null>;
  readonly delayMs: number;
  readonly jitterMs: number;
}

export interface SeriesPlan {
  readonly targets: readonly string[];
  readonly skipped: readonly string[];
  /** 🚨 **추정이다.** 실측은 2점뿐이다(§4.10 ⓕ). */
  readonly estimatedRequests: number;
  /** 상한에 걸리면 멈추는 세트. 여유가 있으면 `null`. */
  readonly stopsAt: string | null;
  readonly estimatedDurationMs: number;
  /**
   * 상한 밖 robots 요청 예상 수 = **실행 시작 1회 + 세트 경계마다 1회**.
   * 실제로 받을 세트가 N개면 N회다(건너뛸 세트는 경계를 만들지 않는다).
   */
  readonly robotsChecks: number;
}

function pagesFor(setCode: string, known?: ReadonlyMap<string, number | null>): number {
  if (known?.has(setCode)) {
    const last = known.get(setCode) ?? 0;
    return last + 1;
  }
  return ASSUMED_PAGES_PER_SET;
}

/**
 * 첫 네트워크 요청 **전에** 낼 계획을 계산한다 — 요청 0회로(T1.24 ⓔ).
 *
 * ⚠️ **별도 승인 관문은 아니다.** 승인이 코드에 들어오는 자리는
 * `--max-requests` 하나뿐이고, 두 자리로 갈라지면 어느 쪽이 진짜인지
 * 흐려진다(§4.10 ⓒ). 이 계획은 사람이 **읽는** 것이다.
 */
export function buildSeriesPlan(input: SeriesPlanInput): SeriesPlan {
  const completed = new Set(input.completed);
  const skipped = input.setCodes.filter((c) => completed.has(c));
  const targets = input.setCodes.filter((c) => !completed.has(c));

  // 셀렉터 해석 요청 1회(계열당 1회 · ⓗ). 🚨 받을 세트가 하나도 없으면 그
  // 1회도 보내지 않는다 — 「한 번 받은 것을 다시 받지 않는다」(§0.1 ⓓ ⓒ)는
  // 목록 페이지에만 걸리는 규율이 아니다.
  let running = targets.length === 0 ? 0 : 1;
  let stopsAt: string | null = null;
  for (const setCode of targets) {
    running += pagesFor(setCode, input.knownLastPageIndex);
    if (stopsAt === null && running > input.maxRequests) {
      stopsAt = setCode;
    }
  }

  const robotsChecks = targets.length;
  const requestsThatWait = Math.min(running, input.maxRequests) + robotsChecks;

  return {
    targets,
    skipped,
    estimatedRequests: running,
    stopsAt,
    // 요청 사이마다 delay + 지터의 기댓값(지터의 평균은 절반)만큼 잠든다.
    estimatedDurationMs: requestsThatWait * (input.delayMs + input.jitterMs / 2),
    robotsChecks,
  };
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes < 1 ? "1분 미만" : `약 ${minutes}분`;
}

/**
 * 계획을 사람이 읽는 문자열로 만든다.
 *
 * 🚨 **「추정」을 반드시 밝힌다.** 실측은 `OPK-14` 8페이지와 `STK-28`
 * 1페이지 두 점뿐이고, 나머지는 「모르면 크게 잡는다」로 채운 값이다 —
 * 사람이 확정값으로 읽으면 이 문서가 갈라 적은 것이 무의미해진다(§4.10 ⓕ).
 */
export function formatSeriesPlan(plan: SeriesPlan, maxRequests: number): string {
  const lines: string[] = [];
  lines.push("── 수집 계획 (네트워크 요청 0회로 계산했다) ──");
  lines.push(`대상 세트 ${plan.targets.length}개 (입력 순서 그대로): ${plan.targets.join(", ") || "없음"}`);
  lines.push(
    plan.skipped.length > 0
      ? `건너뛸 세트 ${plan.skipped.length}개 (이미 완주 · 요청 0회): ${plan.skipped.join(", ")}`
      : "건너뛸 세트: 없음",
  );
  lines.push(
    `예상 요청 수: ${plan.estimatedRequests}회 — 🚨 추정이다. ` +
      `실측은 2세트뿐이고 나머지는 세트당 ${ASSUMED_PAGES_PER_SET}페이지로 크게 잡았다(plan §4.10 ⓕ).`,
  );
  lines.push(`상한(--max-requests): ${maxRequests}회`);
  lines.push(
    plan.stopsAt === null
      ? "상한 안에서 전 세트를 받을 것으로 추정된다. (추정이 작았으면 상한에서 끊기고 다음 실행이 이어받는다)"
      : `🚨 상한에 걸리면 "${plan.stopsAt}"에서 멈춘다. 남은 세트는 「미착수」로 기록되고 다음 실행이 요청 0회로 이어받는다.`,
  );
  lines.push(
    `상한 밖 robots.txt 요청: ${plan.robotsChecks}회 ` +
      "(실행 시작 1회 + 세트 경계마다 1회 · 상한에 세지 않는다 · plan §4.10 ⓑ)",
  );
  lines.push(`예상 소요 시간: ${formatDuration(plan.estimatedDurationMs)} (추정)`);
  return lines.join("\n");
}

/**
 * 실행의 **마지막 줄**. 🚨 상한 도달과 완주는 종료 코드가 같으므로(둘 다 0)
 * 이 줄이 유일한 구분이다 — 세트가 하나일 때는 사람이 알아챘지만 40개일
 * 때는 종료 코드만 보고 끝났다고 읽는다(§4.10 ⓕ · T1.24 ⓙ).
 */
export function formatSeriesSummary(
  progress: SeriesProgress,
  stoppedBy: CollectStopReason,
): string {
  const total = progress.sets.length;
  const done = completedCount(progress);
  const head = `세트 ${total}개 중 ${done}개 완료`;

  if (stoppedBy === "completed" && done === total) {
    return `완주 — ${head}`;
  }

  const remaining = progress.sets
    .filter((s) => s.status !== "done" && s.status !== "skipped_complete")
    .map((s) => s.setCode);
  return `미완 (${stoppedBy}) — ${head} · 남은 세트: ${remaining.join(", ")}`;
}

export interface SeriesRunInput {
  readonly game: string;
  readonly argv: readonly string[];
  readonly progress: SeriesProgress;
  readonly pace: PaceState;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly stoppedBy: CollectStopReason;
}

/**
 * 계열 매니페스트를 조립한다.
 *
 * 🚨 **집계는 여기서 한다.** T1.16 결함 1이 정확히 이 모양이었다 — 「무엇을
 * 실패로 세는가」가 배선이 아니라 판단인데 `scripts/`에 있어서 테스트가 안
 * 붙었다(§4.10 ⓖ). `scripts/`는 이 객체를 **쓰기만** 한다.
 *
 * ⚠️ **요청 전량(`requests`)을 담지 않는다.** 그것은 세트 매니페스트에 있고
 * 여기서는 파일명으로 가리킬 뿐이다 — 요약이 원본을 대신하면 §4.8 ⓙ가 겪은
 * 실패가 반복된다(§4.10 ⓓ).
 */
export function buildSeriesRun(input: SeriesRunInput): SeriesRun {
  const sets: readonly SeriesSetOutcome[] = input.progress.sets.map((s) => ({
    setCode: s.setCode,
    status: s.status,
    manifestFile: s.manifestFile,
    rowCount: s.rowCount,
    stoppedBy: s.stoppedBy,
  }));

  return {
    schemaVersion: 1,
    game: input.game,
    argv: [...input.argv],
    targetSets: input.progress.sets.map((s) => s.setCode),
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    sets,
    requestCount: input.pace.requestCount,
    maxRequests: input.pace.maxRequests,
    robotsChecks: input.progress.robotsChecks,
    notStarted: notStartedSets(input.progress),
    stoppedBy: input.stoppedBy,
  };
}
