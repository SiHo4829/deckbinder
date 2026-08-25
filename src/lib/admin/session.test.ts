import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { adminCookieValue, isValidAdminCookie, isValidAdminToken } from "@/lib/admin/session";

/**
 * `session.ts`는 인터넷과 service_role 쓰기 사이의 유일한 방벽인데 지금까지
 * E2E의 401 확인으로만 간접 검증됐다(plan §8 T1.12-5). `adminToken()`은
 * `process.env`를 모듈 로드 시가 아니라 **호출 시** 읽으므로, 모듈을 리셋하지
 * 않고 `vi.stubEnv`로 케이스마다 값을 갈아끼울 수 있다.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ADMIN_TOKEN 설정 검증", () => {
  it("비어 있으면 던진다", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(() => isValidAdminToken("x")).toThrowError(/ADMIN_TOKEN/);
  });

  it("16자 미만이면 던진다", () => {
    vi.stubEnv("ADMIN_TOKEN", "a".repeat(15));
    expect(() => isValidAdminToken("x")).toThrowError(/16자 이상/);
  });

  it("정확히 16자면 통과한다(경계값)", () => {
    vi.stubEnv("ADMIN_TOKEN", "a".repeat(16));
    expect(() => isValidAdminToken("a".repeat(16))).not.toThrow();
  });
});

describe("isValidAdminToken", () => {
  it("정확히 일치하면 true다", () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-token-1234567890");
    expect(isValidAdminToken("correct-token-1234567890")).toBe(true);
  });

  it("한 글자만 달라도 false다", () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-token-1234567890");
    expect(isValidAdminToken("correct-token-1234567891")).toBe(false);
  });

  it("길이가 다른 입력은 예외 없이 false다 (safeEqual 길이 가드 — 지우면 401이 500이 된다)", () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-token-1234567890");

    expect(() => isValidAdminToken("short")).not.toThrow();
    expect(isValidAdminToken("short")).toBe(false);
    expect(
      isValidAdminToken("way-too-long-compared-to-the-configured-token-value"),
    ).toBe(false);
    expect(isValidAdminToken("")).toBe(false);
  });
});

describe("adminCookieValue / isValidAdminCookie", () => {
  it("쿠키 값은 토큰의 sha256 해시다 (원문을 저장하지 않는다)", () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-token-1234567890");
    const expected = createHash("sha256")
      .update("correct-token-1234567890")
      .digest("hex");

    expect(adminCookieValue()).toBe(expected);
    expect(adminCookieValue()).not.toContain("correct-token-1234567890");
  });

  it("해시가 일치하는 쿠키는 통과한다", () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-token-1234567890");
    expect(isValidAdminCookie(adminCookieValue())).toBe(true);
  });

  it("1글자만 달라도 거부한다", () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-token-1234567890");
    const hash = adminCookieValue();
    const tampered = `${hash.slice(0, -1)}${hash.endsWith("0") ? "1" : "0"}`;

    expect(isValidAdminCookie(tampered)).toBe(false);
  });

  it("쿠키가 없으면 거부한다", () => {
    vi.stubEnv("ADMIN_TOKEN", "correct-token-1234567890");
    expect(isValidAdminCookie(undefined)).toBe(false);
  });
});
