/**
 * 카드 이미지 수집기 진입점 — T1.20 (plan §9.4 ⓕ · §8 T1.20 ⓐ~ⓙ).
 *
 * 인자 파싱 · 파일 I/O · fetch · 잠들기 · webp 변환 · 매니페스트 쓰기만 한다.
 * **판단하지 않는다** — 무엇을 받고 무엇을 건너뛸지, 어느 호스트로 나가도
 * 되는지, 무엇을 실패로 셀지는 전부 `src/lib/catalog/images.ts`에 묻고, 멈출지
 * 말지는 `src/lib/catalog/pace.ts`에 묻는다.
 *
 * 실행:
 *   집계만  npm run images:collect -- --game opcg --sets OPK-14,PROMO
 *   수집    npm run images:collect -- --game opcg --set OPK-14 \
 *             --approve-host onepiece-cardgame.kr --max-requests 170
 *
 * 🚨 **`--approve-host`가 없으면 요청이 한 건도 나가지 않는다.** 그것이 실패가
 * 아니라 설계다(T1.20 ⓑ) — 기본 모드는 「집계해 보여주기」이고, 그 출력이 곧
 * 사람이 승인할 재료다(ⓑ-1 · 명세 9항목).
 *
 * 🚨 이 파일은 `vitest`의 `include`(`src/**\/*.{test,spec}.{ts,tsx}`)가 닿지
 * 않는다 — 판단이 들어가는 로직은 전부 `src/lib/catalog/`로 올렸다(§4.8 ⓒ).
 * 여기 남은 것은 배선뿐이다.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import sharp from "sharp";

import {
  backupRelPath,
  buildHostSurvey,
  buildImageRun,
  checkFinalHost,
  decideResponse,
  formatHostSurvey,
  originalRelPath,
  sniffImageFormat,
  IMAGE_DELAY_MS,
  IMAGE_JITTER_MS,
  MIN_IMAGE_DELAY_MS,
  nextImageDelayMs,
  planImageFetches,
  WEBP_PARAMS,
  type ImageFetchPlanItem,
  type ImageTarget,
} from "@/lib/catalog/images";
import {
  canAfford,
  createPaceState,
  registerAttempt,
  registerUrlOutcome,
  retryBackoffMs,
  shouldContinue,
  type PaceState,
} from "@/lib/catalog/pace";
import type {
  CollectedCard,
  CollectRun,
  ImageRequestLog,
  ImageStopReason,
} from "@/lib/catalog/types";

/** robots.txt가 404가 아니면 원천이 처음으로 말을 한 것이다(plan §4.8 ⓔ). */
const ROBOTS_OK_STATUS = 404;

/** 리다이렉트를 따라가는 최대 횟수. 체인을 무한히 따라가지 않는다. */
const MAX_REDIRECTS = 1;

/** 같은 URL 최대 2회 재시도 = 시도 3회(§4.8 ⓔ). */
const MAX_ATTEMPTS = 3;

interface Args {
  readonly game: string;
  readonly sets: readonly string[];
  /** 🚨 빈 배열 = 승인 없음 = 요청 0회. 이것이 기본값이다. */
  readonly approvedHosts: readonly string[];
  readonly maxRequests: number | null;
  readonly delayMs: number;
  readonly jitterMs: number;
  readonly refetch: boolean;
  readonly contact: string | null;
  readonly catalogDir: string;
  readonly outDir: string;
}

function readArgValue(argv: readonly string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) {
    return undefined;
  }
  return argv[idx + 1];
}

function readArgValues(argv: readonly string[], name: string): string[] {
  const values: string[] = [];
  argv.forEach((token, idx) => {
    if (token === name && argv[idx + 1]) {
      values.push(argv[idx + 1]);
    }
  });
  return values;
}

function parseArgs(argv: readonly string[]): Args {
  const game = readArgValue(argv, "--game");
  const set = readArgValue(argv, "--set");
  const sets = readArgValue(argv, "--sets");
  const maxRequestsRaw = readArgValue(argv, "--max-requests");
  const delayMsRaw = readArgValue(argv, "--delay-ms");
  const jitterMsRaw = readArgValue(argv, "--jitter-ms");
  const contact = readArgValue(argv, "--contact") ?? null;
  const catalogDir = readArgValue(argv, "--catalog-dir") ?? "data/catalog";
  const outDir = readArgValue(argv, "--out") ?? "data/images";
  const refetch = argv.includes("--refetch");
  const approvedHosts = readArgValues(argv, "--approve-host");

  if (!game) {
    throw new Error("--game이 필요하다.");
  }
  // 대상 지정은 **한 자리**여야 한다 — `collect-catalog.ts`와 같은 규칙이다.
  if (set && sets) {
    throw new Error("--set과 --sets를 함께 쓰지 않는다. 대상 지정은 한 자리다.");
  }

  const setCodes = (sets ?? set ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code !== "");

  // 🚨 `--max-requests`는 **승인이 있을 때만** 필수다. 집계 모드는 요청이 0회라
  // 상한을 물을 대상이 없다 — 그런데도 요구하면 사람이 승인 *전에* 숫자를
  // 지어내게 되고, 그 숫자가 곧 승인으로 읽힌다(§4.8 ⓔ).
  let maxRequests: number | null = null;
  if (approvedHosts.length > 0) {
    if (!maxRequestsRaw) {
      throw new Error(
        "--max-requests가 필요하다. 기본값은 없다 — 요청 범위는 사람이 승인한다(plan §4.8 ⓔ).",
      );
    }
    maxRequests = Number(maxRequestsRaw);
    if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
      throw new Error("--max-requests는 양의 정수여야 한다.");
    }
  }

  const delayMs = delayMsRaw ? Number(delayMsRaw) : IMAGE_DELAY_MS;
  if (!Number.isFinite(delayMs) || delayMs < MIN_IMAGE_DELAY_MS) {
    throw new Error(`--delay-ms는 ${MIN_IMAGE_DELAY_MS} 미만일 수 없다.`);
  }

  const jitterMs = jitterMsRaw ? Number(jitterMsRaw) : IMAGE_JITTER_MS;
  if (!Number.isFinite(jitterMs) || jitterMs < 0) {
    throw new Error("--jitter-ms는 0 이상이어야 한다.");
  }

  return {
    game,
    sets: setCodes,
    approvedHosts,
    maxRequests,
    delayMs,
    jitterMs,
    refetch,
    contact,
    catalogDir,
    outDir,
  };
}

function userAgentFor(contact: string | null): string {
  return contact ? `DeckBinder-CatalogBot/0.1 (${contact})` : "DeckBinder-CatalogBot/0.1";
}

/** `<stamp> = 20260830T091234Z` (UTC · Windows 파일명 제약 때문에 `:` 없음). */
function stampUtc(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 입력 읽기 (요청 0회) ──────────────────────────────────────────────────

interface SetInput {
  readonly setCode: string;
  readonly path: string;
  readonly rows: readonly CollectedCard[];
  /** 이 세트의 매니페스트에서 읽은 호스트. **절대화 base의 출처다**(명세 3). */
  readonly host: string | null;
}

function listSetDirs(catalogDir: string, game: string): string[] {
  const root = join(catalogDir, game);
  if (!existsSync(root)) {
    throw new Error(`입력 디렉토리가 없다: ${root}`);
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
}

/** 세트 디렉토리의 최신 매니페스트에서 `CollectRun.host`를 읽는다. */
function readManifestHost(dir: string): string | null {
  const files = readdirSync(dir)
    .filter((name) => name.startsWith("manifest-") && name.endsWith(".json"))
    .sort();
  const latest = files.at(-1);
  if (!latest) {
    return null;
  }
  try {
    const run = JSON.parse(readFileSync(join(dir, latest), "utf-8")) as CollectRun;
    return run.host ?? null;
  } catch {
    return null;
  }
}

function readSetInput(catalogDir: string, game: string, setCode: string): SetInput {
  const dir = join(catalogDir, game, setCode);
  const path = join(dir, "cards.jsonl");
  const rows = readFileSync(path, "utf-8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as CollectedCard);
  return { setCode, path, rows, host: readManifestHost(dir) };
}

/**
 * 절대화 base를 정한다.
 *
 * 🚨 **코드에 박은 상수를 쓰지 않는다.** base는 매니페스트의 `CollectRun.host`,
 * 즉 **우리가 실제로 목록을 받았던 호스트**에서만 온다(명세 3). 세트마다 호스트가
 * 다르면 그 사실 자체가 멈출 신호이므로 여기서 던진다.
 */
function resolveBase(inputs: readonly SetInput[]): { origin: string; source: string } {
  const hosts = [...new Set(inputs.map((input) => input.host).filter((host): host is string => host !== null))];
  if (hosts.length === 0) {
    throw new Error(
      "매니페스트에서 호스트를 읽지 못했다. base를 코드에 박지 않으므로 여기서 멈춘다(명세 3).",
    );
  }
  if (hosts.length > 1) {
    throw new Error(
      `매니페스트의 호스트가 하나가 아니다: ${hosts.join(", ")}. 집계만 하고 멈춘다(§4.4.1 원천 고정).`,
    );
  }
  const withHost = inputs.filter((input) => input.host !== null).length;
  return {
    origin: `https://${hosts[0]}`,
    source: `매니페스트 ${withHost}개의 CollectRun.host — 전부 ${hosts[0]}`,
  };
}

// ─── fetch (승인이 있을 때만 도달한다) ────────────────────────────────────

interface ImageFetchAttempt {
  readonly status: number | null;
  readonly body: Buffer | null;
  readonly finalUrl: string | null;
  readonly contentType: string | null;
  readonly durationMs: number;
}

async function fetchImageOnce(url: string, userAgent: string): Promise<ImageFetchAttempt> {
  const startedAt = Date.now();
  try {
    // 🚨 `redirect: "manual"` — 자동으로 따라가면 **어디에 도착했는지 모른 채**
    // 바이트를 받는다. ⓑ-3이 막으려는 것이 정확히 그 상태다.
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "image/*" },
      redirect: "manual",
    });
    const contentType = res.headers.get("content-type");
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      return {
        status: res.status,
        body: null,
        finalUrl: location ? new URL(location, url).toString() : null,
        contentType,
        durationMs: Date.now() - startedAt,
      };
    }
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body, finalUrl: url, contentType, durationMs: Date.now() - startedAt };
  } catch {
    return { status: null, body: null, finalUrl: null, contentType: null, durationMs: Date.now() - startedAt };
  }
}

/**
 * 원본의 확장자. 🚨 **매직 바이트가 먼저다** — 원천의 `/fileDownload?...`는
 * 이미지 MIME을 주지 않아 헤더만 보면 전부 `bin`이 된다(2026-08-30 실측).
 * 헤더는 바이트가 말해 주지 않을 때만 쓴다.
 */
function extensionFor(body: Buffer, contentType: string | null): string {
  const sniffed = sniffImageFormat(body);
  if (sniffed !== null) {
    return sniffed;
  }
  if (contentType === null) {
    return "bin";
  }
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "bin";
}

function writeFileEnsuringDir(path: string, body: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

/** 기존 파일을 지우지 않고 옮긴다(ⓓ). */
function backupIfExists(path: string, stamp: string): void {
  if (existsSync(path)) {
    renameSync(path, backupRelPath(path, stamp));
  }
}

// ─── 본체 ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const stamp = stampUtc();
  const userAgent = userAgentFor(args.contact);
  const startedAt = new Date().toISOString();

  const setCodes = args.sets.length > 0 ? args.sets : listSetDirs(args.catalogDir, args.game);
  const inputs = setCodes.map((setCode) => readSetInput(args.catalogDir, args.game, setCode));
  const base = resolveBase(inputs);

  const targets: ImageTarget[] = inputs.flatMap((input) =>
    input.rows.map((row) => ({ setCode: input.setCode, code: row.code, imagePath: row.imagePath })),
  );

  // ── ⓑ-1 집계. **여기까지는 요청이 0회다.** ──────────────────────────────
  const survey = buildHostSurvey({
    game: args.game,
    files: inputs.map((input) => ({
      setCode: input.setCode,
      path: input.path,
      rowCount: input.rows.length,
    })),
    targets,
    baseOrigin: base.origin,
    baseSource: base.source,
  });
  console.log(formatHostSurvey(survey));
  console.log("");

  // 🚨 절대 URL이나 낯선 호스트가 섞여 있으면 집계만 하고 멈춘다 — 화이트리스트에
  // 넣지 않는다. 원천이 늘어나는 판단은 사람이 §4.4.1을 먼저 고치는 일이다.
  const unknownHosts = survey.hostCounts
    .map((entry) => entry.host)
    .filter((host) => !args.approvedHosts.includes(host));

  if (args.approvedHosts.length === 0) {
    console.log("── 승인이 없다. 요청을 한 건도 내보내지 않고 끝낸다 (T1.20 ⓑ). ──");
    console.log("   승인하려면 위 [7]의 문장을 확인한 뒤 다음을 실행한다:");
    console.log(
      `   npm run images:collect -- --game ${args.game} --sets ${setCodes.join(",")} ` +
        `--approve-host ${survey.hostCounts.map((entry) => entry.host).join(" --approve-host ")} ` +
        `--max-requests ${survey.estimatedRequests}`,
    );
    writeManifest(args, {
      argv,
      setCodes,
      base,
      userAgent,
      startedAt,
      stamp,
      requests: [],
      plan: planImageFetches({
        game: args.game,
        targets,
        baseOrigin: base.origin,
        allowlist: [],
        existing: new Set(),
        refetch: args.refetch,
      }),
      savedCount: 0,
      robots: { url: `${base.origin}/robots.txt`, status: ROBOTS_OK_STATUS, checkedAt: startedAt },
      stoppedBy: "not_approved",
    });
    return;
  }

  if (unknownHosts.length > 0) {
    console.error(
      `🚨 승인되지 않은 호스트가 입력에 있다: ${unknownHosts.join(", ")}. 집계만 하고 멈춘다(§4.4.1).`,
    );
    process.exitCode = 1;
    return;
  }

  // ── 여기서부터 요청이 나간다. robots.txt 1회(상태 코드로만 판정). ──────
  const robotsUrl = `${base.origin}/robots.txt`;
  const robotsRes = await fetchImageOnce(robotsUrl, userAgent);
  const robots = { url: robotsUrl, status: robotsRes.status ?? 0, checkedAt: new Date().toISOString() };
  console.log(`robots.txt → ${robots.status} (기대값 ${ROBOTS_OK_STATUS})`);

  const existing = new Set<string>();
  const plan = planImageFetches({
    game: args.game,
    targets,
    baseOrigin: base.origin,
    allowlist: args.approvedHosts,
    existing: collectExisting(args, setCodes, existing),
    refetch: args.refetch,
  });

  console.log(
    `계획 — 받는다 ${plan.fetchCount} · 건너뛴다 ${plan.counts.skip_exists} · ` +
      `경로 위반 ${plan.counts.invalid_path} · 이미지 없음 ${plan.counts.no_image}`,
  );

  let pace: PaceState = createPaceState({
    maxRequests: args.maxRequests ?? 0,
    robotsStatus: robots.status,
  });
  const requests: ImageRequestLog[] = [];
  let savedCount = 0;
  let stoppedBy: ImageStopReason = "completed";

  const queue = plan.items.filter((item) => item.action === "fetch" || item.action === "refetch");

  for (const item of queue) {
    const decision = shouldContinue(pace);
    if (decision.stop) {
      stoppedBy = decision.reason ?? "max_requests";
      break;
    }
    if (!canAfford(pace)) {
      stoppedBy = "max_requests";
      break;
    }

    const outcome = await fetchWithRetry(item, args, userAgent, pace, requests);
    pace = outcome.pace;
    if (outcome.halt !== null) {
      stoppedBy = outcome.halt;
      break;
    }
    pace = registerUrlOutcome(pace, { ok: outcome.saved });
    if (outcome.saved) {
      savedCount += 1;
    }

    await sleep(nextImageDelayMs());
  }

  writeManifest(args, {
    argv,
    setCodes,
    base,
    userAgent,
    startedAt,
    stamp,
    requests,
    plan,
    savedCount,
    robots,
    stoppedBy,
  });

  console.log(
    `끝났다 — 저장 ${savedCount} · 요청 ${requests.length} · 사유 ${stoppedBy}`,
  );
  if (stoppedBy !== "completed") {
    process.exitCode = 1;
  }
}

function collectExisting(
  args: Args,
  setCodes: readonly string[],
  into: Set<string>,
): ReadonlySet<string> {
  for (const setCode of setCodes) {
    const dir = join(args.outDir, args.game, setCode);
    if (!existsSync(dir)) {
      continue;
    }
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".webp")) {
        into.add(`data/images/${args.game}/${setCode}/${name}`);
      }
    }
  }
  return into;
}

interface AttemptResult {
  readonly pace: PaceState;
  readonly saved: boolean;
  readonly halt: ImageStopReason | null;
}

async function fetchWithRetry(
  item: ImageFetchPlanItem,
  args: Args,
  userAgent: string,
  startPace: PaceState,
  requests: ImageRequestLog[],
): Promise<AttemptResult> {
  let pace = startPace;
  let url = item.url as string;
  let redirects = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (!canAfford(pace)) {
      return { pace, saved: false, halt: "max_requests" };
    }

    const startedAt = new Date().toISOString();
    const res = await fetchImageOnce(url, userAgent);
    pace = registerAttempt(pace, { status: res.status });

    requests.push({
      url,
      finalUrl: res.finalUrl,
      startedAt,
      status: res.status,
      durationMs: res.durationMs,
      bytes: res.body?.byteLength ?? null,
      webpBytes: null,
      attempt,
    });

    // 🚨 ⓑ-3 — 응답이 실제로 도착한 곳을 승인 목록과 대조한다.
    if (res.finalUrl !== null) {
      const check = checkFinalHost(url, res.finalUrl, args.approvedHosts);
      if (!check.ok) {
        console.error(
          `🚨 승인되지 않은 호스트에 도착했다: ${check.finalHost}. 즉시 전체 중단한다(ⓑ-3).`,
        );
        return { pace, saved: false, halt: "final_host_mismatch" };
      }
    }

    // 🚨 **받은 것을 먼저 처리한다.** 중단·예산 판정은 *다음 요청을 보내기
    // 전*에만 묻는다 — 그 순서가 뒤바뀌어 2026-08-30 OPK-14 실행에서 200으로
    // 받은 504,104바이트를 버렸다. **예산 소진은 「다음을 보내지 않는다」이지
    // 「받은 것을 버린다」가 아니다**(`decideResponse`의 doc).
    // ⚠️ ⓑ-3 검사만은 이 앞에 남는다 — 승인되지 않은 곳에서 온 바이트는
    // 애초에 저장 대상이 아니다.
    const action = decideResponse({
      status: res.status,
      hasBody: res.body !== null,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
    });

    if (action === "save" && res.body !== null) {
      await saveImage(item, args, res.body, res.contentType, requests);
      return { pace, saved: true, halt: null };
    }

    // 리다이렉트는 저장 대상이 아니고, 따라갈지가 판정이다.
    if (res.status !== null && res.status >= 300 && res.status < 400) {
      if (redirects >= MAX_REDIRECTS || res.finalUrl === null) {
        return { pace, saved: false, halt: null };
      }
      redirects += 1;
      url = res.finalUrl;
      continue;
    }

    // 저장할 것이 없는 것이 확정된 뒤에야 중단 사유를 본다 — 403·429는
    // `registerAttempt`가 이미 `halted`로 세워 두었다(§4.8 ⓔ).
    const decision = shouldContinue(pace);
    if (decision.stop) {
      return { pace, saved: false, halt: (decision.reason ?? "forbidden") as ImageStopReason };
    }

    if (action === "give_up") {
      return { pace, saved: false, halt: null };
    }

    const backoff = retryBackoffMs(attempt);
    if (backoff === null) {
      return { pace, saved: false, halt: null };
    }
    await sleep(backoff);
  }

  return { pace, saved: false, halt: null };
}

/** 원본 + webp **두 벌**을 남긴다(ⓐ). 원본은 재변환의 근거이므로 지우지 않는다. */
async function saveImage(
  item: ImageFetchPlanItem,
  args: Args,
  body: Buffer,
  contentType: string | null,
  requests: ImageRequestLog[],
): Promise<void> {
  const stamp = stampUtc();
  const originalPath = originalRelPath({
    game: args.game,
    setCode: item.setCode,
    code: item.code,
    ext: extensionFor(body, contentType),
  });
  const webpPath = item.relPath;
  if (originalPath === null || webpPath === null) {
    return;
  }

  backupIfExists(originalPath, stamp);
  backupIfExists(webpPath, stamp);

  writeFileEnsuringDir(originalPath, body);

  const webp = await sharp(body)
    .resize({
      width: WEBP_PARAMS.maxEdgePx,
      height: WEBP_PARAMS.maxEdgePx,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_PARAMS.quality })
    .toBuffer();
  writeFileEnsuringDir(webpPath, webp);

  // 측정 3(§9.4 ⓕ-9)의 재료 — 마지막 요청 기록에 변환 후 바이트를 붙인다.
  const last = requests.at(-1);
  if (last) {
    requests[requests.length - 1] = { ...last, webpBytes: webp.byteLength };
  }
}

interface ManifestParts {
  readonly argv: readonly string[];
  readonly setCodes: readonly string[];
  readonly base: { origin: string; source: string };
  readonly userAgent: string;
  readonly startedAt: string;
  readonly stamp: string;
  readonly requests: readonly ImageRequestLog[];
  readonly plan: ReturnType<typeof planImageFetches>;
  readonly savedCount: number;
  readonly robots: { url: string; status: number; checkedAt: string };
  readonly stoppedBy: ImageStopReason;
}

/** **완주든 중단이든 항상 쓴다**(ⓔ · §4.8 ⓓ). */
function writeManifest(args: Args, parts: ManifestParts): void {
  const run = buildImageRun({
    game: args.game,
    setCodes: parts.setCodes,
    argv: parts.argv,
    approvedHosts: args.approvedHosts,
    baseOrigin: parts.base.origin,
    baseSource: parts.base.source,
    userAgent: parts.userAgent,
    startedAt: parts.startedAt,
    finishedAt: new Date().toISOString(),
    robots: parts.robots,
    maxRequests: args.maxRequests ?? 0,
    requests: parts.requests,
    plan: parts.plan,
    savedCount: parts.savedCount,
    stoppedBy: parts.stoppedBy,
  });

  const dir = join(args.outDir, args.game, "_runs");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `images-${parts.stamp}.json`);
  writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`, "utf-8");
  console.log(`매니페스트: ${path}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
