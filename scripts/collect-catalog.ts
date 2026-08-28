/**
 * 카드 카탈로그 수집기 진입점 — T1.16 (plan §4.8 ⓚ-5).
 *
 * 인자 파싱 · fetch · 파일 I/O · 잠들기 · 매니페스트 쓰기만 한다.
 * **판단하지 않는다** — 멈출지 말지는 `src/lib/catalog/pace.ts`에 묻고,
 * 마크업 해석은 `src/lib/catalog/parse.ts`에 맡긴다.
 *
 * 실행: npm run catalog:collect -- --game <code> --set <OPK-14> --max-requests <n>
 *
 * 🚨 이 파일은 `vitest`의 `include`(`src/**\/*.{test,spec}.{ts,tsx}`)가
 * 닿지 않는다 — 판단이 들어가는 로직은 전부 `src/lib/catalog/`로 올렸다
 * (plan §4.8 ⓒ). 여기 남은 것은 배선뿐이다.
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
import { latestManifestFilename, recoverFromManifest } from "@/lib/catalog/manifest";
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
import { CATALOG_ORIGIN } from "@/lib/validation/catalog";

/** 관측값. 임의로 키우지 않는다 — `--size` 인자를 만들지 않는다(plan §4.8 ⓔ). */
const PAGE_SIZE = 20;

/** 3초 미만이면 거부한다 — 인자가 규율을 깎는 통로가 되지 않게(ⓚ-5). */
const MIN_DELAY_MS = 3000;

interface Args {
  readonly game: string;
  readonly set: string;
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
  const maxRequestsRaw = readArgValue(argv, "--max-requests");
  const delayMsRaw = readArgValue(argv, "--delay-ms");
  const jitterMsRaw = readArgValue(argv, "--jitter-ms");
  const contact = readArgValue(argv, "--contact") ?? null;
  const outDir = readArgValue(argv, "--out") ?? "data";
  const refetch = argv.includes("--refetch");

  if (!game) {
    throw new Error("--game이 필요하다.");
  }
  if (!set) {
    throw new Error("--set이 필요하다.");
  }
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

  return { game, set, maxRequests, delayMs, jitterMs, refetch, contact, outDir };
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
function recoverLastPageIndexFromManifest(setDir: string): { found: boolean; lastPageIndex: number | null } {
  let filenames: string[];
  try {
    filenames = readdirSync(setDir);
  } catch {
    return { found: false, lastPageIndex: null };
  }
  const latest = latestManifestFilename(filenames);
  if (latest === null) {
    return { found: false, lastPageIndex: null };
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(setDir, latest), "utf-8"));
    const recovery = recoverFromManifest(parsed);
    return recovery.found ? { found: true, lastPageIndex: recovery.lastPageIndex } : { found: false, lastPageIndex: null };
  } catch {
    return { found: false, lastPageIndex: null };
  }
}

async function writeManifest(run: CollectRun, dir: string, stamp: string): Promise<void> {
  const manifestPath = join(dir, `manifest-${stamp}.json`);
  writeFileSync(manifestPath, JSON.stringify(run, null, 2), "utf-8");
  console.log(`매니페스트: ${manifestPath}`);
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const args = parseArgs(process.argv.slice(2));
  const userAgent = userAgentFor(args.contact);
  const stamp = stampUtc(startedAt);
  const requests: CollectRequestLog[] = [];

  const setDir = join(args.outDir, "catalog", args.game, args.set);
  mkdirSync(setDir, { recursive: true });
  const jsonlPath = join(setDir, "cards.jsonl");

  if (args.refetch && existsSync(jsonlPath)) {
    renameSync(jsonlPath, `${jsonlPath}.bak-${stamp}`);
  }

  const finish = async (
    stoppedBy: CollectStopReason,
    extra: { robotsStatus: number; sourceSetLabel: string; lastPageIndex: number | null; rowCount: number },
  ): Promise<number> => {
    const outFileText = existsSync(jsonlPath) ? readFileSync(jsonlPath, "utf-8") : "";
    const robotsUrlString = catalogUrl("/robots.txt").toString();
    const collectRequests = requests.filter((r) => r.url !== robotsUrlString);
    const run: CollectRun = {
      schemaVersion: 1,
      parserVersion: PARSER_VERSION,
      game: args.game,
      sourceSetCode: args.set,
      sourceSetLabel: extra.sourceSetLabel,
      host: catalogUrl("/").host,
      userAgent,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      robots: { url: catalogUrl("/robots.txt").toString(), status: extra.robotsStatus, checkedAt: startedAt.toISOString() },
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
      rowCount: extra.rowCount,
      outFile: jsonlPath,
      outFileSha256: sha256Of(outFileText),
      stoppedBy,
    };
    await writeManifest(run, setDir, stamp);
    const ok = stoppedBy === "completed" || stoppedBy === "max_requests";
    return ok ? 0 : 1;
  };

  // 1. robots.txt 사전 확인 — 상한에 세지 않는다. 상태 코드로만 판정한다(본문을 보지 않는다).
  const robotsUrl = catalogUrl("/robots.txt");
  const robotsStart = new Date().toISOString();
  const robots = await fetchOnce(robotsUrl, userAgent);
  requests.push({
    url: robotsUrl.toString(),
    startedAt: robotsStart,
    status: robots.status,
    durationMs: robots.durationMs,
    rows: null,
    attempt: 1,
  });
  if (robots.status !== 404) {
    console.error(`robots.txt가 404가 아니다 (status=${robots.status ?? "network error"}). 사람이 읽는다 — 중단.`);
    process.exitCode = await finish("robots_changed", {
      robotsStatus: robots.status ?? -1,
      sourceSetLabel: "",
      lastPageIndex: null,
      rowCount: 0,
    });
    return;
  }

  let pace: PaceState = createPaceState({ maxRequests: args.maxRequests, robotsStatus: robots.status });

  // 결함 3 — robots.txt 직후에도 사람이 브라우저로 훑는 것보다 빠르게 다음
  // 요청(셀렉터)을 보내지 않는다. §4.8 ⓔ의 「요청 간격」은 단계를 한정하지
  // 않는다 — 연속한 모든 요청 쌍 사이에 지연을 넣는다(첫 요청 앞은 예외).
  await sleep(nextDelayMs(args.delayMs, args.jitterMs));

  // 2. 셀렉터 해석 요청 1회. 이 응답의 카드 행은 버린다 — 우리가 요청한 세트가 아니다.
  const selectorUrl = catalogUrl(
    `/cardlist.do?page=0&size=${PAGE_SIZE}&freewords=&categories=&illustrations=&colors=&blockIcons=&series=`,
  );
  const selectorFetch = await fetchWithRetry(selectorUrl, userAgent, requests, () => null, pace);
  pace = selectorFetch.pace;
  const selectorAttempt = selectorFetch.result;
  pace = registerUrlOutcome(pace, { ok: selectorAttempt.status === 200 });
  let selectorOptions: readonly SetOption[] = [];
  if (selectorAttempt.status === 200) {
    selectorOptions = parseCardListPage(selectorAttempt.text, 0).setOptions;
  }

  let sourceSetLabel = "";
  {
    const decision = shouldContinue(pace);
    if (decision.stop) {
      process.exitCode = await finish(decision.reason ?? "consecutive_failures", {
        robotsStatus: robots.status,
        sourceSetLabel,
        lastPageIndex: null,
        rowCount: 0,
      });
      return;
    }
    try {
      sourceSetLabel = resolveSetLabel(selectorOptions, args.set);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      // 결함 4 — 라벨 해석 실패는 네트워크 연속 실패가 아니다. 인자·원천
      // 불일치이므로 별도 사유로 갈랐다(오분류는 사후 감사를 흐린다, §4.8 ⓓ).
      process.exitCode = await finish("set_not_found", {
        robotsStatus: robots.status,
        sourceSetLabel: "",
        lastPageIndex: null,
        rowCount: 0,
      });
      return;
    }
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
  let rowCount = 0;

  const appendRows = async (rows: readonly CollectedCard[]): Promise<void> => {
    if (rows.length === 0) return;
    const lines = rows.map((r) => `${JSON.stringify(r)}\n`).join("");
    await appendFile(jsonlPath, lines, "utf-8");
    rowCount += rows.length;
  };

  // 3. page=0 확정 — 이미 받았으면 매니페스트의 lastPageIndex를 쓴다(재실행
  //    복구, plan 1999행). 매니페스트가 없거나 못 믿으면 page=0을 한 번 다시
  //    받는다 — 규율 위반이 아니라 기록을 잃었을 때의 허용된 복구 비용이다.
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
      process.exitCode = await finish(decision.reason ?? "max_requests", {
        robotsStatus: robots.status,
        sourceSetLabel,
        lastPageIndex: null,
        rowCount,
      });
      return;
    }

    await sleep(nextDelayMs(args.delayMs, args.jitterMs)); // 결함 3 — 셀렉터 → page=0 사이 지연.

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
    process.exitCode = await finish(decisionAfterPage0.reason ?? "max_requests", {
      robotsStatus: robots.status,
      sourceSetLabel,
      lastPageIndex: pageZeroResolved ? lastPageIndex : null,
      rowCount,
    });
    return;
  }

  // 결함 2 — 어떤 경로로도(직접 요청도, 매니페스트 복구도) page=0을
  // 확정하지 못한 채 "completed"로 조용히 끝나지 않는다. 그 상태는 실패다.
  if (!pageZeroResolved) {
    process.exitCode = await finish("page_zero_unavailable", {
      robotsStatus: robots.status,
      sourceSetLabel,
      lastPageIndex: null,
      rowCount,
    });
    return;
  }

  if (lastPageIndex !== null) {
    const totalNeeded = 1 + lastPageIndex + 1; // 셀렉터 1 + page 0..last
    if (totalNeeded > args.maxRequests) {
      console.warn(
        `경고: 세트 전체를 받으려면 요청 ${totalNeeded}회가 필요한데 상한이 ${args.maxRequests}다. ` +
          "상한까지만 받고 나머지는 다음 실행이 이어받는다.",
      );
    }
  }

  // 4. page=1..last 순회. lastPageIndex === null은 1페이지짜리 세트로
  //    확정된 상태다(pageZeroResolved === true) — 완주로 끝난다.
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

  process.exitCode = await finish(stoppedBy, { robotsStatus: robots.status, sourceSetLabel, lastPageIndex, rowCount });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exitCode = 1;
});
