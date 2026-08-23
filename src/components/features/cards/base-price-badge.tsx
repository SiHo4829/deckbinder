/**
 * 단일 기준가 표기.
 *
 * plan P6: 시세 변동 차트·스파크라인·등락률을 만들지 않는다.
 * 값이 없으면 추정치를 보여주지 않고 "산출 불가"로 둔다 (§4.3 규칙 5).
 */
export function BasePriceBadge({
  priceKrw,
  collectedAt,
}: {
  priceKrw: number | null;
  collectedAt: string | null;
}) {
  if (priceKrw === null) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-xs text-muted-foreground">기준가</p>
        <p className="mt-1 text-sm text-muted-foreground">산출 불가</p>
        <p className="mt-1 text-xs text-muted-foreground">
          거래 표본이 모이면 기준가를 표시합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">기준가</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {priceKrw.toLocaleString("ko-KR")}
        <span className="ml-1 text-base font-normal text-muted-foreground">원</span>
      </p>
      {collectedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(collectedAt).toLocaleDateString("ko-KR")} 기준
        </p>
      ) : null}
    </div>
  );
}
