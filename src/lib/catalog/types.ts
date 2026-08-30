/**
 * 카탈로그 수집기(T1.16) 타입 전용 모듈 — plan §4.8 ⓚ-1 · ⓚ-2.
 *
 * 값을 내보내지 않는다. 상수는 각자 쓰는 모듈에 둔다(ⓚ-1).
 */

/**
 * 원천 목록 행 1건. 15필드를 받은 그대로 옮긴다 — 해석은 하지 않는다.
 *
 * 🚨 전 필드가 `string`이다. 숫자로 파싱하지 않는다 — `"-"`·`""`·`"0"`의
 * 구분이 파일에서 사라지면 그 구분이 필요한 T1.17 판단이 불가능해진다.
 */
export interface CollectedCard {
  readonly sourceSetLabel: string; // cardGet
  readonly code: string; // cardNumber   ★ 비어 있으면 안 되는 유일한 값
  readonly nameKo: string; // cardName
  readonly cardType: string; // cardType
  readonly colorRaw: string; // cardColor        "녹색,황색"
  readonly lifeRaw: string; // life        🚨 리더=라이프 / 그 외=코스트 (ⓙ 발견 A)
  readonly powerRaw: string; // power            "-" 가능
  readonly counterRaw: string; // cardCounter      "-" 가능
  readonly attribute: string; // cardAttr         "" 가능
  readonly traitsRaw: string; // cardPoint        "특징가/특징나"
  readonly rarity: string; // rarity
  readonly effectText: string; // cardText         \r\n 포함
  readonly triggerText: string; // cardTrigger      "" 가능
  readonly illustrationType: string; // animationType
  readonly blockNumberRaw: string; // blockNumber
  readonly imagePath: string; // img.src     ★ 상대 경로 그대로
  readonly page: number; // 몇 페이지에서 나왔는가 (재실행 skip 판정용)
}

/** 매니페스트 요청 로그 1건. */
export interface CollectRequestLog {
  readonly url: string;
  readonly startedAt: string; // ISO
  readonly status: number | null; // null = 네트워크 실패 · 타임아웃
  readonly durationMs: number;
  readonly rows: number | null; // 목록 요청이 아니면 null
  readonly attempt: number; // 1 = 최초, 2·3 = 재시도
}

export type CollectStopReason =
  | "completed"
  | "max_requests"
  | "consecutive_failures"
  | "forbidden"
  | "rate_limited"
  | "robots_changed"
  | "parser_zero_rows"
  // 셀렉터 옵션에서 --set에 해당하는 라벨을 찾지 못했다(0개·2개 이상). 네트워크
  // 연속 실패가 아니라 인자·원천 불일치이므로 consecutive_failures와 갈랐다
  // (리뷰 결함 4).
  | "set_not_found"
  // page=0을 어떤 경로로도(직접 요청도, 매니페스트 복구도) lastPageIndex로
  // 확정하지 못했다. 이 상태로 "completed"를 보고하지 않는다(리뷰 결함 2).
  | "page_zero_unavailable";

/** 매니페스트 — 실행 1회의 감사 기록. 커밋하지 않으므로 이 파일이 유일한 증거다(ⓓ). */
export interface CollectRun {
  readonly schemaVersion: 1;
  readonly parserVersion: string; // parse.ts의 상수. 마크업 대응을 고치면 올린다
  readonly game: string; // --game
  readonly sourceSetCode: string; // --set  (OPK-14)
  readonly sourceSetLabel: string; // 셀렉터에서 해석한 전체 문자열 ★ set이 아니라 sourceSet
  readonly host: string;
  readonly userAgent: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly robots: { readonly url: string; readonly status: number; readonly checkedAt: string };
  readonly pageSize: 20;
  readonly lastPageIndex: number | null;
  readonly requests: readonly CollectRequestLog[]; // ★ 요청 전량. 요약하지 않는다
  readonly requestCount: number;
  readonly maxRequests: number;
  readonly failureCount: number;
  readonly rowCount: number;
  readonly outFile: string;
  readonly outFileSha256: string; // ★ ⓕ 관문 3의 --from-report가 대조할 값의 원천
  readonly stoppedBy: CollectStopReason;
}

// ─── 계열 단위 실행 (T1.24 · plan §4.10) ───────────────────────────────────
// 🚨 가산만 한다. 위의 `CollectRun`·`CollectRequestLog`는 T1.16이 고정한
// 계약이고 계열 확장이 그 의미를 바꾸지 않는다(§4.10 ⓗ).

/**
 * 계열 실행에서 세트 하나가 놓이는 자리.
 *
 * - `pending` 아직 차례가 오지 않았다 (실행 중에만 존재)
 * - `skipped_complete` 이미 전 페이지를 받아 **요청 0회로** 건너뛰었다
 * - `done` 이번 실행에서 완주했다
 * - `partial` 받다가 예산·규율에 걸려 끊겼다. 다음 실행이 이어받는다
 * - `failed` 이 세트 때문에 계열이 멈췄다 (ⓘ-2)
 * - `not_started` 계열이 먼저 멈춰 **한 번도 시도되지 않았다**
 *
 * 🚨 `partial`과 `not_started`를 가르는 것이 이 타입의 요점이다 — 둘을 섞으면
 * 「어디까지 받았는가」가 기록에서 사라진다.
 */
export type SeriesSetStatus =
  | "pending"
  | "skipped_complete"
  | "done"
  | "partial"
  | "failed"
  | "not_started";

/** 계열 매니페스트가 세트 하나에 대해 남기는 것. **요청 전량은 담지 않는다.** */
export interface SeriesSetOutcome {
  readonly setCode: string;
  readonly status: SeriesSetStatus;
  /** 세트 매니페스트 **파일명**. 요약이 원본을 대신하지 않게 가리키기만 한다(§4.10 ⓓ). */
  readonly manifestFile: string | null;
  readonly rowCount: number;
  readonly stoppedBy: CollectStopReason | null;
}

/**
 * 계열 매니페스트 — `data/catalog/<game>/_runs/series-<stamp>.json` (T1.24 ⓜ).
 *
 * 🚨 **승인 단위와 감사 단위를 맞추는 것이 존재 이유다.** 승인은 계열 단위
 * (`--sets` + `--max-requests` 한 쌍)로 이뤄지는데 기록이 세트 단위밖에 없으면
 * 나중에 「이게 한 번의 승인이었는지 39번이었는지」를 추론하게 된다(§4.10 ⓓ).
 */
export interface SeriesRun {
  readonly schemaVersion: 1;
  readonly game: string;
  /** 사람이 실제로 친 인자 원문. 이것이 승인의 사본이다. */
  readonly argv: readonly string[];
  /** 대상 세트 목록 — **입력 순서 그대로**(ⓕ). */
  readonly targetSets: readonly string[];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly sets: readonly SeriesSetOutcome[];
  /** 상한에 세는 시도 수. robots는 여기 들어가지 않는다. */
  readonly requestCount: number;
  readonly maxRequests: number;
  /** 🚨 상한 **밖** robots 요청 수. 총 트래픽이 늘어난 것을 숨기지 않는다(§4.10 ⓑ). */
  readonly robotsChecks: number;
  readonly notStarted: readonly string[];
  readonly stoppedBy: CollectStopReason;
}

// ─── 이미지 수집 (T1.20 · plan §9.4 ⓕ) ─────────────────────────────────────
// 🚨 가산만 한다. 위의 `CollectRun`·`SeriesRun`은 T1.16·T1.24가 고정한 계약이고
// 이미지 확장이 그 의미를 바꾸지 않는다(§4.10 ⓗ와 같은 자세).

/** 이미지 요청 1건의 기록. */
export interface ImageRequestLog {
  readonly url: string;
  /** 🚨 응답이 실제로 도착한 URL. 리다이렉트를 숨기지 않는다 (ⓑ-3). */
  readonly finalUrl: string | null;
  readonly startedAt: string;
  readonly status: number | null;
  readonly durationMs: number;
  /** 원본 바이트. 측정 3(§9.4 ⓕ-9)의 재료다. */
  readonly bytes: number | null;
  /** webp 변환 후 바이트. 변환 전 실패면 null. */
  readonly webpBytes: number | null;
  readonly attempt: number;
}

export type ImageStopReason =
  | CollectStopReason
  /** 🚨 ⓑ-3 — 승인된 호스트가 아닌 곳에 응답이 도착했다. 즉시 전체 중단. */
  | "final_host_mismatch"
  /** 승인이 없어 요청을 한 건도 내보내지 않았다. 실패가 아니라 **설계된 정지**다. */
  | "not_approved";

/**
 * 이미지 수집 매니페스트 — `data/images/<game>/_runs/images-<stamp>.json`.
 *
 * **완주든 중단이든 항상 쓴다**(T1.20 ⓔ · §4.8 ⓓ). `data/`는 커밋되지 않으므로
 * 이 파일이 실행의 유일한 증거다.
 */
export interface ImageRun {
  readonly schemaVersion: 1;
  readonly game: string;
  readonly setCodes: readonly string[];
  /** 사람이 실제로 친 인자 원문. **이것이 승인의 사본이다.** */
  readonly argv: readonly string[];
  /** 🚨 승인된 호스트. 빈 배열이면 요청이 한 건도 나가지 않았다는 뜻이다. */
  readonly approvedHosts: readonly string[];
  /** 절대화에 쓴 base와 **그 출처**. 코드에 박은 값이 아님을 기록으로 남긴다(명세 3). */
  readonly baseOrigin: string;
  readonly baseSource: string;
  readonly userAgent: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly robots: { readonly url: string; readonly status: number; readonly checkedAt: string };
  readonly delayMs: number;
  readonly jitterMs: number;
  readonly webp: { readonly maxEdgePx: number; readonly quality: number };
  /** ★ 요청 전량. 요약하지 않는다(§4.8 ⓓ). */
  readonly requests: readonly ImageRequestLog[];
  readonly requestCount: number;
  readonly maxRequests: number;
  readonly failureCount: number;
  readonly savedCount: number;
  readonly skippedCount: number;
  readonly invalidCount: number;
  readonly hostDeniedCount: number;
  readonly stoppedBy: ImageStopReason;
}
