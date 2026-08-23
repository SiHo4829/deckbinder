import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseEnv } from "@/lib/env";

const schema = z.object({
  SITE_URL: z.url(),
  API_KEY: z.string().min(1),
});

describe("parseEnv", () => {
  it("유효한 값을 파싱해 반환한다", () => {
    const result = parseEnv(schema, {
      SITE_URL: "https://example.com",
      API_KEY: "abc",
    });

    expect(result).toEqual({
      SITE_URL: "https://example.com",
      API_KEY: "abc",
    });
  });

  it("누락된 키를 에러 메시지에 모두 나열한다", () => {
    expect(() => parseEnv(schema, {})).toThrowError(/SITE_URL/);
    expect(() => parseEnv(schema, {})).toThrowError(/API_KEY/);
  });

  it("형식이 잘못된 값을 키와 함께 보고한다", () => {
    expect(() =>
      parseEnv(schema, { SITE_URL: "not-a-url", API_KEY: "abc" }),
    ).toThrowError(/SITE_URL/);
  });

  it("빈 문자열은 미설정으로 간주해 거부한다", () => {
    expect(() =>
      parseEnv(schema, { SITE_URL: "https://example.com", API_KEY: "" }),
    ).toThrowError(/API_KEY/);
  });

  it("에러 메시지에 라벨을 포함해 어느 환경변수 묶음인지 알린다", () => {
    expect(() => parseEnv(schema, {}, "서버")).toThrowError(/서버/);
  });
});
