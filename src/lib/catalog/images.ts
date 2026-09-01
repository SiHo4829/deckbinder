/**
 * 이미지 수집기(T1.20)의 **판단** 전량 — plan §8 T1.20 ⓐ~ⓙ · §9.4 ⓕ.
 *
 * **I/O가 0건이다.** `fetch`도 `sharp`도 `fs`도 부르지 않고 `setTimeout`으로
 * 잠들지도 않는다 — 그것은 `scripts/collect-images.ts`의 일이다. 이 프로젝트는
 * 판단을 `scripts/`에 두어 결함을 다섯 번 냈고(§4.10 ⓖ) 전부 **테스트가 붙지
 * 않는 자리**였다. 그래서 이미지 쪽 판단은 처음부터 여기에 둔다.
 *
 * 🚨 **부하 규율의 상태 기계를 새로 만들지 않는다.** 상한 · 403/429 즉시 중단 ·
 * 연속 실패 3회 · 재시도 정책은 `pace.ts`가 이미 가지고 있고, 이미지와 목록의
 * 차이는 **간격 값 하나뿐**이다(3초 → 1.5초. 근거는 T1.20 ⓒ). `nextDelayMs`가
 * 간격과 지터를 이미 인자로 받으므로 값만 넘긴다 — `pace.ts`는 한 줄도 고치지
 * 않는다(T1.20 ⓗ).
 */

import {
  checkFinalHost,
  decideHost,
  extractDownname,
  hostOf,
  sniffImageFormat,
} from "@/lib/validation/card-image";
// `planImageFetches`가 `hostReason` 칸에 쓴다. 🚨 아래 `export type { … } from`은
// **재수출일 뿐 로컬 바인딩을 만들지 않으므로** 이 import가 따로 필요하다.
import type { HostDecisionReason } from "@/lib/validation/card-image";

import { nextDelayMs } from "./pace";
import type { ImageRequestLog, ImageRun, ImageStopReason } from "./types";

/**
 * ★ **T1.29 (2026-08-31): 호스트 판정 넷이 `@/lib/validation/card-image`로 옮겨갔다.**
 *
 * 🚨 **여기서 re-export하는 것은 하위 호환이 아니라 「이동이 안전했다」는 증거다** —
 * `images.test.ts` 70건이 **기대값을 한 줄도 바꾸지 않고** 통과해야 하고, 그것이
 * T1.29의 완료 기준 ⓑ다. 옮긴 이유는 §3.5 「번들 오염」에 있다(요약: 워커는
 * `@/lib/validation/*`만 공유받고, `@/lib/catalog`는 로컬 스크립트 전용 구획이다).
 *
 * ⚠️ **새 코드는 `@/lib/validation/card-image`에서 직접 가져온다.** 이 re-export는
 * 수집기(T1.20)가 이미 쓰고 있는 경로를 끊지 않기 위한 것이다.
 *
 * ★★ **T1.31 (2026-09-01): `extractDownname`이 같은 이유로 뒤따라 옮겨갔다.**
 * 🚨 **T1.29가 옮긴 여섯에 이것이 빠져 있었고, 그것이 T1.31에서 드러났다** —
 * 앱의 `proxiedImageUrl()`(`src/lib/cards/`)이 이 함수를 불러야 하는데, 여기
 * 남겨 두면 **「`@/lib/catalog`는 로컬 스크립트 전용」 선언을 앱 코드가 깨게 된다**.
 * ⚠️ **빠뜨린 것을 나무랄 자리가 아니다 — T1.29 시점에는 부르는 쪽이 워커뿐이었고
 * 워커는 이 함수를 쓰지 않는다.** 쓰는 쪽이 늘면서 경계가 다시 그어진 것이다.
 */
export { checkFinalHost, decideHost, extractDownname, hostOf, sniffImageFormat };
export type {
  FinalHostCheck,
  HostDecision,
  HostDecisionReason,
} from "@/lib/validation/card-image";

// ─── 부하 규율 (T1.20 ⓒ) ───────────────────────────────────────────────────

/**
 * 이미지 요청 간격. **§4.8 ⓔ의 3초에서 내린 값이고 편의가 아니다** — 근거
 * 전문은 T1.20 ⓒ에 있다(목록 한 페이지를 브라우저로 열면 이미지 20장이
 * *동시에* 나가므로 이미지에 대해서는 기준선 자체가 더 빠르다). ⚠️ **그럼에도
 * 절반까지만 내렸다. 1.5초는 관습값이지 실측이 아니다.**
 */
export const IMAGE_DELAY_MS = 1500;

/** 규칙적인 간격이 패턴으로 뭉치는 것을 막는다(§4.8 ⓔ). */
export const IMAGE_JITTER_MS = 1000;

/**
 * 인자가 규율을 깎는 통로가 되지 않게 하한을 둔다 —
 * `scripts/collect-catalog.ts`의 `MIN_DELAY_MS`와 같은 자세다(ⓚ-5).
 */
export const MIN_IMAGE_DELAY_MS = 1500;

/**
 * 다음 이미지 요청까지 대기할 밀리초. **`pace.ts`의 함수를 그대로 쓴다** —
 * 이미지 전용 상태 기계는 존재하지 않는다.
 */
export function nextImageDelayMs(rng: () => number = Math.random): number {
  return nextDelayMs(IMAGE_DELAY_MS, IMAGE_JITTER_MS, rng);
}

/** webp 변환 파라미터 — §9.4 ⓕ-7이 확정한 값. **한 종류만 만든다.** */
export const WEBP_PARAMS = {
  /** 긴 변 기준. `.aspect-card` 타일과 상세 화면 모두에 충분하다(확대 기능이 없다). */
  maxEdgePx: 600,
  quality: 80,
} as const;

// ─── imagePath 형태 판정 (T1.20 ⓑ-1 · 명세 2) ──────────────────────────────

/**
 * 중간 파일의 `imagePath`가 어떤 모양인가.
 *
 * 🚨 **`root_relative`와 `absolute`를 가르는 것이 이 타입의 요점이다.** 절대
 * URL이 하나라도 있으면 **그 호스트는 우리가 승인받은 적 없는 원천**일 수
 * 있고, 그때는 집계만 하고 멈춘다(§4.4.1 원천 고정).
 */
export type ImagePathShape =
  | "absolute" // http:// · https://
  | "protocol_relative" // //host/path
  | "root_relative" // /path
  | "other" // path · ./path · data: 등
  | "empty";

export function classifyImagePath(imagePath: string): ImagePathShape {
  const trimmed = imagePath.trim();
  if (trimmed === "") {
    return "empty";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return "absolute";
  }
  // 🚨 `//`를 `/`보다 먼저 본다. 순서가 반대면 프로토콜 상대가 루트 상대로
  // 분류되고, 그것은 **다른 호스트가 우리 호스트로 둔갑하는** 오분류다.
  if (trimmed.startsWith("//")) {
    return "protocol_relative";
  }
  if (trimmed.startsWith("/")) {
    return "root_relative";
  }
  return "other";
}

/** 형태 분포를 세는 순서. 출력이 실행마다 흔들리지 않게 고정한다. */
export const IMAGE_PATH_SHAPES: readonly ImagePathShape[] = [
  "absolute",
  "protocol_relative",
  "root_relative",
  "other",
  "empty",
] as const;

// ─── 절대화 (T1.20 ⓑ-1 · 명세 3) ───────────────────────────────────────────

/**
 * 상대 경로를 절대 URL로 만든다.
 *
 * 🚨 **`baseOrigin`이 인자인 것이 이 함수의 계약이다.** 모듈 안에 호스트를
 * 박아 놓고 「집계했다」고 하면 그것은 집계가 아니라 **선언**이다(명세 3).
 * 호출자는 base를 **매니페스트의 `CollectRun.host`**에서 읽어 넘긴다 — 즉
 * 우리가 실제로 목록을 받았던 호스트가 근거다.
 */
export function absolutizeImagePath(imagePath: string, baseOrigin: string): string | null {
  if (classifyImagePath(imagePath) === "empty") {
    return null;
  }
  try {
    return new URL(imagePath.trim(), baseOrigin).toString();
  } catch {
    return null;
  }
}

// ─── 경로 · 파일명 규칙 (T1.20 ⓐ · ⓓ) ─────────────────────────────────────

/** §9.4 ⓕ-2가 정한 것과 **같은 패턴**이다. T1.22의 업로드 경로가 이것을 그대로 받는다. */
export const IMAGE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isValidPathSegment(value: string): boolean {
  return IMAGE_SEGMENT_PATTERN.test(value);
}

/** 출력 루트. `data/`는 이미 `.gitignore`이고 **이미지 바이트를 커밋하지 않는다**(ⓕ). */
export const IMAGE_ROOT = "data/images";

/**
 * 저장 경로. `data/images/<game>/<setCode>/<code>.<ext>` (ⓐ).
 *
 * 🚨 세 조각 전부를 검사한다 — `game`·`setCode`가 인자에서 오는데 검사하지
 * 않으면 `..`이 경로를 벗어난다. **`code`만 보는 것으로 충분하지 않다.**
 */
export function imageRelPath(params: {
  readonly game: string;
  readonly setCode: string;
  readonly code: string;
  readonly ext: string;
}): string | null {
  const ext = params.ext.replace(/^\./, "");
  if (
    !isValidPathSegment(params.game) ||
    !isValidPathSegment(params.setCode) ||
    !isValidPathSegment(params.code) ||
    !isValidPathSegment(ext)
  ) {
    return null;
  }
  return `${IMAGE_ROOT}/${params.game}/${params.setCode}/${params.code}.${ext}`;
}

/**
 * 원본의 저장 경로 — `<code>.original.<ext>`.
 *
 * 🚨 **원본과 변환본의 이름을 가르는 것이 이 함수의 존재 이유다.** T1.20 ⓐ는
 * 「원본 + `.webp` 두 벌」이라고만 적었는데, **원천이 주는 원본 자체가 webp인
 * 것이 2026-08-30에 관측됐다.** 그러면 두 벌이 같은 이름을 요구해 **한 벌이
 * 다른 한 벌을 덮는다.** ⚠️ **변환본 쪽을 바꾸지 않는다** — `<code>.webp`는
 * §9.4 ⓕ-2가 T1.22의 업로드 경로로 못박은 이름이고, 그것을 건드리면 이 발견이
 * 업로더까지 번진다. **바꿀 수 있는 쪽은 원본의 이름뿐이다.**
 */
export function originalRelPath(params: {
  readonly game: string;
  readonly setCode: string;
  readonly code: string;
  readonly ext: string;
}): string | null {
  const ext = params.ext.replace(/^\./, "");
  // 조각 검사는 `imageRelPath`와 **같은 규칙**을 쓴다 — 두 벌로 두면 언젠가
  // 하나만 고쳐진다(§4.8 ⓚ-4와 같은 자세). `.original.`은 우리가 붙이는
  // 고정 문자열이므로 검사 대상이 아니다.
  const base = imageRelPath({ ...params, ext });
  if (base === null) {
    return null;
  }
  return `${IMAGE_ROOT}/${params.game}/${params.setCode}/${params.code}.original.${ext}`;
}

/**
 * 재실행이 기존 파일을 **지우지 않고** 옮길 이름(ⓓ · §4.8 ⓓ와 같은 규칙).
 * 되돌리려면 원천에 다시 부하를 주어야 하므로 덮어쓰지 않는다.
 */
export function backupRelPath(relPath: string, stamp: string): string {
  return `${relPath}.bak-${stamp}`;
}

// ─── 재실행 판정 (T1.20 ⓓ) ────────────────────────────────────────────────

export type ImageFetchAction =
  | "fetch"
  /** 이미 받아 둔 파일이 있다. **요청 0회로 건너뛴다** — 재실행의 기본값이다. */
  | "skip_exists"
  /** `--refetch`가 명시됐다. 기존 파일을 `.bak-<stamp>`로 옮기고 다시 받는다. */
  | "refetch"
  /** `code`·`game`·`setCode`가 경로 규칙을 벗어난다. T1.22의 `invalid`와 같은 자리다. */
  | "invalid_path"
  /** `imagePath`가 비어 있거나 절대화되지 않는다. */
  | "no_image"
  /** 🚨 호스트가 승인되지 않았다. **집계에는 남기고 요청은 내보내지 않는다.** */
  | "host_denied";

export interface ImageTarget {
  readonly setCode: string;
  readonly code: string;
  readonly imagePath: string;
}

export interface ImageFetchPlanItem {
  readonly setCode: string;
  readonly code: string;
  readonly url: string | null;
  readonly downname: string | null;
  readonly relPath: string | null;
  readonly action: ImageFetchAction;
  readonly hostReason: HostDecisionReason | null;
}

export interface ImageFetchPlan {
  readonly items: readonly ImageFetchPlanItem[];
  readonly counts: Readonly<Record<ImageFetchAction, number>>;
  /** 실제로 나갈 요청 수. **`items.length`가 아니다.** */
  readonly fetchCount: number;
}

/**
 * 무엇을 받고 무엇을 건너뛸지 정한다. **파일 존재 여부는 인자로 받는다** —
 * 이 모듈은 `fs`를 부르지 않는다.
 *
 * 🚨 판정 순서가 계약이다: **경로 규칙 → 이미지 유무 → 호스트 승인 → 기존 파일.**
 * 호스트 검사를 기존 파일 검사보다 **앞**에 두면 미승인 호스트가 「이미 있으니
 * 건너뜀」으로 조용히 통과하는 일이 생기지 않는다.
 */
export function planImageFetches(input: {
  readonly game: string;
  readonly targets: readonly ImageTarget[];
  readonly baseOrigin: string;
  readonly allowlist: readonly string[];
  readonly existing: ReadonlySet<string>;
  readonly refetch: boolean;
}): ImageFetchPlan {
  const counts: Record<ImageFetchAction, number> = {
    fetch: 0,
    skip_exists: 0,
    refetch: 0,
    invalid_path: 0,
    no_image: 0,
    host_denied: 0,
  };

  const items = input.targets.map((target): ImageFetchPlanItem => {
    const relPath = imageRelPath({
      game: input.game,
      setCode: target.setCode,
      code: target.code,
      ext: "webp",
    });
    const downname = extractDownname(target.imagePath);
    const url = absolutizeImagePath(target.imagePath, input.baseOrigin);

    const base = { setCode: target.setCode, code: target.code, url, downname, relPath };

    if (relPath === null) {
      counts.invalid_path += 1;
      return { ...base, action: "invalid_path", hostReason: null };
    }
    if (url === null) {
      counts.no_image += 1;
      return { ...base, action: "no_image", hostReason: null };
    }

    const decision = decideHost(url, input.allowlist);
    if (!decision.allowed) {
      counts.host_denied += 1;
      return { ...base, action: "host_denied", hostReason: decision.reason };
    }

    if (input.existing.has(relPath)) {
      const action: ImageFetchAction = input.refetch ? "refetch" : "skip_exists";
      counts[action] += 1;
      return { ...base, action, hostReason: decision.reason };
    }

    counts.fetch += 1;
    return { ...base, action: "fetch", hostReason: decision.reason };
  });

  return { items, counts, fetchCount: counts.fetch + counts.refetch };
}

// ─── 응답 처리 판정 (2026-08-30 결함 수정) ────────────────────────────────

export type ResponseAction =
  /** 200 + 본문. **무조건 저장한다.** */
  | "save"
  /** 5xx·타임아웃이고 재시도 여유가 있다. */
  | "retry"
  /** 4xx이거나 재시도를 소진했다. 이 URL은 포기하고 다음으로 간다. */
  | "give_up";

/**
 * 받은 응답을 어떻게 할 것인가.
 *
 * 🚨 **`PaceState`를 인자로 받지 않는 것이 이 함수의 요점이다. 실수로 뺀 것이
 * 아니다.** 2026-08-30 OPK-14 실행에서 **160번째 요청이 200으로 504,104바이트를
 * 정상 수신하고도 버려졌다** — 예산 소진 검사가 「수신」과 「저장」 *사이*에
 * 있었기 때문이다.
 *
 * **예산 소진이 뜻하는 것은 「다음 요청을 보내지 않는다」이지 「방금 받은
 * 바이트를 버린다」가 아니다.** 버리면 원천은 부하를 그대로 지고 우리는 아무것도
 * 얻지 못한다 — 부하 규율의 목적에 정면으로 어긋나고, **그 낭비를 메우려면
 * 원천에 요청을 한 번 더 보내야 한다.**
 *
 * ⚠️ 그러므로 멈춤 판정(`pace.ts`의 `shouldContinue`)은 **다음 요청을 보내기
 * 전**에만 묻는다. 이 함수와 그 함수의 경계가 그 순서를 강제한다.
 */
export function decideResponse(params: {
  readonly status: number | null;
  readonly hasBody: boolean;
  readonly attempt: number;
  readonly maxAttempts: number;
}): ResponseAction {
  if (params.status === 200 && params.hasBody) {
    return "save";
  }
  if (params.attempt >= params.maxAttempts) {
    return "give_up";
  }
  // 5xx·타임아웃만 재시도한다(§4.8 ⓔ). 4xx는 다시 받아도 같다.
  if (params.status === null || (params.status >= 500 && params.status < 600)) {
    return "retry";
  }
  return "give_up";
}

// ─── 호스트 집계 (T1.20 ⓑ-1 · 명세 9항목) ─────────────────────────────────

export interface HostSurveyFile {
  readonly setCode: string;
  readonly path: string;
  readonly rowCount: number;
}

export interface HostSurveyInput {
  readonly game: string;
  readonly files: readonly HostSurveyFile[];
  readonly targets: readonly ImageTarget[];
  readonly baseOrigin: string;
  /** 🚨 base가 **어디서 왔는지**. 명세 3이 요구하는 것이 이 문장이다. */
  readonly baseSource: string;
}

export interface HostCount {
  readonly host: string;
  readonly count: number;
}

export interface HostSurvey {
  readonly game: string;
  readonly fileCount: number;
  readonly rowCount: number;
  readonly setCodes: readonly string[];
  readonly shapeCounts: Readonly<Record<ImagePathShape, number>>;
  readonly shapeSamples: Readonly<Record<ImagePathShape, readonly string[]>>;
  readonly baseOrigin: string;
  readonly baseSource: string;
  readonly hostCounts: readonly HostCount[];
  /** `downname` 기준 distinct. **행 수가 아니다**(명세 5). */
  readonly uniqueImageCount: number;
  /** `downname`을 뽑지 못한 행. 0이 아니면 고유 수의 근거가 흔들린다. */
  readonly missingDownnameCount: number;
  readonly estimatedRequests: number;
  readonly estimatedMs: number;
}

/** 형태마다 대표 샘플 몇 건을 보일 것인가(명세 2). */
const SHAPE_SAMPLE_LIMIT = 3;

export function buildHostSurvey(input: HostSurveyInput): HostSurvey {
  const shapeCounts: Record<ImagePathShape, number> = {
    absolute: 0,
    protocol_relative: 0,
    root_relative: 0,
    other: 0,
    empty: 0,
  };
  const shapeSamples: Record<ImagePathShape, string[]> = {
    absolute: [],
    protocol_relative: [],
    root_relative: [],
    other: [],
    empty: [],
  };
  const hostTally = new Map<string, number>();
  const downnames = new Set<string>();
  let missingDownnameCount = 0;

  for (const target of input.targets) {
    const shape = classifyImagePath(target.imagePath);
    shapeCounts[shape] += 1;
    if (shapeSamples[shape].length < SHAPE_SAMPLE_LIMIT) {
      shapeSamples[shape].push(target.imagePath);
    }

    const url = absolutizeImagePath(target.imagePath, input.baseOrigin);
    if (url !== null) {
      const host = hostOf(url);
      if (host !== null) {
        hostTally.set(host, (hostTally.get(host) ?? 0) + 1);
      }
    }

    const downname = extractDownname(target.imagePath);
    if (downname === null) {
      missingDownnameCount += 1;
    } else {
      downnames.add(downname);
    }
  }

  // 🚨 고유 이미지 수는 `downname`이 있는 것만 센다. `downname`이 없는 행은
  // **모른다**이지 **0장**이 아니므로, 그 수를 따로 내보내 사람이 본다.
  const uniqueImageCount = downnames.size;
  const estimatedRequests = uniqueImageCount + missingDownnameCount;

  return {
    game: input.game,
    fileCount: input.files.length,
    rowCount: input.targets.length,
    setCodes: input.files.map((file) => file.setCode),
    shapeCounts,
    shapeSamples,
    baseOrigin: input.baseOrigin,
    baseSource: input.baseSource,
    hostCounts: [...hostTally.entries()]
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host)),
    uniqueImageCount,
    missingDownnameCount,
    estimatedRequests,
    // 지터의 기대값은 절반이다. **추정이므로 출력에 그렇게 표시한다**(명세 6).
    estimatedMs: estimatedRequests * (IMAGE_DELAY_MS + IMAGE_JITTER_MS / 2),
  };
}

/** 승인 문장(명세 7). **사람이 예/아니오를 답할 대상이 문장으로 있어야 한다.** */
export function approvalSentence(survey: HostSurvey): string {
  const hosts = survey.hostCounts.map((entry) => `\`${entry.host}\``).join(" · ");
  const subject = survey.hostCounts.length === 1 ? `호스트 ${hosts} 하나에` : `호스트 ${hosts}에`;
  return `${subject} 대해 최대 ${survey.estimatedRequests}회 요청을 승인한다.`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `약 ${hours}시간 ${minutes}분` : `약 ${minutes}분`;
}

const SHAPE_LABELS: Readonly<Record<ImagePathShape, string>> = {
  absolute: "절대 URL (http:// · https://)",
  protocol_relative: "프로토콜 상대 (//)",
  root_relative: "루트 상대 (/)",
  other: "그 밖",
  empty: "빈 값",
};

/**
 * 명세 9항목을 사람이 읽는 형태로 낸다(T1.20 ⓑ-1).
 *
 * 🚨 **8과 9를 빼지 않는다.** 8(요청 0회 단언)은 08-29에 무인 규율이 실제로
 * 깨진 이력 때문에 **출력이 스스로 증언하게** 하는 것이고, 9(경고)는 절대화
 * 결과가 **확인이 아니라 문자열 조립**이라는 것을 승인하는 사람이 알아야 하기
 * 때문이다.
 */
export function formatHostSurvey(survey: HostSurvey): string {
  const lines: string[] = [];

  lines.push("═══ 이미지 호스트 집계 — 승인 재료 (T1.20 ⓑ-1) ═══");
  lines.push("");

  lines.push(`[1] 입력 범위 — 게임 ${survey.game} · 파일 ${survey.fileCount}개 · 행 ${survey.rowCount}건`);
  lines.push(`    세트: ${survey.setCodes.join(", ")}`);
  lines.push("");

  lines.push("[2] imagePath 형태 분포");
  for (const shape of IMAGE_PATH_SHAPES) {
    lines.push(`    ${SHAPE_LABELS[shape].padEnd(30)} ${String(survey.shapeCounts[shape]).padStart(6)}건`);
    for (const sample of survey.shapeSamples[shape]) {
      lines.push(`        예) ${sample}`);
    }
  }
  lines.push("");

  lines.push("[3] 절대화 규칙과 base의 출처");
  lines.push("    규칙: new URL(imagePath, base)");
  lines.push(`    base: ${survey.baseOrigin}`);
  lines.push(`    출처: ${survey.baseSource}`);
  lines.push("    🚨 base를 코드에 박지 않았다. 위 출처가 근거다.");
  lines.push("");

  lines.push("[4] 절대화 후 호스트 분포");
  for (const entry of survey.hostCounts) {
    lines.push(`    ${entry.host.padEnd(30)} ${String(entry.count).padStart(6)}건`);
  }
  lines.push("");

  lines.push(`[5] 고유 이미지 수 (downname distinct) — ${survey.uniqueImageCount}장`);
  lines.push(`    downname 없는 행: ${survey.missingDownnameCount}건`);
  lines.push("    🚨 승인되는 요청 수의 상한은 이 값이다. 행 수가 아니다.");
  lines.push("");

  lines.push(`[6] 예상 요청 수 ${survey.estimatedRequests}회 · 예상 소요 ${formatDuration(survey.estimatedMs)}`);
  lines.push(`    ⚠️ 추정이다 (간격 ${IMAGE_DELAY_MS}ms + 지터 0~${IMAGE_JITTER_MS}ms, 지터 기대값 절반 기준).`);
  lines.push("");

  lines.push("[7] 승인 문장 — 아래 한 문장에 예/아니오로 답하면 된다");
  lines.push(`    「${approvalSentence(survey)}」`);
  lines.push("");

  lines.push("[8] 이 집계는 원천 사이트로 요청을 0회 보내고 만들어졌다.");
  lines.push("    로컬 중간 파일과 매니페스트만 읽었다.");
  lines.push("");

  lines.push("[9] ⚠️ 경고 — 위 호스트가 목록 페이지와 같다는 것은 *문자열 조립의 결과*이지");
  lines.push("    확인이 아니다. 리다이렉트·CDN 전환은 첫 실제 요청에서만 드러난다.");
  lines.push("    그래서 첫 실행이 최종 응답 URL의 호스트를 매니페스트에 따로 적고,");
  lines.push("    승인된 호스트와 다르면 즉시 전체 중단한다 (ⓑ-3).");

  return lines.join("\n");
}

// ─── 매니페스트 조립 (T1.20 ⓔ) ────────────────────────────────────────────

/**
 * 실행 1회의 매니페스트를 조립한다. **완주든 중단이든 항상 쓴다**(ⓔ).
 *
 * 🚨 **집계는 배선이 아니라 판단이다.** `failureCount`를 `scripts/`에서 세다가
 * 오집계 결함을 낸 것이 T1.16의 결함 1이었다(§4.10 ⓖ). 그래서 세는 일을 여기서
 * 하고 테스트를 붙인다 — `scripts/`는 로그 배열을 넘길 뿐이다.
 */
export function buildImageRun(input: {
  readonly game: string;
  readonly setCodes: readonly string[];
  readonly argv: readonly string[];
  readonly approvedHosts: readonly string[];
  readonly baseOrigin: string;
  readonly baseSource: string;
  readonly userAgent: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly robots: { readonly url: string; readonly status: number; readonly checkedAt: string };
  readonly maxRequests: number;
  readonly requests: readonly ImageRequestLog[];
  readonly plan: ImageFetchPlan;
  readonly savedCount: number;
  readonly stoppedBy: ImageStopReason;
}): ImageRun {
  // 🚨 실패는 **시도 단위**로 센다. 성공하지 않은 시도가 곧 실패다 —
  // `status === null`(네트워크 실패)과 2xx 아닌 응답을 함께 센다.
  const failureCount = input.requests.filter(
    (log) => log.status === null || log.status < 200 || log.status >= 300,
  ).length;

  return {
    schemaVersion: 1,
    game: input.game,
    setCodes: input.setCodes,
    argv: input.argv,
    approvedHosts: input.approvedHosts,
    baseOrigin: input.baseOrigin,
    baseSource: input.baseSource,
    userAgent: input.userAgent,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    robots: input.robots,
    delayMs: IMAGE_DELAY_MS,
    jitterMs: IMAGE_JITTER_MS,
    webp: { maxEdgePx: WEBP_PARAMS.maxEdgePx, quality: WEBP_PARAMS.quality },
    requests: input.requests,
    requestCount: input.requests.length,
    maxRequests: input.maxRequests,
    failureCount,
    savedCount: input.savedCount,
    skippedCount: input.plan.counts.skip_exists,
    invalidCount: input.plan.counts.invalid_path + input.plan.counts.no_image,
    hostDeniedCount: input.plan.counts.host_denied,
    stoppedBy: input.stoppedBy,
  };
}
