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
