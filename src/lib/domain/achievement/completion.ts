// 도감 완성도 — 도메인 순수 함수 (plan §4.13 ⓔ).
//
// localStorage도 fetch도 카드 DB 타입도 모른다. 저장소는 owned-store.ts가
// 지고 이 파일은 계산만 한다 — 갈라 둔 이유는 하나다: 나중에 계정 기반
// (T3.2 collection_items)으로 옮길 때 로직을 두 벌로 만들지 않기 위해서다.
// 순수 함수라 저장소가 바뀌어도 여기는 옮길 것이 없다.
//
// 묶음의 단위는 셋이다 — 세트 · 게임 · 그룹. 이 함수는 그중 무엇인지 모른다.
// universe를 받을 뿐이고 호출부가 정한다.

export interface CompletionInput {
  /** 이 묶음에 속한 카드 키 전량. 중복이 있어도 된다 — 함수가 유일화한다. */
  readonly universe: readonly string[];
  /** 사용자가 가졌다고 표시한 키. universe 밖의 값이 섞여 있어도 된다. */
  readonly owned: readonly string[];
}

export interface CompletionResult {
  readonly total: number;
  readonly ownedCount: number;
  /** 0~1. total이 0이면 null이다 — 0/0을 1이나 0으로 만들지 않는다. */
  readonly ratio: number | null;
  readonly missing: readonly string[];
  /** universe 밖인데 owned에 있는 것. 버리지 않고 센다 — §4.13 ⓔ-4. */
  readonly strays: readonly string[];
}

/**
 * 한 묶음의 완성도.
 *
 * 묻는 것은 "가졌는가" 하나다. 수량 · 상태 등급 · 구매가는 묻지 않는다 —
 * 셋 다 collection_items(T3.2)의 컬럼이고, 지금 물으면 localStorage에
 * 스키마가 쌓이기 시작한다. 마이그레이션 없는 마이그레이션이 된다 (§4.13 ⓔ-5).
 */
export function completion({ universe, owned }: CompletionInput): CompletionResult {
  const universeKeys = new Set(universe);
  const ownedKeys = new Set(owned);

  const missing: string[] = [];
  for (const key of universeKeys) {
    if (!ownedKeys.has(key)) missing.push(key);
  }

  // universe 밖의 소유 표시. 카탈로그가 늘거나 줄면 생긴다(세트 재적재 ·
  // A-7의 커버리지 구멍). 조용히 지우면 사용자의 체크가 이유 없이 사라지고,
  // 그 사고는 늦게 발견된다 — purge.ts의 "0건은 초록이 아니다"와 같은 종류다.
  const strays: string[] = [];
  for (const key of ownedKeys) {
    if (!universeKeys.has(key)) strays.push(key);
  }

  const total = universeKeys.size;
  const ownedCount = total - missing.length;

  return {
    total,
    ownedCount,
    ratio: total === 0 ? null : ownedCount / total,
    missing,
    strays,
  };
}
