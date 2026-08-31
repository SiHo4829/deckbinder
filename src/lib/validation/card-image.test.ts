import { describe, expect, it } from "vitest";

import {
  DOWNNAME_PATTERNS,
  checkFinalHost,
  decideHost,
  downnameFormat,
  hostOf,
  isValidDownname,
  sniffImageFormat,
} from "./card-image";

// ─── downname 형식 (T1.29 ⓐ · ⓕ · §3.5) ───────────────────────────────────

/** 08-31 전수 실측에서 실제로 나온 값들. **지어낸 값이 아니다.** */
const REAL = {
  A: "202404240732471520",
  B: "20250619_183626_9012333d90",
  C: "20260720_133222_f6f63859f7e04962a60da06c95a397f1",
} as const;

describe("downname 형식 — 셋이고, 셋뿐이다 (2026-08-31 전수 실측)", () => {
  it("A(18자리 숫자) · B(hex10) · C(hex32) 셋 다 통과한다", () => {
    expect(isValidDownname(REAL.A)).toBe(true);
    expect(isValidDownname(REAL.B)).toBe(true);
    expect(isValidDownname(REAL.C)).toBe(true);
  });

  it("형식을 구분해 돌려준다 — 🚨 T1.30의 불일치 카운터가 이 함수를 쓴다", () => {
    expect(downnameFormat(REAL.A)).toBe("A");
    expect(downnameFormat(REAL.B)).toBe("B");
    expect(downnameFormat(REAL.C)).toBe("C");
    expect(downnameFormat("nope")).toBeNull();
  });

  it("패턴이 정확히 셋이다 — 넷째가 늘면 이 테스트가 먼저 깨진다", () => {
    expect(DOWNNAME_PATTERNS).toHaveLength(3);
    expect(DOWNNAME_PATTERNS.map((p) => p.format)).toEqual(["A", "B", "C"]);
  });

  it("🚨 정규식에 g 플래그가 없다 — 있으면 lastIndex 때문에 같은 값이 번갈아 통과/실패한다", () => {
    for (const { pattern } of DOWNNAME_PATTERNS) {
      expect(pattern.global).toBe(false);
    }
    // 같은 값을 두 번 물어도 답이 같아야 한다.
    expect(isValidDownname(REAL.B)).toBe(isValidDownname(REAL.B));
  });
});

describe("downname — 🚨 오픈 릴레이 방어 겹 2. 거부가 본체다", () => {
  it("경로·쿼리 문자가 통과하지 못한다", () => {
    for (const bad of [
      "../../etc/passwd",
      "2024042407324715/20",
      "202404240732471520?x=1",
      "202404240732471520#a",
      "%2e%2e%2f",
      "20250619_183626_9012333d90/../x",
      "..",
      "/",
    ]) {
      expect(isValidDownname(bad), bad).toBe(false);
    }
  });

  it("길이 ±1이 전부 거부된다 (18 · 26 · 48 각각)", () => {
    expect(isValidDownname("20240424073247152")).toBe(false); // 17
    expect(isValidDownname("2024042407324715201")).toBe(false); // 19
    expect(isValidDownname("20250619_183626_9012333d9")).toBe(false); // 25
    expect(isValidDownname("20250619_183626_9012333d90a")).toBe(false); // 27
    expect(isValidDownname(REAL.C.slice(0, -1))).toBe(false); // 47
    expect(isValidDownname(`${REAL.C}a`)).toBe(false); // 49
  });

  it("🚨 형식 사이의 「비슷하지만 아닌 것」을 거부한다 — hex16은 B와 C 사이다", () => {
    expect(isValidDownname("20260720_133222_f6f63859f7e04962")).toBe(false);
  });

  it("hex 자리에 hex가 아닌 글자가 오면 거부한다", () => {
    expect(isValidDownname("20250619_183626_9012333dzz")).toBe(false);
  });

  it("대문자 hex는 통과한다 — 미실측이라 관대하게 받되 길이는 그대로다", () => {
    expect(isValidDownname("20250619_183626_9012333D90")).toBe(true);
    expect(isValidDownname(REAL.C.toUpperCase())).toBe(true);
  });

  it("A는 숫자만이다 — 18자라도 hex 글자가 섞이면 거부한다", () => {
    expect(isValidDownname("20240424073247152a")).toBe(false);
  });

  it("빈 문자열 · 공백 · 개행이 거부된다", () => {
    expect(isValidDownname("")).toBe(false);
    expect(isValidDownname("   ")).toBe(false);
    // 🚨 JS의 `$`는 끝 개행을 봐주지 않지만, 그것을 테스트가 못박는다.
    expect(isValidDownname(`${REAL.A}\n`)).toBe(false);
    expect(isValidDownname(` ${REAL.A}`)).toBe(false);
  });

  it("⚠️ 트림하지 않는다 — 공백을 지워 주는 순간 캐시 키가 둘로 갈린다", () => {
    expect(isValidDownname(`${REAL.A} `)).toBe(false);
  });
});

// ─── 호스트 판정 (images.ts에서 옮겨 온 것) ───────────────────────────────

describe("hostOf", () => {
  it("URL의 호스트를 돌려준다", () => {
    expect(hostOf("https://onepiece-cardgame.kr/fileDownload?downname=x")).toBe(
      "onepiece-cardgame.kr",
    );
  });

  it("파싱되지 않으면 null이다", () => {
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("decideHost — 🚨 빈 화이트리스트는 「전부 허용」이 아니라 「전부 거부」다", () => {
  const ALLOW = ["onepiece-cardgame.kr"];

  it("승인이 없으면(빈 목록) 거부한다 — 이 성질이 그대로 킬 스위치가 된다", () => {
    const d = decideHost("https://onepiece-cardgame.kr/x", []);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("empty_allowlist");
  });

  it("목록에 있으면 허용한다", () => {
    expect(decideHost("https://onepiece-cardgame.kr/x", ALLOW).allowed).toBe(true);
  });

  it("목록에 없으면 거부한다", () => {
    const d = decideHost("https://evil.test/x", ALLOW);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("not_allowlisted");
  });

  it("파싱 불가는 거부한다", () => {
    expect(decideHost("nope", ALLOW).reason).toBe("unparsable");
  });
});

describe("checkFinalHost — 승인한 것은 출발지이지 도착지가 아니다", () => {
  const ALLOW = ["onepiece-cardgame.kr"];

  it("같은 호스트에 도착하면 ok다", () => {
    expect(
      checkFinalHost("https://onepiece-cardgame.kr/a", "https://onepiece-cardgame.kr/b", ALLOW).ok,
    ).toBe(true);
  });

  it("🚨 다른 호스트로 리다이렉트되면 거부한다 — 원천이 하나 느는 것과 같은 형태다", () => {
    const c = checkFinalHost("https://onepiece-cardgame.kr/a", "https://cdn.evil.test/b", ALLOW);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe("redirected_offsite");
  });
});

// ─── 포맷 판정 (헤더는 의견이고 매직 바이트는 관측이다) ───────────────────

describe("sniffImageFormat — 합성 바이트로 고정한다", () => {
  function bytes(...parts: (number | string)[]): Uint8Array {
    const out: number[] = [];
    for (const p of parts) {
      if (typeof p === "number") out.push(p);
      else for (const ch of p) out.push(ch.charCodeAt(0));
    }
    return Uint8Array.from(out);
  }

  it("RIFF….WEBP를 webp로 읽는다", () => {
    expect(sniffImageFormat(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("webp");
  });

  it("PNG 시그니처를 png로 읽는다 — 🚨 원천이 실제로 png를 준다(08-31 실측)", () => {
    expect(sniffImageFormat(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
  });

  it("JPEG · GIF를 읽는다", () => {
    expect(sniffImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImageFormat(bytes("GIF89a"))).toBe("gif");
  });

  it("🚨 이미지가 아니면 null이다 — 원천은 에러 HTML을 200으로 줄 수 있다", () => {
    expect(sniffImageFormat(bytes("<!DOCTYPE html>"))).toBeNull();
  });

  it("너무 짧은 바이트에서 터지지 않는다", () => {
    expect(sniffImageFormat(bytes())).toBeNull();
    expect(sniffImageFormat(bytes("RI"))).toBeNull();
  });

  it("⚠️ RIFF지만 WEBP가 아닌 것(예: wav)을 webp라 하지 않는다", () => {
    expect(sniffImageFormat(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeNull();
  });
});
