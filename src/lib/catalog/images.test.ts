/**
 * 이미지 수집기의 **판단** 전량을 고정한다 — plan §8 T1.20 완료 기준 ⓗ.
 *
 * 🚨 이 파일이 있는 이유는 `series.test.ts`와 같다: 이 프로젝트는 판단을
 * `scripts/`에 두어 결함을 다섯 번 냈고 전부 **테스트가 붙지 않는 자리**였다.
 * 특히 여기서 증명해야 하는 것이 하나 있다 — **승인이 없을 때 요청이 나가지
 * 않는다**(ⓑ-2). 그것은 실제로 원천에 요청해 볼 수 없는 종류의 규율이므로
 * 문서가 아니라 이 파일이 증명한다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  absolutizeImagePath,
  approvalSentence,
  backupRelPath,
  buildHostSurvey,
  buildImageRun,
  checkFinalHost,
  classifyImagePath,
  decideHost,
  decideResponse,
  extractDownname,
  formatHostSurvey,
  hostOf,
  IMAGE_DELAY_MS,
  IMAGE_JITTER_MS,
  imageRelPath,
  isValidPathSegment,
  nextImageDelayMs,
  originalRelPath,
  planImageFetches,
  sniffImageFormat,
  WEBP_PARAMS,
  type ImageTarget,
} from "./images";
import { nextDelayMs } from "./pace";
import type { ImageRequestLog } from "./types";

const ORIGIN = "https://onepiece-cardgame.kr";
const ALLOWED = ["onepiece-cardgame.kr"];

/** 실물과 같은 모양의 행. 40세트 3,146행이 전부 이 형태다(2026-08-30 실측). */
function target(code: string, downname = code.toLowerCase(), setCode = "OPK-14"): ImageTarget {
  return { setCode, code, imagePath: `/fileDownload?downname=${downname}` };
}

describe("classifyImagePath", () => {
  it("루트 상대 경로를 root_relative로 읽는다 — 실물 3,146행의 형태다", () => {
    expect(classifyImagePath("/fileDownload?downname=abc")).toBe("root_relative");
  });

  it("절대 URL을 absolute로 읽는다 — 프로토콜 대소문자를 가리지 않는다", () => {
    expect(classifyImagePath("https://cdn.example.com/a.png")).toBe("absolute");
    expect(classifyImagePath("HTTP://cdn.example.com/a.png")).toBe("absolute");
  });

  it("🚨 프로토콜 상대(//)를 루트 상대로 오분류하지 않는다", () => {
    // 순서가 반대면 다른 호스트가 우리 호스트로 둔갑한다.
    expect(classifyImagePath("//cdn.example.com/a.png")).toBe("protocol_relative");
  });

  it("빈 값과 공백만 있는 값을 empty로 읽는다", () => {
    expect(classifyImagePath("")).toBe("empty");
    expect(classifyImagePath("   ")).toBe("empty");
  });

  it("그 밖의 상대 경로를 other로 읽는다", () => {
    expect(classifyImagePath("images/a.png")).toBe("other");
    expect(classifyImagePath("./a.png")).toBe("other");
    expect(classifyImagePath("data:image/png;base64,AAAA")).toBe("other");
  });
});

describe("extractDownname", () => {
  it("downname 쿼리값을 뽑는다", () => {
    expect(extractDownname("/fileDownload?downname=20260813_171017_cf3af7")).toBe(
      "20260813_171017_cf3af7",
    );
  });

  it("쿼리가 없거나 downname이 없으면 null이다", () => {
    expect(extractDownname("/fileDownload")).toBeNull();
    expect(extractDownname("/fileDownload?other=1")).toBeNull();
  });

  it("🚨 빈 downname은 null이다 — 빈 문자열을 고유값으로 세면 장수가 부풀려진다", () => {
    expect(extractDownname("/fileDownload?downname=")).toBeNull();
    expect(extractDownname("/fileDownload?downname=%20")).toBeNull();
  });

  it("다른 파라미터가 섞여 있어도 뽑는다", () => {
    expect(extractDownname("/fileDownload?a=1&downname=xyz&b=2")).toBe("xyz");
  });
});

describe("absolutizeImagePath · hostOf", () => {
  it("루트 상대 경로를 base에 붙인다", () => {
    expect(absolutizeImagePath("/fileDownload?downname=abc", ORIGIN)).toBe(
      "https://onepiece-cardgame.kr/fileDownload?downname=abc",
    );
  });

  it("🚨 base가 인자다 — 다른 base를 주면 다른 호스트가 나온다", () => {
    // 모듈이 호스트를 박아 두고 있다면 이 테스트가 깨진다. 그것이 요점이다:
    // 코드에 박은 호스트로 만든 결과는 집계가 아니라 선언이다(명세 3).
    expect(hostOf(absolutizeImagePath("/x", "https://other.example") ?? "")).toBe("other.example");
  });

  it("절대 URL은 base를 무시하고 그대로 남는다", () => {
    expect(absolutizeImagePath("https://cdn.example.com/a.png", ORIGIN)).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("빈 값은 null이다", () => {
    expect(absolutizeImagePath("", ORIGIN)).toBeNull();
  });

  it("해석 불가한 base면 null이다 — 던지지 않는다", () => {
    expect(absolutizeImagePath("/x", "not-a-url")).toBeNull();
    expect(hostOf("not-a-url")).toBeNull();
  });
});

describe("decideHost — ⓑ-2 화이트리스트", () => {
  it("🚨 빈 화이트리스트는 전부 거부한다 — 승인이 없는 지금의 상태다", () => {
    const decision = decideHost("https://onepiece-cardgame.kr/x", []);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("empty_allowlist");
    // 거부하면서도 호스트는 알려 준다 — 그것이 승인의 재료다.
    expect(decision.host).toBe("onepiece-cardgame.kr");
  });

  it("승인된 호스트는 통과한다", () => {
    expect(decideHost("https://onepiece-cardgame.kr/x", ALLOWED)).toEqual({
      allowed: true,
      host: "onepiece-cardgame.kr",
      reason: "allowed",
    });
  });

  it("승인되지 않은 호스트는 거부한다 — 목록에 하나가 있어도 다른 것은 막힌다", () => {
    const decision = decideHost("https://cdn.example.com/x", ALLOWED);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("not_allowlisted");
  });

  it("서브도메인은 자동으로 포함되지 않는다", () => {
    expect(decideHost("https://cdn.onepiece-cardgame.kr/x", ALLOWED).allowed).toBe(false);
  });

  it("해석 불가한 URL은 거부한다", () => {
    expect(decideHost("://broken", ALLOWED)).toEqual({
      allowed: false,
      host: null,
      reason: "unparsable",
    });
  });
});

describe("checkFinalHost — ⓑ-3 리다이렉트 감지", () => {
  it("같은 호스트에 도착하면 통과한다", () => {
    const check = checkFinalHost(
      "https://onepiece-cardgame.kr/fileDownload?downname=a",
      "https://onepiece-cardgame.kr/fileDownload?downname=a",
      ALLOWED,
    );
    expect(check.ok).toBe(true);
    expect(check.reason).toBe("ok");
  });

  it("🚨 승인되지 않은 호스트로 리다이렉트되면 실패다 — 사람이 승인한 것은 출발지였다", () => {
    const check = checkFinalHost(
      "https://onepiece-cardgame.kr/fileDownload?downname=a",
      "https://cdn.thirdparty.example/a.png",
      ALLOWED,
    );
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("redirected_offsite");
    expect(check.finalHost).toBe("cdn.thirdparty.example");
    // 요청한 호스트도 함께 남긴다 — 매니페스트가 둘을 대조할 수 있어야 한다.
    expect(check.requestedHost).toBe("onepiece-cardgame.kr");
  });

  it("최종 URL을 해석하지 못하면 통과시키지 않는다", () => {
    expect(checkFinalHost("https://onepiece-cardgame.kr/a", "", ALLOWED).ok).toBe(false);
  });
});

describe("경로 · 파일명 규칙 (ⓐ)", () => {
  it("game/setCode/code로 경로를 만든다", () => {
    expect(imageRelPath({ game: "opcg", setCode: "OPK-14", code: "OP14-001", ext: "webp" })).toBe(
      "data/images/opcg/OPK-14/OP14-001.webp",
    );
  });

  it("패럴렐 접미사(_P1)는 통과한다 — 실물 코드의 형태다", () => {
    expect(imageRelPath({ game: "opcg", setCode: "PROMO", code: "OP01-004_P1", ext: "webp" })).toBe(
      "data/images/opcg/PROMO/OP01-004_P1.webp",
    );
  });

  it("앞의 점이 있든 없든 확장자는 같게 붙는다", () => {
    const withDot = imageRelPath({ game: "opcg", setCode: "OPK-14", code: "X", ext: ".png" });
    const without = imageRelPath({ game: "opcg", setCode: "OPK-14", code: "X", ext: "png" });
    expect(withDot).toBe(without);
  });

  it("🚨 경로를 벗어나는 조각은 전부 막는다 — code만 보는 것으로 충분하지 않다", () => {
    expect(imageRelPath({ game: "..", setCode: "OPK-14", code: "X", ext: "webp" })).toBeNull();
    expect(imageRelPath({ game: "opcg", setCode: "../etc", code: "X", ext: "webp" })).toBeNull();
    expect(imageRelPath({ game: "opcg", setCode: "OPK-14", code: "a/b", ext: "webp" })).toBeNull();
  });

  it("공백·슬래시·한글이 든 조각을 거부한다", () => {
    expect(isValidPathSegment("OP14 001")).toBe(false);
    expect(isValidPathSegment("OP14/001")).toBe(false);
    expect(isValidPathSegment("루피")).toBe(false);
    expect(isValidPathSegment("OP14-001_P1")).toBe(true);
  });

  it("기존 파일은 지우지 않고 .bak-<stamp>로 옮긴다 (ⓓ)", () => {
    expect(backupRelPath("data/images/opcg/OPK-14/OP14-001.webp", "20260830T101112Z")).toBe(
      "data/images/opcg/OPK-14/OP14-001.webp.bak-20260830T101112Z",
    );
  });
});

describe("planImageFetches — 재실행 판정 (ⓓ)", () => {
  const targets = [target("OP14-001"), target("OP14-002"), target("OP14-003")];

  it("승인이 있고 파일이 없으면 전부 받는다", () => {
    const plan = planImageFetches({
      game: "opcg",
      targets,
      baseOrigin: ORIGIN,
      allowlist: ALLOWED,
      existing: new Set(),
      refetch: false,
    });
    expect(plan.counts.fetch).toBe(3);
    expect(plan.fetchCount).toBe(3);
  });

  it("🚨 승인이 없으면 한 건도 받지 않는다 — 이 상태가 지금이다", () => {
    const plan = planImageFetches({
      game: "opcg",
      targets,
      baseOrigin: ORIGIN,
      allowlist: [],
      existing: new Set(),
      refetch: false,
    });
    expect(plan.fetchCount).toBe(0);
    expect(plan.counts.host_denied).toBe(3);
    expect(plan.items.every((item) => item.hostReason === "empty_allowlist")).toBe(true);
  });

  it("이미 받은 파일은 요청 0회로 건너뛴다", () => {
    const plan = planImageFetches({
      game: "opcg",
      targets,
      baseOrigin: ORIGIN,
      allowlist: ALLOWED,
      existing: new Set(["data/images/opcg/OPK-14/OP14-002.webp"]),
      refetch: false,
    });
    expect(plan.counts.skip_exists).toBe(1);
    expect(plan.fetchCount).toBe(2);
  });

  it("--refetch면 기존 파일도 다시 받는다 — 그리고 fetchCount에 든다", () => {
    const plan = planImageFetches({
      game: "opcg",
      targets,
      baseOrigin: ORIGIN,
      allowlist: ALLOWED,
      existing: new Set(["data/images/opcg/OPK-14/OP14-002.webp"]),
      refetch: true,
    });
    expect(plan.counts.refetch).toBe(1);
    expect(plan.counts.skip_exists).toBe(0);
    expect(plan.fetchCount).toBe(3);
  });

  it("🚨 미승인 호스트는 「이미 있으니 건너뜀」으로 조용히 통과하지 않는다", () => {
    // 판정 순서가 호스트 → 기존 파일이어야 한다. 반대면 이 케이스가
    // skip_exists로 분류돼 거부 사실이 리포트에서 사라진다.
    const plan = planImageFetches({
      game: "opcg",
      targets: [target("OP14-001")],
      baseOrigin: ORIGIN,
      allowlist: [],
      existing: new Set(["data/images/opcg/OPK-14/OP14-001.webp"]),
      refetch: false,
    });
    expect(plan.counts.host_denied).toBe(1);
    expect(plan.counts.skip_exists).toBe(0);
  });

  it("경로 규칙을 벗어난 code는 invalid_path이고 요청하지 않는다", () => {
    const plan = planImageFetches({
      game: "opcg",
      targets: [{ setCode: "OPK-14", code: "OP14 001", imagePath: "/fileDownload?downname=a" }],
      baseOrigin: ORIGIN,
      allowlist: ALLOWED,
      existing: new Set(),
      refetch: false,
    });
    expect(plan.counts.invalid_path).toBe(1);
    expect(plan.fetchCount).toBe(0);
  });

  it("imagePath가 비면 no_image이고 요청하지 않는다", () => {
    const plan = planImageFetches({
      game: "opcg",
      targets: [{ setCode: "OPK-14", code: "OP14-001", imagePath: "" }],
      baseOrigin: ORIGIN,
      allowlist: ALLOWED,
      existing: new Set(),
      refetch: false,
    });
    expect(plan.counts.no_image).toBe(1);
    expect(plan.fetchCount).toBe(0);
  });
});

describe("buildHostSurvey — 승인 재료 (ⓑ-1)", () => {
  const files = [
    { setCode: "OPK-14", path: "data/catalog/opcg/OPK-14/cards.jsonl", rowCount: 2 },
    { setCode: "PROMO", path: "data/catalog/opcg/PROMO/cards.jsonl", rowCount: 1 },
  ];
  const targets = [
    target("OP14-001", "aaa"),
    target("OP14-002", "bbb"),
    target("OP01-004_P1", "ccc", "PROMO"),
  ];

  const survey = buildHostSurvey({
    game: "opcg",
    files,
    targets,
    baseOrigin: ORIGIN,
    baseSource: "매니페스트 2개의 CollectRun.host",
  });

  it("입력 범위를 그대로 낸다 (명세 1)", () => {
    expect(survey.fileCount).toBe(2);
    expect(survey.rowCount).toBe(3);
    expect(survey.setCodes).toEqual(["OPK-14", "PROMO"]);
  });

  it("형태 분포를 센다 (명세 2)", () => {
    expect(survey.shapeCounts.root_relative).toBe(3);
    expect(survey.shapeCounts.absolute).toBe(0);
    expect(survey.shapeCounts.protocol_relative).toBe(0);
    expect(survey.shapeCounts.empty).toBe(0);
  });

  it("형태마다 샘플을 3건까지만 담는다", () => {
    const many = buildHostSurvey({
      game: "opcg",
      files,
      targets: [target("A", "1"), target("B", "2"), target("C", "3"), target("D", "4")],
      baseOrigin: ORIGIN,
      baseSource: "x",
    });
    expect(many.shapeSamples.root_relative).toHaveLength(3);
  });

  it("절대화 후 호스트를 센다 (명세 4)", () => {
    expect(survey.hostCounts).toEqual([{ host: "onepiece-cardgame.kr", count: 3 }]);
  });

  it("🚨 고유 이미지 수는 downname 기준이다 — 행 수가 아니다 (명세 5)", () => {
    const dup = buildHostSurvey({
      game: "opcg",
      files,
      // 행은 3건이지만 downname은 2종이다.
      targets: [target("A", "same"), target("B", "same"), target("C", "other")],
      baseOrigin: ORIGIN,
      baseSource: "x",
    });
    expect(dup.rowCount).toBe(3);
    expect(dup.uniqueImageCount).toBe(2);
  });

  it("downname을 못 뽑은 행을 따로 센다 — 「모른다」와 「0장」을 섞지 않는다", () => {
    const partial = buildHostSurvey({
      game: "opcg",
      files,
      targets: [target("A", "x"), { setCode: "OPK-14", code: "B", imagePath: "/fileDownload" }],
      baseOrigin: ORIGIN,
      baseSource: "x",
    });
    expect(partial.uniqueImageCount).toBe(1);
    expect(partial.missingDownnameCount).toBe(1);
    // 요청 상한은 둘을 더한 값이다 — 모르는 행도 받아야 하기 때문이다.
    expect(partial.estimatedRequests).toBe(2);
  });

  it("여러 호스트가 섞이면 건수 내림차순으로 낸다", () => {
    const mixed = buildHostSurvey({
      game: "opcg",
      files,
      targets: [
        { setCode: "S", code: "A", imagePath: "https://cdn.example.com/a.png" },
        target("B", "1"),
        target("C", "2"),
      ],
      baseOrigin: ORIGIN,
      baseSource: "x",
    });
    expect(mixed.hostCounts.map((entry) => entry.host)).toEqual([
      "onepiece-cardgame.kr",
      "cdn.example.com",
    ]);
    expect(mixed.shapeCounts.absolute).toBe(1);
  });

  it("예상 소요는 간격 + 지터 기대값(절반) 기준이다 (명세 6)", () => {
    expect(survey.estimatedMs).toBe(3 * (IMAGE_DELAY_MS + IMAGE_JITTER_MS / 2));
  });
});

describe("승인 문장과 출력 (명세 7 · 8 · 9)", () => {
  const survey = buildHostSurvey({
    game: "opcg",
    files: [{ setCode: "OPK-14", path: "p", rowCount: 2 }],
    targets: [target("A", "1"), target("B", "2")],
    baseOrigin: ORIGIN,
    baseSource: "매니페스트 1개의 CollectRun.host",
  });

  it("승인 문장에 호스트와 요청 수가 함께 들어간다", () => {
    expect(approvalSentence(survey)).toBe(
      "호스트 `onepiece-cardgame.kr` 하나에 대해 최대 2회 요청을 승인한다.",
    );
  });

  it("출력이 9항목을 전부 낸다", () => {
    const text = formatHostSurvey(survey);
    for (let i = 1; i <= 9; i += 1) {
      expect(text).toContain(`[${i}]`);
    }
  });

  it("🚨 출력이 「요청 0회로 만들어졌다」를 스스로 단언한다 (명세 8)", () => {
    expect(formatHostSurvey(survey)).toContain("원천 사이트로 요청을 0회");
  });

  it("🚨 출력이 「문자열 조립이지 확인이 아니다」를 경고한다 (명세 9)", () => {
    const text = formatHostSurvey(survey);
    expect(text).toContain("문자열 조립의 결과");
    expect(text).toContain("리다이렉트");
  });

  it("base의 출처를 출력에 적는다 (명세 3)", () => {
    expect(formatHostSurvey(survey)).toContain("매니페스트 1개의 CollectRun.host");
  });
});

describe("부하 규율 — pace.ts 재사용 (ⓒ · ⓗ)", () => {
  it("🚨 이미지 간격은 pace.ts의 nextDelayMs에 값만 넘긴 것이다", () => {
    // 이미지 전용 상태 기계가 생기면 이 단언이 깨진다. 그것이 요점이다:
    // 규율이 두 벌이 되면 한쪽만 고쳐지는 날이 온다(§4.8 ⓚ-4와 같은 자세).
    const rng = () => 0.5;
    expect(nextImageDelayMs(rng)).toBe(nextDelayMs(IMAGE_DELAY_MS, IMAGE_JITTER_MS, rng));
  });

  it("간격이 1.5초 + 0~1초 지터다 (T1.20 ⓒ)", () => {
    expect(IMAGE_DELAY_MS).toBe(1500);
    expect(IMAGE_JITTER_MS).toBe(1000);
    expect(nextImageDelayMs(() => 0)).toBe(1500);
    expect(nextImageDelayMs(() => 0.999)).toBeLessThan(2500);
  });

  it("webp 파라미터가 §9.4 ⓕ-7의 값이다 — 한 종류만 만든다", () => {
    expect(WEBP_PARAMS).toEqual({ maxEdgePx: 600, quality: 80 });
  });
});

describe("buildImageRun — 매니페스트 조립 (ⓔ)", () => {
  const plan = planImageFetches({
    game: "opcg",
    targets: [target("A", "1"), target("B", "2"), target("C", "3")],
    baseOrigin: ORIGIN,
    allowlist: ALLOWED,
    existing: new Set(["data/images/opcg/OPK-14/A.webp"]),
    refetch: false,
  });

  function log(status: number | null, attempt = 1): ImageRequestLog {
    return {
      url: `${ORIGIN}/fileDownload?downname=x`,
      finalUrl: status === null ? null : `${ORIGIN}/fileDownload?downname=x`,
      startedAt: "2026-08-30T00:00:00.000Z",
      status,
      durationMs: 100,
      bytes: status === 200 ? 1000 : null,
      webpBytes: status === 200 ? 500 : null,
      attempt,
    };
  }

  const run = buildImageRun({
    game: "opcg",
    setCodes: ["OPK-14"],
    argv: ["--game", "opcg", "--set", "OPK-14"],
    approvedHosts: ALLOWED,
    baseOrigin: ORIGIN,
    baseSource: "매니페스트",
    userAgent: "DeckBinder-CatalogBot/0.1",
    startedAt: "2026-08-30T00:00:00.000Z",
    finishedAt: "2026-08-30T00:00:10.000Z",
    robots: { url: `${ORIGIN}/robots.txt`, status: 404, checkedAt: "2026-08-30T00:00:00.000Z" },
    maxRequests: 10,
    requests: [log(200), log(500), log(null, 2), log(200)],
    plan,
    savedCount: 2,
    stoppedBy: "completed",
  });

  it("🚨 실패를 시도 단위로 센다 — 2xx가 아닌 것과 네트워크 실패를 함께", () => {
    // T1.16 결함 1이 정확히 이 집계를 scripts/에 두어 났다.
    expect(run.requestCount).toBe(4);
    expect(run.failureCount).toBe(2);
  });

  it("계획의 집계를 그대로 옮긴다 — 다시 세지 않는다", () => {
    expect(run.skippedCount).toBe(plan.counts.skip_exists);
    expect(run.skippedCount).toBe(1);
    expect(run.hostDeniedCount).toBe(0);
  });

  it("invalid는 경로 위반과 이미지 없음을 합친 값이다", () => {
    const bad = planImageFetches({
      game: "opcg",
      targets: [
        { setCode: "OPK-14", code: "bad code", imagePath: "/fileDownload?downname=a" },
        { setCode: "OPK-14", code: "OK", imagePath: "" },
      ],
      baseOrigin: ORIGIN,
      allowlist: ALLOWED,
      existing: new Set(),
      refetch: false,
    });
    expect(bad.counts.invalid_path + bad.counts.no_image).toBe(2);
  });

  it("승인 기록과 base 출처가 매니페스트에 남는다 (ⓔ)", () => {
    expect(run.approvedHosts).toEqual(ALLOWED);
    expect(run.baseSource).toBe("매니페스트");
    expect(run.argv).toContain("--set");
  });

  it("부하 규율 값과 webp 파라미터를 기록한다 — 나중에 무엇으로 돌렸는지 알 수 있어야 한다", () => {
    expect(run.delayMs).toBe(IMAGE_DELAY_MS);
    expect(run.jitterMs).toBe(IMAGE_JITTER_MS);
    expect(run.webp).toEqual({ maxEdgePx: 600, quality: 80 });
  });
});

describe("webp 변환 — 합성 픽스처로 확인한다 (ⓕ)", () => {
  // 🚨 **실제 카드 이미지를 픽스처에 넣지 않는다**(T1.20 ⓕ). 아래는 sharp로
  // 만든 4×6 단색 94바이트짜리 합성 이미지이고, 원천에서 받은 것이 아니다.
  // 이 테스트가 증명하는 것은 하나다: **첫 요청이 나가기 전에 변환 경로가
  // 실제로 동작한다.** 승인을 받고 3,000장을 받은 뒤에 sharp가 안 되는 것을
  // 아는 것은 되돌리기가 비싸다.
  const fixture = join(__dirname, "__fixtures__", "synthetic-card.png");

  it("WEBP_PARAMS로 변환하면 webp가 나온다 — 요청 0회로 확인된다", async () => {
    const out = await sharp(readFileSync(fixture))
      .resize({
        width: WEBP_PARAMS.maxEdgePx,
        height: WEBP_PARAMS.maxEdgePx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_PARAMS.quality })
      .toBuffer();

    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
  });

  it("🚨 withoutEnlargement가 작은 원본을 늘리지 않는다 — 없는 화질을 만들지 않는다", async () => {
    const out = await sharp(readFileSync(fixture))
      .resize({
        width: WEBP_PARAMS.maxEdgePx,
        height: WEBP_PARAMS.maxEdgePx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_PARAMS.quality })
      .toBuffer();

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(4);
    expect(meta.height).toBe(6);
  });
});

describe("sniffImageFormat — 헤더가 아니라 바이트를 본다 (2026-08-30 실측이 만든 함수)", () => {
  // 🚨 원천의 `/fileDownload?...`는 이미지 MIME을 주지 않는다. 헤더만 믿으면
  // 전부 `bin`으로 떨어지는데 **실제 바이트는 webp였다**. 그래서 헤더가 아니라
  // 매직 바이트가 근거다.
  function bytes(...values: number[]): Uint8Array {
    return Uint8Array.from(values);
  }

  it("RIFF….WEBP를 webp로 읽는다 — 원천이 실제로 주는 형식이다", () => {
    // "RIFF" + 크기 4바이트 + "WEBP"
    expect(sniffImageFormat(bytes(0x52, 0x49, 0x46, 0x46, 0xac, 0x17, 0x04, 0x00, 0x57, 0x45, 0x42, 0x50))).toBe(
      "webp",
    );
  });

  it("RIFF이지만 WEBP가 아니면 webp가 아니다 — RIFF는 wav도 쓴다", () => {
    expect(sniffImageFormat(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBeNull();
  });

  it("png · jpg · gif를 읽는다", () => {
    expect(sniffImageFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImageFormat(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
  });

  it("모르는 바이트와 너무 짧은 입력은 null이다 — 추측하지 않는다", () => {
    expect(sniffImageFormat(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
    expect(sniffImageFormat(bytes())).toBeNull();
  });

  it("합성 픽스처를 png로 읽는다 — 실물로 한 번 확인한다", () => {
    expect(sniffImageFormat(readFileSync(join(__dirname, "__fixtures__", "synthetic-card.png")))).toBe("png");
  });
});

describe("originalRelPath — 원본과 변환본의 이름을 가른다", () => {
  it("🚨 원본이 webp여도 변환본을 덮지 않는다 — 이것이 이 함수의 존재 이유다", () => {
    const original = originalRelPath({ game: "opcg", setCode: "OPK-14", code: "OP14-001", ext: "webp" });
    const derived = imageRelPath({ game: "opcg", setCode: "OPK-14", code: "OP14-001", ext: "webp" });
    expect(original).toBe("data/images/opcg/OPK-14/OP14-001.original.webp");
    expect(derived).toBe("data/images/opcg/OPK-14/OP14-001.webp");
    expect(original).not.toBe(derived);
  });

  it("⚠️ 변환본의 이름은 바뀌지 않는다 — §9.4 ⓕ-2가 T1.22의 업로드 경로로 못박은 값이다", () => {
    expect(imageRelPath({ game: "opcg", setCode: "OPK-14", code: "OP14-001", ext: "webp" })).toBe(
      "data/images/opcg/OPK-14/OP14-001.webp",
    );
  });

  it("경로 검사는 imageRelPath와 같은 규칙을 쓴다", () => {
    expect(originalRelPath({ game: "opcg", setCode: "../etc", code: "X", ext: "webp" })).toBeNull();
    expect(originalRelPath({ game: "opcg", setCode: "OPK-14", code: "a/b", ext: "webp" })).toBeNull();
  });
});

describe("decideResponse — 받은 것을 버리지 않는다 (2026-08-30 결함 수정)", () => {
  // 🚨 이 describe가 있는 이유는 실제 사고다. OPK-14 첫 실행에서 **160번째
  // 요청이 200으로 504,104바이트를 받고도 버려졌다** — 예산 검사가 「수신」과
  // 「저장」 사이에 있었기 때문이다. 원천은 부하를 그대로 졌고 우리는 아무것도
  // 얻지 못했으며, 그 한 장을 메우려면 요청을 한 번 더 보내야 한다.

  it("🚨 200 + 본문이면 언제나 save다 — 예산은 인자에 없다", () => {
    // 이 함수가 PaceState를 받게 되는 날 이 테스트를 다시 읽는다.
    // 「받은 것을 버릴지」와 「다음을 보낼지」는 다른 질문이다.
    expect(decideResponse({ status: 200, hasBody: true, attempt: 1, maxAttempts: 3 })).toBe("save");
    expect(decideResponse({ status: 200, hasBody: true, attempt: 3, maxAttempts: 3 })).toBe("save");
  });

  it("200인데 본문이 없으면 저장할 것이 없다", () => {
    expect(decideResponse({ status: 200, hasBody: false, attempt: 1, maxAttempts: 3 })).not.toBe("save");
  });

  it("5xx·타임아웃은 재시도 여유가 있을 때만 retry다 (§4.8 ⓔ)", () => {
    expect(decideResponse({ status: 500, hasBody: false, attempt: 1, maxAttempts: 3 })).toBe("retry");
    expect(decideResponse({ status: null, hasBody: false, attempt: 2, maxAttempts: 3 })).toBe("retry");
    expect(decideResponse({ status: 500, hasBody: false, attempt: 3, maxAttempts: 3 })).toBe("give_up");
  });

  it("4xx는 다시 받아도 같으므로 재시도하지 않는다", () => {
    expect(decideResponse({ status: 404, hasBody: false, attempt: 1, maxAttempts: 3 })).toBe("give_up");
    expect(decideResponse({ status: 403, hasBody: false, attempt: 1, maxAttempts: 3 })).toBe("give_up");
  });
});
