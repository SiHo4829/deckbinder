import { describe, expect, it } from "vitest";

import { resolvePublishedAt } from "@/lib/news/publish";

const NOW = new Date("2026-08-23T10:00:00.000Z");
const EARLIER = "2026-08-01T09:00:00.000Z";

describe("resolvePublishedAt", () => {
  it("발행하지 않으면 null이다 (초안)", () => {
    expect(resolvePublishedAt(false, null, NOW)).toBeNull();
  });

  it("발행 취소하면 기존 시각이 있어도 null이 된다", () => {
    expect(resolvePublishedAt(false, EARLIER, NOW)).toBeNull();
  });

  // 정확히 NOW를 찍으면 안 된다. 공개 조회 RLS의 `published_at <= now()`는
  // DB 시계를 보는데 여기 NOW는 앱 시계라, 앱이 앞선 만큼 방금 발행한 글이
  // anon 조회에서 막힌다(§2.7 — 실측 0.4~0.9초). 과거로 마진을 둔다.
  it("처음 발행하면 현재보다 과거 시각이 들어간다 — 시계 차이 마진", () => {
    const result = resolvePublishedAt(true, null, NOW)!;

    expect(new Date(result).getTime()).toBeLessThan(NOW.getTime());
    expect(NOW.getTime() - new Date(result).getTime()).toBeGreaterThanOrEqual(1_000);
  });

  it("마진은 날짜가 바뀔 만큼 크지 않다", () => {
    const result = resolvePublishedAt(true, null, NOW)!;

    expect(result.slice(0, 10)).toBe("2026-08-23");
  });

  // 이미 발행된 글을 수정할 때 발행 시각이 밀리면
  // 목록 정렬이 뒤집히고 "최신 글"이 잘못 표시된다.
  it("이미 발행된 글을 다시 저장해도 발행 시각을 보존한다", () => {
    expect(resolvePublishedAt(true, EARLIER, NOW)).toBe(EARLIER);
  });

  it("예약 발행 시각도 그대로 보존한다", () => {
    const future = "2026-12-25T00:00:00.000Z";
    expect(resolvePublishedAt(true, future, NOW)).toBe(future);
  });
});
