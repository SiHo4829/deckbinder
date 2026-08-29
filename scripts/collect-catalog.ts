/**
 * 카드 카탈로그 수집기 진입점 — T1.16 + **T1.24 계열 확장** (plan §4.8 ⓚ-5 · §4.10).
 *
 * 인자 파싱 · fetch · 파일 I/O · 잠들기 · 매니페스트 쓰기만 한다.
 * **판단하지 않는다** — 멈출지 말지는 `src/lib/catalog/pace.ts`에, 다음에 어느
 * 세트를 볼지·무엇을 건너뛸지·무엇을 실패로 셀지는 `src/lib/catalog/series.ts`에
 * 묻고, 마크업 해석은 `src/lib/catalog/parse.ts`에 맡긴다.
 *
 * 실행:
 *   단일  npm run catalog:collect -- --game opcg-kr --set OPK-14 --max-requests 12
 *   계열  npm run catalog:collect -- --game opcg-kr --sets OPK-01,…,OPK-14 --max-requests 120
 *
 * 🚨 **`--max-requests`는 계열 전체의 총 상한이다. 세트당 상한이 아니다**
 * (§4.10 ⓐ). 세트당으로 두면 사람이 승인한 숫자와 상대가 받는 요청 수가
 * 세트 수만큼 달라지고, 그것이 T1.16 결함 1과 같은 형태의 사고다.
 *
 * 🚨 이 파일은 `vitest`의 `include`(`src/**\/*.{test,spec}.{ts,tsx}`)가
 * 닿지 않는다 — 판단이 들어가는 로직은 전부 `src/lib/catalog/`로 올렸다
 * (plan §4.8 ⓒ · §4.10 ⓖ). 여기 남은 것은 배선뿐이다.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

import type { CollectedCard, CollectRequestLog, CollectRun, CollectStopReason } from "@/lib/catalog/types";
import {
  assertNonEmpty,
  PARSER_VERSION,
  parseCardListPage,
  resolveSetLabel,
  type SetOption,
} from "@/lib/catalog/parse";
import {
  latestManifestFilename,
  recoverFromManifest,
  type ManifestRecovery,
} from "@/lib/catalog/manifest";
import {
  canAfford,
  createPaceState,
  isRetryable,
  nextDelayMs,
  registerAttempt,
  registerUrlOutcome,
  retryBackoffMs,
  shouldContinue,
  type PaceState,
} from "@/lib/catalog/pace";
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
  parseSetCodes,
  type SeriesProgress,
} from "@/lib/catalog/series";
import { CATALOG_ORIGIN } from "@/lib/validation/catalog";

/** 관측값. 임의로 키우지 않는다 — `--size` 인자를 만들지 않는다(plan §4.8 ⓔ · T1.24 ⓖ-6). */
const PAGE_SIZE = 20;

/** 3초 미만이면 거부한다 — 인자가 규율을 깎는 통로가 되지 않게(ⓚ-5). */
const MIN_DELAY_MS = 3000;

/** robots.txt가 404가 아니면 원천이 처음으로 말을 한 것이다(plan §4.8 ⓔ). */
const ROBOTS_OK_STATUS = 404;

interface Args {
  readonly game: string;
  /** 대상 세트 — **입력 순서 그대로**. 단일 실행은 길이 1이다(§4.10 ⓕ). */
  readonly sets: readonly string[];
  readonly maxRequests: number;
  readonly delayMs: number;
  readonly jitterMs: number;
  readonly refetch: boolean;
  readonly contact: string | null;
  readonly outDir: string;
}

function readArgValue(argv: readonly string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) {
    return undefined;
  }
  return argv[idx + 1];
}

function parseArgs(argv: readonly string[]): Args {
  const game = readArgValue(argv, "--game");
  const set = readArgValue(argv, "--set");
  const sets = readArgValue(argv, "--sets");
  const maxRequestsRaw = readArgValue(argv, "--max-requests");
  const delayMsRaw = readArgValue(argv, "--delay-ms");
  const jitterMsRaw = readArgValue(argv, "--jitter-ms");
  const contact = readArgValue(argv, "--contact") ?? null;
  const outDir = readArgValue(argv, "--out") ?? "data";
  const refetch = argv.includes("--refetch");

  if (!game) {
    throw new Error("--game이 필요하다.");
  }
  // 대상 지정은 **한 자리**여야 한다 — 둘이 공존하면 「어느 것이 이겼는가」라는
  // 상태가 생기고, 그것이 §4.10 ⓔ가 `--promo`를 기각한 이유와 같은 형태다.
  if (set && sets) {
    throw new Error("--set과 --sets를 함께 쓰지 않는다. 대상 지정은 한 자리다.");
  }
  if (!set && !sets) {
    throw new Error("--set 또는 --sets가 필요하다.");
  }
  // 🚨 접두사 확장(`--series OPK`)을 만들지 않는다 — 원천이 OPK-15를 추가하는
  // 날 같은 명령이 다른 범위를 수집한다(§4.10 ⓒ · T1.24 ⓓ).
  const setCodes = parseSetCodes(sets ?? (set as string));

  // 🚨 기본값을 두지 않는다 — 없으면 시작을 거부한다(plan §4.8 ⓔ).
  if (!maxRequestsRaw) {
    throw new Error("--max-requests가 필요하다. 기본값은 없다 — 수집 범위는 사람이 승인한다(plan §4.8 ⓔ).");
  }
  const maxRequests = Number(maxRequestsRaw);
  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new Error("--max-requests는 양의 정수여야 한다.");
  }

  const delayMs = delayMsRaw ? Number(delayMsRaw) : MIN_DELAY_MS;
  if (!Number.isFinite(delayMs) || delayMs < MIN_DELAY_MS) {
    throw new Error(`--delay-ms는 ${MIN_DELAY_MS} 미만일 수 없다.`);
  }

  const jitterMs = jitterMsRaw ? Number(jitterMsRaw) : 1000;
  if (!Number.isFinite(jitterMs) || jitterMs < 0) {
    throw new Error("--jitter-ms는 0 이상이어야 한다.");
  }

  assertRefetchAllowed(setCodes, refetch);

  return { game, sets: setCodes, maxRequests, delayMs, jitterMs, refetch, contact, outDir };
}

function userAgentFor(contact: string | null): string {
  return contact ? `DeckBinder-CatalogBot/0.1 (${contact})` : "DeckBinder-CatalogBot/0.1";
}

/** `<stamp> = 20260828T091234Z` (UTC · basic format · Windows 파일명 제약 때문에 `:` 없음). */
function stampUtc(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Of(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

/** 화이트리스트를 「검사」가 아니라 「유일한 출처」로 둔다(plan §4.8 ⓚ-5 실행 순서 2). */
function catalogUrl(pathAndQuery: string): URL {
  return new URL(pathAndQuery, CATALOG_ORIGIN);
}

interface FetchAttempt {
  readonly status: number | null;
  readonly text: string;
  readonly durationMs: number;
}

async function fetchOnce(url: URL, userAgent: string): Promise<FetchAttempt> {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, "Accept-Language": "ko" },
      redirect: "manual",
    });
    const text = await res.text();
    return { status: res.status, text, durationMs: Date.now() - startedAt };
  } catch {
    return { status: null, text: "", durationMs: Date.now() - startedAt };
  }
}

interface FetchWithRetryResult {
  readonly result: FetchAttempt;
  /** 시도마다 `registerAttempt`로 갱신된 최신 pace 상태. */
  readonly pace: PaceState;
}

/**
 * 재시도까지 포함해 URL 1개를 받는다. 5xx·타임아웃만 재시도한다(최대 2회,
 * 백오프 10초→30초). 403·429는 즉시 포기한다 — 호출부가 `pace.ts`로 판단한다.
 * 시도 전량을 `requests`에 남긴다(ⓚ-2 — 요약하지 않는다).
 *
 * 🚨 리뷰 결함 1 수정 지점 — **시도마다** `registerAttempt`로 `requestCount`를
 * 늘리고, **재시도를 보내기 전에도** `canAfford`로 예산을 확인한다. 상한을
 * 넘길 시도를 애초에 보내지 않는다 — 넘긴 뒤 사후에 아는 것이 아니다.
 * `consecutiveFailures`(URL 단위)는 여기서 건드리지 않는다 — 호출부가
 * 반환된 `result` 하나를 보고 `registerUrlOutcome`을 정확히 한 번 부른다.
 */
async function fetchWithRetry(
  url: URL,
  userAgent: string,
  requests: CollectRequestLog[],
  rowsOf: (text: string) => number | null,
  pace: PaceState,
): Promise<FetchWithRetryResult> {
  let attempt = 1;
  let currentPace = pace;
  let last: FetchAttempt | null = null;

  for (;;) {
    if (!canAfford(currentPace)) {
      // 호출부가 첫 시도 전에 이미 canAfford를 확인하므로 여기서 last가
      // null인 채 들어오는 일은 없다 — 방어적으로만 남겨 둔다.
      return { result: last ?? { status: null, text: "", durationMs: 0 }, pace: currentPace };
    }

    const startedAt = new Date().toISOString();
    const result = await fetchOnce(url, userAgent);
    currentPace = registerAttempt(currentPace, { status: result.status });
    requests.push({
      url: url.toString(),
      startedAt,
      status: result.status,
      durationMs: result.durationMs,
      rows: rowsOf(result.text),
      attempt,
    });
    last = result;

    if (result.status !== null && (result.status === 200 || !isRetryable(result.status))) {
      return { result, pace: currentPace };
    }
    if (result.status === null && !isRetryable(result.status)) {
      return { result, pace: currentPace }; // 도달하지 않는다 — null은 항상 재시도 대상이다. 방어적으로 남겨 둔다.
    }

    const backoff = retryBackoffMs(attempt);
    if (backoff === null) {
      return { result, pace: currentPace }; // 재시도 소진 — 실패로 반환하고 호출부가 URL 단위 연속 실패로 센다.
    }
    await sleep(backoff);
    attempt += 1;
  }
}

function readExistingPages(jsonlPath: string): Set<number> {
  const pages = new Set<number>();
  if (!existsSync(jsonlPath)) {
    return pages;
  }
  const text = readFileSync(jsonlPath, "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = JSON.parse(trimmed) as CollectedCard;
    pages.add(row.page);
  }
  return pages;
}

/**
 * 세트 디렉터리에서 가장 최근 매니페스트를 찾아 `lastPageIndex`를 복구한다.
 * I/O(파일 목록 읽기 · JSON 파싱)만 한다 — 「최신인가 · 유효한가」의 판단은
 * `src/lib/catalog/manifest.ts`에 있다(리뷰 결함 2).
 */
function recoverLastPageIndexFromManifest(setDir: string): ManifestRecovery {
  let filenames: string[];
  try {
    filenames = readdirSync(setDir);
  } catch {
    return { found: false };
  }
  const latest = latestManifestFilename(filenames);
  if (latest === null) {
    return { found: false };
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(setDir, latest), "utf-8"));
    return recoverFromManifest(parsed);
  } catch {
    return { found: false };
  }
}

/**
 * 세트 하나의 로컬 상태를 요청 0회로 읽는다 — 계획 출력(ⓔ)과 건너뛰기
 * 판정(ⓘ-1) 둘 다 이것을 쓴다. **판단하지 않는다**: 「완주했는가」는
 * `series.isSetComplete`가 정한다.
 */
interface LocalSetState {
  readonly existingPages: Set<number>;
  readonly recovery: ManifestRecovery;
  /** JSONL의 실제 행 수. **페이지 수가 아니다** — 매니페스트에 그대로 실린다. */
  readonly rowCount: number;
}

function inspectSetLocally(setDir: string, refetch: boolean): LocalSetState {
  if (refetch) {
    // 다시 받기로 한 세트는 로컬 상태를 없는 것으로 본다 — 아래에서 JSONL을
    // 백업으로 밀어내기 때문이다.
    return { existingPages: new Set<number>(), recovery: { found: false }, rowCount: 0 };
  }
  const jsonlPath = join(setDir, "cards.jsonl");
  return {
    existingPages: readExistingPages(jsonlPath),
    recovery: recoverLastPageIndexFromManifest(setDir),
    rowCount: countJsonlRows(jsonlPath),
  };
}

/** JSONL 행 수. 건너뛴 세트의 `rowCount`가 페이지 수로 잘못 기록되지 않게 한다. */
function countJsonlRows(jsonlPath: string): number {
  if (!existsSync(jsonlPath)) {
    return 0;
  }
  return readFileSync(jsonlPath, "utf-8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "").length;
}

function writeManifest(run: CollectRun, dir: string, stamp: string): string {
  const filename = `manifest-${stamp}.json`;
  const manifestPath = join(dir, filename);
  writeFileSync(manifestPath, JSON.stringify(run, null, 2), "utf-8");
  console.log(`매니페스트: ${manifestPath}`);
  return filename;
}

// ─── 세트 하나 수집 ────────────────────────────────────────────────────────

interface CollectSetParams {
  readonly args: Args;
  readonly setCode: string;
  readonly userAgent: string;
  readonly stamp: string;
  readonly startedAt: Date;
  readonly pace: PaceState;
  readonly robotsStatus: number;
  readonly selectorOptions: readonly SetOption[];
  /** 이 세트의 매니페스트에 함께 실을, 세트 전에 보낸 요청들(초기 robots · 셀렉터 · 경계 robots). */
  readonly carriedRequests: readonly CollectRequestLog[];
}

interface CollectSetResult {
  readonly stoppedBy: CollectStopReason;
  readonly rowCount: number;
  readonly manifestFile: string;
  readonly pace: PaceState;
}

/**
 * 세트 하나를 받는다. T1.16이 확정한 실행 순서 그대로다 — 계열 확장이
 * 바꾼 것은 **이 함수를 몇 번 부르는가와 `pace`를 누가 소유하는가**뿐이다
 * (`PaceState`는 프로세스당 1개 · §4.10 ⓐ · T1.24 ⓑ).
 */
async function collectSet(params: CollectSetParams): Promise<CollectSetResult> {
  const { args, setCode, userAgent, stamp, startedAt, selectorOptions, robotsStatus } = params;
  let pace = params.pace;
  const requests: CollectRequestLog[] = [...params.carriedRequests];

  const setDir = join(args.outDir, "catalog", args.game, setCode);
  mkdirSync(setDir, { recursive: true });
  const jsonlPath = join(setDir, "cards.jsonl");

  if (args.refetch && existsSync(jsonlPath)) {
    renameSync(jsonlPath, `${jsonlPath}.bak-${stamp}`);
  }

  let rowCount = 0;

  const finish = (
    stoppedBy: CollectStopReason,
    extra: { sourceSetLabel: string; lastPageIndex: number | null },
  ): CollectSetResult => {
    const outFileText = existsSync(jsonlPath) ? readFileSync(jsonlPath, "utf-8") : "";
    const robotsUrlString = catalogUrl("/robots.txt").toString();
    const collectRequests = requests.filter((r) => r.url !== robotsUrlString);
    const run: CollectRun = {
      schemaVersion: 1,
      parserVersion: PARSER_VERSION,
      game: args.game,
      sourceSetCode: setCode,
      sourceSetLabel: extra.sourceSetLabel,
      host: catalogUrl("/").host,
      userAgent,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      robots: { url: robotsUrlString, status: robotsStatus, checkedAt: startedAt.toISOString() },
      pageSize: PAGE_SIZE,
      lastPageIndex: extra.lastPageIndex,
      requests,
      // robots.txt는 상한에도 실패 수에도 세지 않는다(plan §4.8 ⓔ). 그 404는
      // 정상 응답이므로, 실패로 세면 매니페스트가 매 실행 실패 1건을 보고하고
      // 「진짜 실패 1건」과 구분되지 않는다 — 매니페스트는 부하 규율을 지켰다는
      // 것을 증명하는 유일한 기록이라(§4.8 ⓓ) 그 값이 흐려지면 안 된다.
      requestCount: collectRequests.length,
      maxRequests: args.maxRequests,
      failureCount: collectRequests.filter((r) => r.status === null || r.status >= 400).length,
      rowCount,
      outFile: jsonlPath,
      outFileSha256: sha256Of(outFileText),
      stoppedBy,
    };
    const manifestFile = writeManifest(run, setDir, stamp);
    return { stoppedBy, rowCount, manifestFile, pace };
  };

  // 라벨 해석 — 셀렉터 응답은 계열당 1회만 받고 프로세스 안에서만 캐시한다(ⓗ).
  let sourceSetLabel: string;
  try {
    sourceSetLabel = resolveSetLabel(selectorOptions, setCode);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    // 결함 4 — 라벨 해석 실패는 네트워크 연속 실패가 아니다. 인자·원천
    // 불일치이므로 별도 사유로 갈랐다(오분류는 사후 감사를 흐린다, §4.8 ⓓ).
    return finish("set_not_found", { sourceSetLabel: "", lastPageIndex: null });
  }

  const seriesParam = encodeURIComponent(sourceSetLabel);
  const pageUrl = (page: number) =>
    catalogUrl(
      `/cardlist.do?page=${page}&size=${PAGE_SIZE}&freewords=&categories=&illustrations=&colors=&blockIcons=&series=${seriesParam}`,
    );

  const existingPages = readExistingPages(jsonlPath);
  let lastPageIndex: number | null = null;
  // 결함 2 — 「page=0을 확정했는가」를 lastPageIndex(number | null)만으로는
  // 표현할 수 없다. null이 「알아냈고 1페이지짜리다」인지 「아직 모른다」인지
  // 갈라지지 않으면 완주한 1페이지 세트도 미완주와 구분되지 않는다.
  let pageZeroResolved = false;

  const appendRows = async (rows: readonly CollectedCard[]): Promise<void> => {
    if (rows.length === 0) return;
    const lines = rows.map((r) => `${JSON.stringify(r)}\n`).join("");
    await appendFile(jsonlPath, lines, "utf-8");
    rowCount += rows.length;
  };

  // page=0 확정 — 이미 받았으면 매니페스트의 lastPageIndex를 쓴다(재실행
  // 복구). 매니페스트가 없거나 못 믿으면 page=0을 한 번 다시 받는다 —
  // 규율 위반이 아니라 기록을 잃었을 때의 허용된 복구 비용이다.
  if (existingPages.has(0)) {
    const recovered = recoverLastPageIndexFromManifest(setDir);
    if (recovered.found) {
      lastPageIndex = recovered.lastPageIndex;
      pageZeroResolved = true;
    }
  }

  if (!pageZeroResolved) {
    const decision = shouldContinue(pace);
    if (decision.stop || !canAfford(pace)) {
      return finish(decision.reason ?? "max_requests", { sourceSetLabel, lastPageIndex: null });
    }

    // 결함 3 — 연속한 모든 요청 쌍 사이에 지연을 넣는다. §4.8 ⓔ의 「요청
    // 간격」은 단계를 한정하지 않고, 세트 경계도 예외가 아니다(T1.24 ⓖ-4).
    await sleep(nextDelayMs(args.delayMs, args.jitterMs));

    const page0Fetch = await fetchWithRetry(
      pageUrl(0),
      userAgent,
      requests,
      (text) => {
        try {
          return parseCardListPage(text, 0).cards.length;
        } catch {
          return null;
        }
      },
      pace,
    );
    pace = page0Fetch.pace;
    const page0 = page0Fetch.result;
    const parsed = page0.status === 200 ? parseCardListPage(page0.text, 0) : null;
    if (parsed) {
      assertNonEmpty(parsed, 0, PAGE_SIZE);
      lastPageIndex = parsed.lastPageIndex;
      pageZeroResolved = true;
      // 이미 JSONL에 있던 page=0(매니페스트 복구 실패로 다시 받은 경우)은
      // lastPageIndex를 얻으려고 다시 받았을 뿐이다 — 행을 중복 기록하지 않는다.
      if (!existingPages.has(0)) {
        await appendRows(parsed.cards);
      }
    }
    pace = registerUrlOutcome(pace, {
      ok: page0.status === 200,
      parsedRows: parsed ? parsed.cards.length : null,
    });
  }

  const decisionAfterPage0 = shouldContinue(pace);
  if (decisionAfterPage0.stop) {
    return finish(decisionAfterPage0.reason ?? "max_requests", {
      sourceSetLabel,
      lastPageIndex: pageZeroResolved ? lastPageIndex : null,
    });
  }

  // 결함 2 — 어떤 경로로도(직접 요청도, 매니페스트 복구도) page=0을
  // 확정하지 못한 채 "completed"로 조용히 끝나지 않는다. 그 상태는 실패다.
  // 🚨 계열에서는 여기가 계열 전체를 멈추는 자리가 된다(§4.10 ⓓ · T1.24 ⓘ-2).
  if (!pageZeroResolved) {
    return finish("page_zero_unavailable", { sourceSetLabel, lastPageIndex: null });
  }

  if (lastPageIndex !== null) {
    const remainingNeeded = lastPageIndex + 1 - existingPages.size;
    if (remainingNeeded > 0 && !canAfford(pace, remainingNeeded)) {
      console.warn(
        `경고: [${setCode}] 전체를 받으려면 요청 ${remainingNeeded}회가 더 필요한데 예산이 ` +
          `${pace.maxRequests - pace.requestCount}회 남았다. 상한까지만 받고 나머지는 다음 실행이 이어받는다.`,
      );
    }
  }

  // page=1..last 순회. lastPageIndex === null은 1페이지짜리 세트로
  // 확정된 상태다(pageZeroResolved === true) — 완주로 끝난다.
  let stoppedBy: CollectStopReason = "completed";
  if (lastPageIndex !== null) {
    for (let page = 1; page <= lastPageIndex; page += 1) {
      const decision = shouldContinue(pace);
      if (decision.stop) {
        stoppedBy = decision.reason ?? "max_requests";
        break;
      }
      if (existingPages.has(page)) {
        continue;
      }
      if (!canAfford(pace)) {
        stoppedBy = "max_requests";
        break;
      }

      await sleep(nextDelayMs(args.delayMs, args.jitterMs));

      const attemptFetch = await fetchWithRetry(
        pageUrl(page),
        userAgent,
        requests,
        (text) => {
          try {
            return parseCardListPage(text, page).cards.length;
          } catch {
            return null;
          }
        },
        pace,
      );
      pace = attemptFetch.pace;
      const attempt = attemptFetch.result;

      let parsedRows: number | null = null;
      if (attempt.status === 200) {
        const parsed = parseCardListPage(attempt.text, page);
        assertNonEmpty(parsed, page, PAGE_SIZE);
        parsedRows = parsed.cards.length;
        await appendRows(parsed.cards);
      }

      pace = registerUrlOutcome(pace, { ok: attempt.status === 200, parsedRows });
    }
  }

  return finish(stoppedBy, { sourceSetLabel, lastPageIndex });
}

// ─── 계열 실행 ─────────────────────────────────────────────────────────────

/** robots.txt 1회. **상한에 세지 않는다** — 규율을 지키려는 요청이다(§4.10 ⓑ). */
async function fetchRobots(
  userAgent: string,
  requests: CollectRequestLog[],
): Promise<FetchAttempt> {
  const robotsUrl = catalogUrl("/robots.txt");
  const startedAt = new Date().toISOString();
  const robots = await fetchOnce(robotsUrl, userAgent);
  requests.push({
    url: robotsUrl.toString(),
    startedAt,
    status: robots.status,
    durationMs: robots.durationMs,
    rows: null,
    attempt: 1,
  });
  return robots;
}

function writeSeriesManifest(
  args: Args,
  progress: SeriesProgress,
  pace: PaceState,
  stoppedBy: CollectStopReason,
  startedAt: Date,
  stamp: string,
): void {
  const run = buildSeriesRun({
    game: args.game,
    argv: process.argv.slice(2),
    progress,
    pace,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    stoppedBy,
  });
  const runsDir = join(args.outDir, "catalog", args.game, "_runs");
  mkdirSync(runsDir, { recursive: true });
  const path = join(runsDir, `series-${stamp}.json`);
  writeFileSync(path, JSON.stringify(run, null, 2), "utf-8");
  console.log(`계열 매니페스트: ${path}`);
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const args = parseArgs(process.argv.slice(2));
  const userAgent = userAgentFor(args.contact);
  const stamp = stampUtc(startedAt);

  // 1. 🚨 첫 네트워크 요청 **전에** 계획을 낸다 — 요청 0회로(T1.24 ⓔ).
  //    별도 승인 관문은 만들지 않는다. 승인이 코드에 들어오는 자리는
  //    --max-requests 하나뿐이다(§4.10 ⓒ).
  const localState = new Map(
    args.sets.map((setCode) => [
      setCode,
      inspectSetLocally(join(args.outDir, "catalog", args.game, setCode), args.refetch),
    ]),
  );
  const completed = args.sets.filter((setCode) => {
    const state = localState.get(setCode);
    return state !== undefined && isSetComplete(state.existingPages, state.recovery);
  });
  const knownLastPageIndex = new Map<string, number | null>();
  for (const [setCode, state] of localState) {
    if (state.recovery.found) {
      knownLastPageIndex.set(setCode, state.recovery.lastPageIndex);
    }
  }
  console.log(
    formatSeriesPlan(
      buildSeriesPlan({
        setCodes: args.sets,
        completed,
        maxRequests: args.maxRequests,
        knownLastPageIndex,
        delayMs: args.delayMs,
        jitterMs: args.jitterMs,
      }),
      args.maxRequests,
    ),
  );
  console.log("");

  let progress = createSeriesProgress(args.sets);

  // 🚨 받을 것이 하나도 없으면 **요청을 0회 보내고 끝낸다.** robots도 셀렉터도
  //    받지 않는다 — 「한 번 받은 것을 다시 받지 않는다」(§0.1 ⓓ ⓒ)는 목록
  //    페이지에만 걸리는 규율이 아니다.
  if (completed.length === args.sets.length) {
    for (const setCode of args.sets) {
      progress = markSet(progress, setCode, {
        status: "skipped_complete",
        rowCount: localState.get(setCode)?.rowCount ?? 0,
        manifestFile: null,
      });
    }
    progress = finalizeSeries(progress);
    const idlePace = createPaceState({ maxRequests: args.maxRequests, robotsStatus: ROBOTS_OK_STATUS });
    writeSeriesManifest(args, progress, idlePace, "completed", startedAt, stamp);
    console.log("대상 세트가 전부 이미 완주 상태다 — 네트워크 요청 0회로 끝낸다.");
    console.log(formatSeriesSummary(progress, "completed"));
    return;
  }

  // 2. robots.txt 사전 확인 — 상태 코드로만 판정한다(본문을 보지 않는다).
  const sharedRequests: CollectRequestLog[] = [];
  const robots = await fetchRobots(userAgent, sharedRequests);
  // 실행 시작 확인도 「상한 밖 robots 요청」이다. 세지 않으면 매니페스트의
  // 숫자가 계획이 낸 숫자보다 하나 작아지고, 그 어긋남이 §4.10 ⓑ가 「숨기지
  // 않는다」고 적은 값을 흐린다.
  progress = markRobotsCheck(progress);
  let robotsStatus = robots.status ?? -1;
  if (robots.status !== ROBOTS_OK_STATUS) {
    console.error(`robots.txt가 404가 아니다 (status=${robots.status ?? "network error"}). 사람이 읽는다 — 중단.`);
    progress = finalizeSeries(haltSeries(progress, "robots_changed"));
    const pace = createPaceState({ maxRequests: args.maxRequests, robotsStatus });
    writeSeriesManifest(args, progress, pace, "robots_changed", startedAt, stamp);
    console.log(formatSeriesSummary(progress, "robots_changed"));
    process.exitCode = 1;
    return;
  }

  // 🚨 PaceState는 프로세스당 정확히 1개다(§4.10 ⓐ · T1.24 ⓑ). 세트마다 새로
  //    만들면 연속 실패 카운터가 세트 경계에서 리셋되고, 상한이 세트 수만큼
  //    곱해진다 — ⓐ가 기각한 그 곱셈이다.
  let pace: PaceState = createPaceState({ maxRequests: args.maxRequests, robotsStatus });

  // 결함 3 — robots.txt 직후에도 다음 요청(셀렉터)을 바로 보내지 않는다.
  await sleep(nextDelayMs(args.delayMs, args.jitterMs));

  // 3. 셀렉터 해석 요청 — **계열당 1회.** 프로세스 안에서만 캐시하고 파일로
  //    저장하지 않는다(T1.24 ⓗ). 이 응답의 카드 행은 버린다 — 우리가 요청한
  //    세트가 아니다.
  const selectorUrl = catalogUrl(
    `/cardlist.do?page=0&size=${PAGE_SIZE}&freewords=&categories=&illustrations=&colors=&blockIcons=&series=`,
  );
  const selectorFetch = await fetchWithRetry(selectorUrl, userAgent, sharedRequests, () => null, pace);
  pace = selectorFetch.pace;
  const selectorAttempt = selectorFetch.result;
  pace = registerUrlOutcome(pace, { ok: selectorAttempt.status === 200 });
  let selectorOptions: readonly SetOption[] = [];
  if (selectorAttempt.status === 200) {
    selectorOptions = parseCardListPage(selectorAttempt.text, 0).setOptions;
  }

  // 4. 계열 순회. 「다음에 무엇을 할 것인가」는 전부 series.ts가 정한다.
  let carried: CollectRequestLog[] = sharedRequests;
  let stoppedBy: CollectStopReason = "completed";

  for (;;) {
    const step = nextStep(progress, pace);
    if (step.kind === "stop") {
      stoppedBy = step.reason;
      break;
    }

    // ⓘ-1 — 이미 완주한 세트는 **요청 0회로** 건너뛴다.
    //
    // 🚨 경계 robots보다 **먼저** 판정한다. 뒤에 두면 건너뛰는 세트마다
    // robots 요청 1건이 나가고, 그 순간 「요청 0회」가 말뿐이 된다.
    const setDir = join(args.outDir, "catalog", args.game, step.setCode);
    const local = inspectSetLocally(setDir, args.refetch);
    if (isSetComplete(local.existingPages, local.recovery)) {
      console.log(`[${step.setCode}] 이미 완주 — 요청 0회로 건너뛴다.`);
      progress = markSet(progress, step.setCode, {
        status: "skipped_complete",
        rowCount: local.rowCount,
        manifestFile: null,
      });
      continue;
    }

    // ⓖ-1 — 세트 경계마다 robots를 다시 받는다. 계열의 첫 세트는 실행 시작
    // 확인이 대신한다. 이 확인의 목적은 부하 규율이 아니라 §4.4.1 되돌릴
    // 조건 1의 자동 감지기이고, 감지기의 값은 감지까지 걸리는 시간이 정한다.
    if (step.needsRobotsCheck) {
      await sleep(nextDelayMs(args.delayMs, args.jitterMs)); // ⓖ-4 — 세트 경계도 예외가 아니다.
      const boundary = await fetchRobots(userAgent, carried);
      progress = markRobotsCheck(progress);
      robotsStatus = boundary.status ?? -1;
      if (boundary.status !== ROBOTS_OK_STATUS) {
        console.error(
          `robots.txt가 404가 아니다 (status=${boundary.status ?? "network error"}) — 세트 경계 확인에서 발견. 계열 전체 중단.`,
        );
        progress = haltSeries(progress, "robots_changed");
        stoppedBy = "robots_changed";
        break;
      }
    }

    console.log(`\n── [${step.setCode}] 수집 시작 (누적 요청 ${pace.requestCount}/${pace.maxRequests}) ──`);
    const result = await collectSet({
      args,
      setCode: step.setCode,
      userAgent,
      stamp,
      startedAt,
      pace,
      robotsStatus,
      selectorOptions,
      carriedRequests: carried,
    });
    pace = result.pace;
    carried = []; // 공유 요청은 첫 세트 매니페스트에만 싣는다 — 복제하지 않는다.

    // 세트의 종료 사유를 계열의 분류로 옮긴다. **판단은 classifySetOutcome
    // (series.ts)이 한다** — 여기서는 그 결과를 markSet에 전달만 한다.
    progress = markSet(progress, step.setCode, {
      status: classifySetOutcome(result.stoppedBy),
      rowCount: result.rowCount,
      manifestFile: result.manifestFile,
      stoppedBy: result.stoppedBy === "completed" ? null : result.stoppedBy,
    });
  }

  progress = finalizeSeries(progress);
  writeSeriesManifest(args, progress, pace, stoppedBy, startedAt, stamp);

  // 🚨 마지막 줄 — 상한 도달과 완주는 종료 코드가 같으므로(둘 다 0) 이 줄이
  //    유일한 구분이다(T1.24 ⓙ).
  console.log(formatSeriesSummary(progress, stoppedBy));

  const ok = stoppedBy === "completed" || stoppedBy === "max_requests";
  process.exitCode = ok ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exitCode = 1;
});
