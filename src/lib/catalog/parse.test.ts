import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertNonEmpty,
  createQuietVirtualConsole,
  parseCardListPage,
  resolveSetLabel,
} from "./parse";

// ⚠️ vitest environment가 jsdom이라 전역 URL이 jsdom(whatwg-url)의 구현으로
// 바뀐다. Windows 드라이브 문자(D:\...)를 낀 상대 URL 해석에서 경로 세그먼트가
// 사라지는 버그가 있어 `new URL(relative, import.meta.url)`을 쓰지 않는다.
// fileURLToPath로 절대경로만 얻고 나머지는 node:path로 조립한다.
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

const normal = fixture("page-normal.html");
const parallel = fixture("page-parallel.html");
const edge = fixture("page-edge.html");
const single = fixture("page-single.html");
const noItems = fixture("page-no-items.html");
const missingField = fixture("page-missing-field.html");
const brokenCss = fixture("page-css-noise.html");

describe("parseCardListPage", () => {
  it("1. 정상 3행 → 15필드가 전부 채워진다(필드명 기준)", () => {
    const parsed = parseCardListPage(normal, 1);
    expect(parsed.cards).toHaveLength(3);
    const first = parsed.cards[0];
    expect(first).toEqual({
      sourceSetLabel: "[TST-01] 테스트 세트 하나",
      code: "TST-001",
      nameKo: "테스트카드가",
      cardType: "리더",
      colorRaw: "가색",
      lifeRaw: "5",
      powerRaw: "5000",
      counterRaw: "-",
      attribute: "속성가",
      traitsRaw: "특징가/특징나",
      rarity: "L",
      effectText: "효과 텍스트 자리 첫 번째",
      triggerText: "",
      illustrationType: "오리지널",
      blockNumberRaw: "4",
      imagePath: "/fileDownload?downname=20200101_000000_00000000000000000000000000000001",
      page: 1,
    });
  });

  it("2. 🚨 미닫힌 <p>에서도 마지막 필드 cardName이 </button>을 먹지 않는다", () => {
    const parsed = parseCardListPage(normal, 1);
    expect(parsed.cards[0].nameKo).toBe("테스트카드가");
    expect(parsed.cards[0].nameKo).not.toContain("button");
    expect(parsed.cards[1].nameKo).toBe("테스트카드나");
  });

  it("3. 셀렉터 값의 &amp;가 &로 디코드된다", () => {
    const parsed = parseCardListPage(normal, 0);
    const withAmp = parsed.setOptions.find((o) => o.value.includes("[TST-03]"));
    expect(withAmp?.value).toBe("[TST-03] 테스트 세트 & 셋");
  });

  it("4. 셀렉터 옵션 전량이 순서대로 나오고 all이 포함된다", () => {
    const parsed = parseCardListPage(normal, 0);
    expect(parsed.setOptions.map((o) => o.value)).toEqual([
      "all",
      "[TST-01] 테스트 세트 하나",
      "[TST-02] 테스트 세트 둘",
      "[TST-03] 테스트 세트 & 셋",
    ]);
  });

  it("5. a.pagi_last → lastPageIndex === 2", () => {
    const parsed = parseCardListPage(normal, 0);
    expect(parsed.lastPageIndex).toBe(2);
  });

  it("6. a.pagi_last 없음 → lastPageIndex === null", () => {
    const parsed = parseCardListPage(single, 0);
    expect(parsed.lastPageIndex).toBeNull();
  });

  it("7. noItems 페이지 → cards.length === 0 · noItems === true · 던지지 않는다", () => {
    const parsed = parseCardListPage(noItems, 1);
    expect(parsed.cards).toHaveLength(0);
    expect(parsed.noItems).toBe(true);
  });

  it("8. 패러렐 2행이 각각 별개 카드이고 code가 _P1을 보존한다(대소문자도)", () => {
    const parsed = parseCardListPage(parallel, 1);
    expect(parsed.cards).toHaveLength(2);
    expect(parsed.cards[0].code).toBe("TST-001");
    expect(parsed.cards[1].code).toBe("TST-001_P1");
  });

  it("9. 2색 → colorRaw가 원문 문자열 그대로(파서는 배열로 만들지 않는다)", () => {
    const parsed = parseCardListPage(edge, 1);
    const twoColor = parsed.cards.find((c) => c.code === "TST-004");
    expect(twoColor?.colorRaw).toBe("가색,나색");
  });

  it("10. 이벤트 행 → attribute === \"\" · powerRaw === \"-\"(둘을 구분해 보존한다)", () => {
    const parsed = parseCardListPage(edge, 1);
    const event = parsed.cards.find((c) => c.code === "TST-005");
    expect(event?.attribute).toBe("");
    expect(event?.powerRaw).toBe("-");
  });

  it("11. 필드 결측 행 → 그 필드만 \"\"이고 나머지 14필드가 온전하다", () => {
    const parsed = parseCardListPage(missingField, 1);
    const missing = parsed.cards.find((c) => c.code === "TST-007");
    expect(missing?.powerRaw).toBe("");
    expect(missing?.nameKo).toBe("테스트카드사");
    expect(missing?.cardType).toBe("캐릭터");
    expect(missing?.colorRaw).toBe("가색");
    expect(missing?.effectText).toBe("효과 텍스트 자리 일곱 번째");
    const intact = parsed.cards.find((c) => c.code === "TST-008");
    expect(intact?.powerRaw).toBe("2000");
  });

  it("12. effectText의 개행이 살아남는다(값으로 사라지지 않는다)", () => {
    // ⚠️ plan §4.8 ⓘ-12는 "\r\n이 보존된다"고 적었지만, HTML5 스펙의
    // 입력 스트림 전처리 단계(§13.2.3.5)가 모든 CR·CRLF를 LF로 정규화한다.
    // 이것은 jsdom만의 동작이 아니라 스펙을 지키는 모든 HTML 파서(=브라우저
    // 포함)의 동작이라 parse.ts 선택과 무관하게 피할 수 없다 — ⓚ-3이
    // 채택한 jsdom도 예외가 아니다. 그래서 "원문 \r\n 그대로"가 아니라
    // "개행이 유실되지 않고 \n으로 남는다"를 검증한다.
    const html = normal.replace(
      "효과 텍스트 자리 첫 번째",
      "효과 텍스트\r\n둘째 줄",
    );
    const parsed = parseCardListPage(html, 1);
    expect(parsed.cards[0].effectText).toBe("효과 텍스트\n둘째 줄");
  });

  describe("assertNonEmpty", () => {
    it("13a. 0건 → throw", () => {
      const parsed = parseCardListPage(noItems, 1);
      expect(() => assertNonEmpty(parsed, 1, 20)).toThrow();
    });

    it("13b. 정상 → 통과(null)", () => {
      const parsed = parseCardListPage(normal, 1);
      expect(assertNonEmpty(parsed, 1, 3)).toBeNull();
    });

    it("13c. 기대치보다 적지만 0은 아닌 경우 → throw 하지 않고 경고를 돌려준다", () => {
      const parsed = parseCardListPage(normal, 1);
      const warning = assertNonEmpty(parsed, 1, 20);
      expect(warning).not.toBeNull();
      expect(typeof warning).toBe("string");
    });
  });

  describe("resolveSetLabel", () => {
    it("14a. 정확히 1개 → 라벨 반환", () => {
      const parsed = parseCardListPage(normal, 0);
      expect(resolveSetLabel(parsed.setOptions, "TST-01")).toBe("[TST-01] 테스트 세트 하나");
    });

    it("14b. 0개 → throw", () => {
      const parsed = parseCardListPage(normal, 0);
      expect(() => resolveSetLabel(parsed.setOptions, "TST-99")).toThrow();
    });

    it("14c. 2개 이상 → throw", () => {
      const options = [
        { value: "[TST-01] 세트 A", label: "세트 A" },
        { value: "[TST-01] 세트 B", label: "세트 B" },
      ];
      expect(() => resolveSetLabel(options, "TST-01")).toThrow();
    });
  });

  // 백로그 E-3 — jsdom이 흘리던 CSS 파싱 잡음 억제. 저장본으로 재현하고
  // 네트워크는 쓰지 않는다(E-3 ⓓ).
  describe("가상 콘솔 (E-3)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("15a. 못 읽는 <style>이 있어도 콘솔에 아무것도 흘리지 않는다", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      parseCardListPage(brokenCss, 1);

      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    });

    it("15b. 잡음을 껐어도 파싱 결과는 그대로다", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const parsed = parseCardListPage(brokenCss, 1);

      expect(parsed.cards).toHaveLength(1);
      expect(parsed.cards[0].code).toBe("TST-1001");
      expect(parsed.noItems).toBe(false);
      expect(parsed.lastPageIndex).toBeNull();
    });

    it("15c. 🚨 CSS 아닌 jsdomError는 삼키지 않는다 (E-3 ⓑ)", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const virtualConsole = createQuietVirtualConsole();

      const other = Object.assign(new Error("무언가 다른 실패"), {
        type: "unhandled exception",
      });
      virtualConsole.emit("jsdomError", other);

      expect(error).toHaveBeenCalledTimes(1);
    });

    it("15d. 억제 기준은 type === \"css parsing\" 하나뿐이다", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const virtualConsole = createQuietVirtualConsole();

      const css = Object.assign(new Error("Could not parse CSS stylesheet"), {
        type: "css parsing",
        detail: ".a { &:hover { color: red } }",
      });
      virtualConsole.emit("jsdomError", css);
      expect(error).not.toHaveBeenCalled();

      // 같은 메시지라도 type이 없으면 우리 판단 대상이 아니다 — 내보낸다.
      virtualConsole.emit("jsdomError", new Error("Could not parse CSS stylesheet"));
      expect(error).toHaveBeenCalledTimes(1);
    });
  });
});
