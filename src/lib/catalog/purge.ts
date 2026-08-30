/**
 * 이미지 회수(purge)의 **판단** 전량 — T1.21 (plan §8 T1.21 ⓐ~ⓘ · §9.4 ⓕ-4).
 *
 * **I/O가 0건이다.** Supabase도 `fs`도 부르지 않는다 — 객체 목록과 카드 행을
 * **값으로 받는다.** ⓖ가 「선택 로직은 `scripts/`가 아니라 `src/lib/catalog/`에
 * 둔다」고 못박은 자리이고, 그 근거는 T1.16 결함 1이 정확히 이 경계에서 났기
 * 때문이다 — **무엇을 셀지는 배선이 아니라 판단이다.**
 *
 * 🚨 **이 모듈이 지키는 가장 중요한 것은 순서다.** §9.4 ⓕ-4의 1→2, 즉
 * **`cards.image_url`을 먼저 비우고 그 다음 버킷 객체를 지운다.** 반대로 하면
 * 화면이 「있다고 말하는 URL」을 가리키는 동안 파일이 없어 **404를 그린다.**
 * 순서를 주석이 아니라 `PURGE_STEPS`와 그 테스트가 지킨다.
 */

// ─── 범위 ──────────────────────────────────────────────────────────────────

export type PurgeScope = "all" | "game" | "set";

export interface PurgeRange {
  readonly scope: PurgeScope;
  readonly game: string | null;
  readonly setCode: string | null;
}

export type RangeError =
  | "scope_missing"
  | "game_required"
  | "set_required"
  | "game_unexpected"
  | "set_unexpected";

/**
 * 범위 인자를 검사한다.
 *
 * 🚨 **`--scope all`에 `--set`이 붙는 것을 거부하는 것이 요점이다.** 사람이
 * 「이 세트만 지우려던 것」을 적었는데 코드가 전량을 지우면, 그것은 **되돌릴 수
 * 없는 삭제를 의도와 반대로 수행한 것**이다. 남는 인자를 조용히 무시하지 않는다.
 */
export function parsePurgeRange(input: {
  readonly scope: string | null;
  readonly game: string | null;
  readonly setCode: string | null;
}): { readonly range: PurgeRange } | { readonly error: RangeError } {
  if (input.scope === null || !["all", "game", "set"].includes(input.scope)) {
    return { error: "scope_missing" };
  }
  const scope = input.scope as PurgeScope;

  if (scope === "all") {
    if (input.game !== null) return { error: "game_unexpected" };
    if (input.setCode !== null) return { error: "set_unexpected" };
    return { range: { scope, game: null, setCode: null } };
  }
  if (scope === "game") {
    if (input.game === null) return { error: "game_required" };
    if (input.setCode !== null) return { error: "set_unexpected" };
    return { range: { scope, game: input.game, setCode: null } };
  }
  // scope === "set"
  if (input.game === null) return { error: "game_required" };
  if (input.setCode === null) return { error: "set_required" };
  return { range: { scope, game: input.game, setCode: input.setCode } };
}

/** 버킷 안에서 이 범위가 가리키는 경로 접두사. `all`이면 버킷 전체다. */
export function purgePrefix(range: PurgeRange): string {
  if (range.scope === "all") {
    return "";
  }
  if (range.scope === "game") {
    return `${range.game}/`;
  }
  return `${range.game}/${range.setCode}/`;
}

// ─── 대상 선택 ─────────────────────────────────────────────────────────────

/** 버킷 객체 1건. `name`은 버킷 루트 기준 경로다(`opcg/OPK-14/OP14-001.webp`). */
export interface BucketObject {
  readonly name: string;
  readonly sizeBytes: number;
}

/** `cards` 행 중 이 판단에 필요한 것만. **다른 컬럼을 받지 않는다.** */
export interface CardImageRow {
  readonly id: string;
  readonly game: string;
  readonly setCode: string;
  readonly imageUrl: string | null;
  readonly sourceImageUrl: string | null;
}

export function selectObjects(
  objects: readonly BucketObject[],
  range: PurgeRange,
): readonly BucketObject[] {
  const prefix = purgePrefix(range);
  return objects.filter((object) => object.name.startsWith(prefix));
}

/**
 * 범위에 드는 카드 행.
 *
 * ⚠️ **`imageUrl`이 이미 `null`인 행도 범위에는 든다.** 「지울 것이 없다」와
 * 「범위 밖이다」는 다르고, 리포트가 둘을 갈라 보여야 사람이 **이미 비어 있는
 * 것인지 범위를 잘못 준 것인지**를 안다.
 */
export function selectCards(
  cards: readonly CardImageRow[],
  range: PurgeRange,
): readonly CardImageRow[] {
  if (range.scope === "all") {
    return cards;
  }
  if (range.scope === "game") {
    return cards.filter((card) => card.game === range.game);
  }
  return cards.filter((card) => card.game === range.game && card.setCode === range.setCode);
}

// ─── 계획 ──────────────────────────────────────────────────────────────────

/** 드라이런이 보여야 하는 샘플 건수(ⓑ). */
export const PURGE_SAMPLE_SIZE = 20;

/** 표본 검증에서 GET해 404를 확인할 건수(ⓔ · §9.4 ⓕ-4의 4단계). */
export const PURGE_VERIFY_SAMPLE_SIZE = 20;

export interface PurgePlan {
  readonly range: PurgeRange;
  readonly prefix: string;
  /** 버킷에서 지울 객체. */
  readonly objects: readonly BucketObject[];
  readonly objectCount: number;
  readonly totalBytes: number;
  /** 범위에 드는 카드 행 전체. */
  readonly cardCount: number;
  /** 🚨 그중 실제로 `image_url`을 비울 행. **`cardCount`와 다르다.** */
  readonly imageUrlToClear: number;
  /** `--include-source-url`을 켰을 때 비울 행. 꺼져 있으면 0이다. */
  readonly sourceUrlToClear: number;
  /** `--local`을 켰을 때 지울 로컬 파일. 꺼져 있으면 0이다. */
  readonly localFileCount: number;
  readonly sample: readonly string[];
  readonly includeSourceUrl: boolean;
  readonly local: boolean;
}

export function buildPurgePlan(input: {
  readonly range: PurgeRange;
  readonly objects: readonly BucketObject[];
  readonly cards: readonly CardImageRow[];
  readonly localFiles: readonly string[];
  readonly includeSourceUrl: boolean;
  readonly local: boolean;
}): PurgePlan {
  const objects = selectObjects(input.objects, input.range);
  const cards = selectCards(input.cards, input.range);
  const prefix = purgePrefix(input.range);

  return {
    range: input.range,
    prefix,
    objects,
    objectCount: objects.length,
    totalBytes: objects.reduce((sum, object) => sum + object.sizeBytes, 0),
    cardCount: cards.length,
    imageUrlToClear: cards.filter((card) => card.imageUrl !== null).length,
    sourceUrlToClear: input.includeSourceUrl
      ? cards.filter((card) => card.sourceImageUrl !== null).length
      : 0,
    localFileCount: input.local
      ? input.localFiles.filter((path) => path.includes(`/${prefix}`) || prefix === "").length
      : 0,
    sample: objects.slice(0, PURGE_SAMPLE_SIZE).map((object) => object.name),
    includeSourceUrl: input.includeSourceUrl,
    local: input.local,
  };
}

// ─── 결론 · `--apply` 관문 (ⓐ · ⓑ) ────────────────────────────────────────

export type PurgeConclusionCode =
  /** 지울 것이 있고 범위가 명확하다. `--apply`가 열린다. */
  | "ok"
  /** 🚨 범위에 드는 대상이 하나도 없다. **통과가 아니라 미실행이다.** */
  | "nothing_to_purge";

export interface PurgeConclusion {
  readonly code: PurgeConclusionCode;
  readonly ok: boolean;
  readonly line: string;
}

/**
 * 드라이런의 **결론 한 줄**. ⓑ가 「초록이 아니면 `--apply`가 거부한다」고 적은
 * 그 한 줄이다.
 *
 * 🚨 **대상 0건을 초록으로 만들지 않는다.** 0건은 「깨끗하게 지웠다」가 아니라
 * **「지울 것을 못 찾았다」**이고, 둘을 섞으면 **범위를 잘못 준 실행이 성공으로
 * 보고된다.** T1.21이 08-29·08-30에 「대상이 0이면 완료 기준이 통과가 아니라
 * 미실행이 된다」로 두 번 미뤄진 것과 같은 판단을 코드에 넣는 것이다.
 */
export function purgeConclusion(plan: PurgePlan): PurgeConclusion {
  const work =
    plan.objectCount + plan.imageUrlToClear + plan.sourceUrlToClear + plan.localFileCount;

  if (work === 0) {
    return {
      code: "nothing_to_purge",
      ok: false,
      line:
        `결론: 지울 것이 없다 — 객체 0 · image_url 0 · 범위 "${describeRange(plan.range)}". ` +
        "범위를 잘못 주었을 수 있다. --apply를 거부한다.",
    };
  }

  return {
    code: "ok",
    ok: true,
    line:
      `결론: 초록 — 객체 ${plan.objectCount}건(${formatBytes(plan.totalBytes)}) · ` +
      `image_url ${plan.imageUrlToClear}행` +
      (plan.includeSourceUrl ? ` · source_image_url ${plan.sourceUrlToClear}행` : "") +
      (plan.local ? ` · 로컬 ${plan.localFileCount}개` : "") +
      ` · 범위 "${describeRange(plan.range)}".`,
  };
}

export type ApplyRefusal = "not_requested" | "conclusion_not_green";

/**
 * `--apply`를 허용할 것인가.
 *
 * 🚨 **기본이 드라이런이다**(ⓐ) — `apply`가 `false`면 **한 객체도 지우지
 * 않는다.** 그리고 결론이 초록이 아니면 `apply`가 `true`여도 거부한다(ⓑ).
 */
export function decideApply(params: {
  readonly apply: boolean;
  readonly conclusion: PurgeConclusion;
}): { readonly allowed: true } | { readonly allowed: false; readonly reason: ApplyRefusal } {
  if (!params.apply) {
    return { allowed: false, reason: "not_requested" };
  }
  if (!params.conclusion.ok) {
    return { allowed: false, reason: "conclusion_not_green" };
  }
  return { allowed: true };
}

// ─── 실행 순서 (ⓒ · §9.4 ⓕ-4의 1→2) ──────────────────────────────────────

export type PurgeStep =
  /** 1단계 — 화면에서 즉시 사라진다. **버킷보다 먼저다.** */
  | "clear_image_url"
  /** 2단계 — 버킷 객체 삭제. */
  | "delete_objects"
  /** 선택 — `--include-source-url`. */
  | "clear_source_image_url"
  /** 선택 — `--local`. */
  | "delete_local"
  /** 4단계 — 표본 20건에 GET해 404 확인. */
  | "verify_sample"
  /** 5단계 — 리포트. */
  | "write_report";

/**
 * 실행 순서를 **값으로** 낸다.
 *
 * 🚨 **`clear_image_url`이 `delete_objects`보다 앞이라는 것이 이 함수의 전부이고,
 * 그것을 주석이 아니라 테스트가 지킨다.** 순서가 뒤집히면 **파일은 없는데 DB가
 * 아직 URL을 가리키는 창**이 생기고, 그동안 화면이 404를 그린다(§9.4 ⓕ-4).
 * ⚠️ `source_image_url`은 URL 문자열일 뿐 화면이 쓰지 않으므로 순서에 민감하지
 * 않다 — 그래서 뒤에 둔다.
 */
export function purgeSteps(plan: PurgePlan): readonly PurgeStep[] {
  const steps: PurgeStep[] = ["clear_image_url", "delete_objects"];
  if (plan.includeSourceUrl) {
    steps.push("clear_source_image_url");
  }
  if (plan.local) {
    steps.push("delete_local");
  }
  steps.push("verify_sample", "write_report");
  return steps;
}

/**
 * 표본 검증 대상(ⓔ). **무작위 20건**이므로 `rng`를 인자로 받는다 — 시계나
 * `Math.random`에 묶이면 테스트가 불가능해진다.
 */
export function pickVerifySample(
  objects: readonly BucketObject[],
  rng: () => number = Math.random,
  size: number = PURGE_VERIFY_SAMPLE_SIZE,
): readonly string[] {
  const pool = objects.map((object) => object.name);
  // Fisher–Yates를 앞에서 size개만큼만 돌린다.
  for (let i = 0; i < Math.min(size, pool.length); i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(size, pool.length));
}

// ─── 출력 ──────────────────────────────────────────────────────────────────

function describeRange(range: PurgeRange): string {
  if (range.scope === "all") return "all";
  if (range.scope === "game") return `game=${range.game}`;
  return `game=${range.game} set=${range.setCode}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/** 드라이런 출력(ⓑ) — 객체 수 · 경로 접두사 · 샘플 20건 · 결론 한 줄. */
export function formatPurgePlan(plan: PurgePlan, conclusion: PurgeConclusion): string {
  const lines: string[] = [];

  lines.push("═══ 이미지 회수 드라이런 (T1.21) ═══");
  lines.push("");
  lines.push(`범위        : ${describeRange(plan.range)}`);
  lines.push(`경로 접두사  : ${plan.prefix === "" ? "(버킷 전체)" : plan.prefix}`);
  lines.push("");
  lines.push(`버킷 객체    : ${plan.objectCount}건 (${formatBytes(plan.totalBytes)})`);
  lines.push(`카드 행      : 범위 ${plan.cardCount}행 중 image_url이 있는 것 ${plan.imageUrlToClear}행`);
  lines.push(
    `source_image_url : ${plan.includeSourceUrl ? `${plan.sourceUrlToClear}행 (--include-source-url)` : "건드리지 않는다 (기본)"}`,
  );
  lines.push(
    `로컬 data/images : ${plan.local ? `${plan.localFileCount}개 (--local)` : "건드리지 않는다 (기본)"}`,
  );
  lines.push("");
  lines.push(`샘플 (최대 ${PURGE_SAMPLE_SIZE}건)`);
  if (plan.sample.length === 0) {
    lines.push("    (없다)");
  } else {
    for (const name of plan.sample) {
      lines.push(`    ${name}`);
    }
  }
  lines.push("");
  lines.push("실행 순서 — 🚨 DB를 먼저 비우고 버킷을 지운다 (§9.4 ⓕ-4)");
  purgeSteps(plan).forEach((step, index) => {
    lines.push(`    ${index + 1}. ${step}`);
  });
  lines.push("");
  lines.push(conclusion.line);

  return lines.join("\n");
}
