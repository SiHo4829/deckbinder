/**
 * 한국 날짜 표기.
 *
 * 타임존을 고정하지 않으면 서버(UTC)에서 프리렌더된 날짜와
 * 브라우저(KST)에서 렌더된 날짜가 하루 어긋난다.
 */
export function formatKoreanDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}
