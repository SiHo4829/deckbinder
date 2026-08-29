/**
 * HTML 문자열 → `CollectedCard[]` — plan §4.8 ⓚ-1 · ⓚ-3.
 *
 * **해석하지 않는다.** 숫자 변환 · `-` 처리 · 색 분해 · URL 절대화 ·
 * 코스트/라이프 배분은 전부 `src/lib/validation/catalog.ts`(정규화)의 일이다.
 * 이 파일은 필드 15개를 문자열 그대로 옮길 뿐이다.
 *
 * 🚨 `new JSDOM(html)`을 직접 만든다 — 전역 `document`·`DOMParser`를 쓰지
 * 않는다. `vitest.config.mts`의 `environment`가 `jsdom`이라 전역 DOM이
 * 테스트에서는 존재하지만, 거기 기대면 테스트는 통과하고 `tsx scripts/`
 * (node 환경)에서만 깨진다(plan §4.8 ⓚ-3).
 */

import { JSDOM, VirtualConsole } from "jsdom";

import type { CollectedCard } from "./types";

/** 원천 마크업 대응 버전. 셀렉터를 고치면 올린다. */
export const PARSER_VERSION = "1";

export interface SetOption {
  readonly value: string;
  readonly label: string;
}

export interface ParsedPage {
  readonly cards: readonly CollectedCard[];
  readonly lastPageIndex: number | null; // a.pagi_last의 page= 값. 없으면 null(=1페이지)
  readonly setOptions: readonly SetOption[];
  readonly noItems: boolean;
}

/** `CollectedCard`의 문자열 필드 → 원천 클래스명. `imagePath`·`page`는 별도 처리. */
const FIELD_CLASS: Record<
  keyof Omit<CollectedCard, "imagePath" | "page">,
  string
> = {
  sourceSetLabel: "cardGet",
  code: "cardNumber",
  nameKo: "cardName",
  cardType: "cardType",
  colorRaw: "cardColor",
  lifeRaw: "life",
  powerRaw: "power",
  counterRaw: "cardCounter",
  attribute: "cardAttr",
  traitsRaw: "cardPoint",
  rarity: "rarity",
  effectText: "cardText",
  triggerText: "cardTrigger",
  illustrationType: "animationType",
  blockNumberRaw: "blockNumber",
};

function fieldText(item: Element, className: string): string {
  const el = item.querySelector(`p.${className}`);
  return el?.textContent?.trim() ?? "";
}

/**
 * CSS 파싱 실패 **하나만** 삼키는 가상 콘솔 — plan §8 백로그 E-3.
 *
 * 원천 페이지의 `<style>`은 `rrweb-cssom`이 못 읽는 문법(중첩 규칙 등)을 써서
 * 페이지마다 `Could not parse CSS stylesheet`와 **스타일시트 전문**이 쏟아진다.
 * 데이터는 무해하지만 계열 실행에서는 세트 수만큼 곱해져, 매니페스트 경로와
 * 경고가 파묻힌다(§4.10 T1.24 완료 기준 ⓔ · ⓙ가 「사람이 출력을 읽는다」를
 * 전제한다).
 *
 * 🚨 **다른 신호까지 끄지 않는다**(E-3 ⓑ). 거르는 기준은 jsdom이 직접 붙이는
 * `error.type === "css parsing"` 하나뿐이고, 나머지 `jsdomError`는 기본 동작과
 * 똑같은 모양(`stack`, `detail`)으로 그대로 내보낸다. 전부 삼키면 이 프로젝트가
 * 이미 두 번 겪은 「조용한 실패」를 우리 손으로 다시 만드는 것이다.
 *
 * 테스트가 이벤트를 직접 넣어 ⓑ를 확인할 수 있도록 export한다.
 */
export function createQuietVirtualConsole(): VirtualConsole {
  const virtualConsole = new VirtualConsole();
  // jsdomError만 우리가 받고, 나머지 콘솔 이벤트는 기본대로 흘려보낸다.
  virtualConsole.sendTo(console, { omitJSDOMErrors: true });
  virtualConsole.on("jsdomError", (error) => {
    if (error.type === "css parsing") return;
    console.error(error.stack, error.detail);
  });
  return virtualConsole;
}

/** 순수 함수. 던지지 않는다 — 빈 목록도 정상적인 파싱 결과다. */
export function parseCardListPage(html: string, page: number): ParsedPage {
  const dom = new JSDOM(html, { virtualConsole: createQuietVirtualConsole() });
  const { document } = dom.window;

  const noItems = document.querySelector(".noItems") !== null;

  const items = Array.from(document.querySelectorAll(".card_sch_list > button.item"));
  const cards: CollectedCard[] = items.map((item) => {
    const img = item.querySelector("img.image");
    return {
      sourceSetLabel: fieldText(item, FIELD_CLASS.sourceSetLabel),
      code: fieldText(item, FIELD_CLASS.code),
      nameKo: fieldText(item, FIELD_CLASS.nameKo),
      cardType: fieldText(item, FIELD_CLASS.cardType),
      colorRaw: fieldText(item, FIELD_CLASS.colorRaw),
      lifeRaw: fieldText(item, FIELD_CLASS.lifeRaw),
      powerRaw: fieldText(item, FIELD_CLASS.powerRaw),
      counterRaw: fieldText(item, FIELD_CLASS.counterRaw),
      attribute: fieldText(item, FIELD_CLASS.attribute),
      traitsRaw: fieldText(item, FIELD_CLASS.traitsRaw),
      rarity: fieldText(item, FIELD_CLASS.rarity),
      effectText: fieldText(item, FIELD_CLASS.effectText),
      triggerText: fieldText(item, FIELD_CLASS.triggerText),
      illustrationType: fieldText(item, FIELD_CLASS.illustrationType),
      blockNumberRaw: fieldText(item, FIELD_CLASS.blockNumberRaw),
      imagePath: img?.getAttribute("src") ?? "",
      page,
    };
  });

  const setOptions: SetOption[] = Array.from(document.querySelectorAll("select option")).map((opt) => ({
    value: opt.getAttribute("value") ?? "",
    label: (opt.textContent ?? "").trim(),
  }));

  const lastLink = document.querySelector("a.pagi_last");
  const lastPageIndex = lastLink ? parsePageParam(lastLink.getAttribute("href")) : null;

  return { cards, lastPageIndex, setOptions, noItems };
}

function parsePageParam(href: string | null): number | null {
  if (!href) {
    return null;
  }
  const url = new URL(href, "https://placeholder.invalid");
  const page = url.searchParams.get("page");
  if (page === null) {
    return null;
  }
  const n = Number(page);
  return Number.isNaN(n) ? null : n;
}

/**
 * 0건이면 throw. 기대치보다 적으면 경고 문자열을 돌려준다(throw 하지 않는다).
 *
 * `parseCardListPage`(던지지 않음)와 갈라 둔 이유 — 파서가 0건에서 바로
 * 던지면 `noItems` 픽스처로 「빈 목록을 정확히 인식했는가」를 검증할 수
 * 없다. 중단은 규율의 일이지 파싱의 일이 아니다.
 */
export function assertNonEmpty(parsed: ParsedPage, page: number, expected: number): string | null {
  if (parsed.cards.length === 0) {
    throw new Error(
      `page ${page}: 파싱된 행이 0건이다 (기대치 ~${expected}). 원천 마크업이 바뀌었을 수 있다.`,
    );
  }
  if (parsed.cards.length < expected) {
    return `page ${page}: ${parsed.cards.length}건 파싱됨, 기대치 ${expected}건.`;
  }
  return null;
}

/** 셀렉터 옵션에서 세트 코드로 라벨을 해석한다. 0개·2개 이상이면 throw. */
export function resolveSetLabel(options: readonly SetOption[], setCode: string): string {
  const prefix = `[${setCode}]`;
  const matches = options.filter((o) => o.value.startsWith(prefix));
  if (matches.length === 0) {
    throw new Error(`setCode "${setCode}"에 해당하는 셀렉터 옵션이 없다.`);
  }
  if (matches.length > 1) {
    throw new Error(`setCode "${setCode}"에 해당하는 셀렉터 옵션이 ${matches.length}개다 — 하나여야 한다.`);
  }
  return matches[0].value;
}
