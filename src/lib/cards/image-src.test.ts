import { describe, expect, it } from "vitest";

import { PROXY_SOURCE_BY_HOST, proxiedImageUrl } from "@/lib/cards/image-src";

// 🚨 이 파일은 프록시 base를 코드에 박지 않는다. 전부 인자로 넘긴다 —
// `absolutizeImagePath`가 세운 자세 그대로다("박으면 그것은 확인이 아니라
// 선언이다"). T1.31 ⓒ.

const BASE = "https://deckbinder-image-proxy.example.workers.dev";
const SOURCE = "https://onepiece-cardgame.kr/fileDownload?downname=";

// 실측된 세 형식 (§3.5 「ID 형식」 · 2026-08-31 전수 3,146행).
const DOWNNAME_A = "202404240732471520";
const DOWNNAME_B = "20250619_183626_9012333d90";
const DOWNNAME_C = "20260720_133222_f6f63859f7e04962a60da06c95a397f1";

describe("proxiedImageUrl — 정상", () => {
  it("원천 URL을 프록시 경로로 바꾼다", () => {
    expect(proxiedImageUrl(`${SOURCE}${DOWNNAME_C}`, BASE)).toBe(
      `${BASE}/img/opcg-kr/${DOWNNAME_C}`,
    );
  });

  it("실측된 세 형식을 전부 통과시킨다", () => {
    for (const downname of [DOWNNAME_A, DOWNNAME_B, DOWNNAME_C]) {
      expect(proxiedImageUrl(`${SOURCE}${downname}`, BASE)).toBe(
        `${BASE}/img/opcg-kr/${downname}`,
      );
    }
  });

  // 🚨 워커의 라우트와 글자 단위로 맞아야 한다 — `/img/:source/:id`
  // (workers/image-proxy/src/index.ts) · 키 `opcg-kr` (같은 곳 sources.ts).
  // ⚠️ 표가 앱·워커 두 벌인 대가는 사용자 확인 6에 적혀 있다.
  it("경로 모양이 워커의 라우트와 같다", () => {
    const url = proxiedImageUrl(`${SOURCE}${DOWNNAME_C}`, BASE) as string;
    const path = url.slice(BASE.length);

    expect(path.split("/")).toEqual(["", "img", "opcg-kr", DOWNNAME_C]);
  });

  it("base 끝의 슬래시가 겹치지 않는다", () => {
    expect(proxiedImageUrl(`${SOURCE}${DOWNNAME_C}`, `${BASE}/`)).toBe(
      `${BASE}/img/opcg-kr/${DOWNNAME_C}`,
    );
  });
});

describe("proxiedImageUrl — null로 착지하는 경우", () => {
  // ⓕ 🚨 오늘 이 단언을 실물로 검증할 수 있다 — base가 정말 비어 있다.
  //    비어 있으면 전량 폴백이고 화면이 깨지지 않는 것이 요건이다.
  it("base가 없으면 null이다. 던지지 않는다", () => {
    const source = `${SOURCE}${DOWNNAME_C}`;

    expect(proxiedImageUrl(source, undefined)).toBeNull();
    expect(proxiedImageUrl(source, null)).toBeNull();
    expect(proxiedImageUrl(source, "")).toBeNull();
    expect(proxiedImageUrl(source, "   ")).toBeNull();
  });

  it("원천 URL이 없으면 null이다", () => {
    expect(proxiedImageUrl(null, BASE)).toBeNull();
    expect(proxiedImageUrl("", BASE)).toBeNull();
  });

  // ⓑ 🚨 프록시에 보내 404를 받게 하지 않는다. 알 수 있는 것을 요청으로
  //    알아내지 않는다 — 그것이 곧 원천 부하다(§9.4 ⓖ-7).
  it("downname 형식이 어긋나면 null이다", () => {
    expect(proxiedImageUrl(`${SOURCE}20260720_133222_XYZ`, BASE)).toBeNull();
    expect(proxiedImageUrl(`${SOURCE}../../etc/passwd`, BASE)).toBeNull();
    expect(proxiedImageUrl(`${SOURCE}12345`, BASE)).toBeNull();
  });

  it("downname 자체가 없으면 null이다", () => {
    expect(proxiedImageUrl("https://onepiece-cardgame.kr/fileDownload", BASE)).toBeNull();
    expect(proxiedImageUrl("https://onepiece-cardgame.kr/fileDownload?other=1", BASE)).toBeNull();
  });

  // ⓗ 🚨 승인한 원천이 아니면 프록시에 보내지 않는다. 프록시가 겹 1로 막지만
  //    앱이 먼저 안 보내는 것이 낫다 — 막힐 요청을 만들지 않는다.
  it("화이트리스트 밖 호스트는 null이다", () => {
    expect(proxiedImageUrl(`https://evil.example/fileDownload?downname=${DOWNNAME_C}`, BASE)).toBeNull();
    // 접미사만 같은 것도 통과시키지 않는다.
    expect(proxiedImageUrl(`https://evil-onepiece-cardgame.kr/x?downname=${DOWNNAME_C}`, BASE)).toBeNull();
    expect(proxiedImageUrl(`https://onepiece-cardgame.kr.evil.example/x?downname=${DOWNNAME_C}`, BASE)).toBeNull();
  });

  it("URL이 아니면 null이다. 던지지 않는다", () => {
    expect(proxiedImageUrl("fileDownload?downname=" + DOWNNAME_C, BASE)).toBeNull();
    expect(proxiedImageUrl("!!!", BASE)).toBeNull();
  });
});

describe("PROXY_SOURCE_BY_HOST", () => {
  it("§4.4.1이 고정한 원천 하나뿐이다", () => {
    expect(Object.keys(PROXY_SOURCE_BY_HOST)).toEqual(["onepiece-cardgame.kr"]);
  });

  // 🚨 로컬 디렉토리 라벨 `opcg`가 아니다. 마이그레이션 010이 games.code를
  //    `opcg-kr`로 재명명했고 그것이 권위 있는 식별자다(T1.22 판정 3).
  it("키가 opcg-kr이다", () => {
    expect(PROXY_SOURCE_BY_HOST["onepiece-cardgame.kr"]).toBe("opcg-kr");
  });
});

describe("순수성", () => {
  it("같은 입력이 같은 출력을 낸다", () => {
    const source = `${SOURCE}${DOWNNAME_B}`;

    expect(proxiedImageUrl(source, BASE)).toBe(proxiedImageUrl(source, BASE));
  });
});
