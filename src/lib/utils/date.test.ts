import { describe, expect, it } from "vitest";

import { formatKoreanDate } from "@/lib/utils/date";

describe("formatKoreanDate", () => {
  it("KST 기준으로 표기한다", () => {
    expect(formatKoreanDate("2026-08-23T05:00:00.000Z")).toBe("2026년 8월 23일");
  });

  // UTC 15:00 = KST 익일 00:00. 타임존을 고정하지 않으면 여기서 하루가 밀린다.
  it("UTC 자정 경계에서도 KST 날짜를 낸다", () => {
    expect(formatKoreanDate("2026-08-23T15:00:00.000Z")).toBe("2026년 8월 24일");
    expect(formatKoreanDate("2026-08-23T14:59:59.000Z")).toBe("2026년 8월 23일");
  });
});
