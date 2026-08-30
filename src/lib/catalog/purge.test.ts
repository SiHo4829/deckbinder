/**
 * 이미지 회수의 **판단** 전량을 고정한다 — plan §8 T1.21 완료 기준 ⓖ.
 *
 * 🚨 이 파일이 지켜야 하는 것 둘. ⓐ **`--apply` 없이는 아무것도 지우지
 * 않는다.** ⓑ **DB를 버킷보다 먼저 비운다**(§9.4 ⓕ-4의 1→2). 둘 다 실제로
 * 지워 보면서 확인할 수 없는 종류의 규율이다 — 되돌릴 수 없기 때문이다.
 * 그러므로 문서가 아니라 이 파일이 증명한다.
 */

import { describe, expect, it } from "vitest";

import {
  buildPurgePlan,
  decideApply,
  formatPurgePlan,
  isObjectGone,
  parsePurgeRange,
  pickVerifySample,
  purgeConclusion,
  purgePrefix,
  purgeSteps,
  selectCards,
  selectObjects,
  type BucketObject,
  type CardImageRow,
  type PurgeRange,
} from "./purge";

const RANGE_ALL: PurgeRange = { scope: "all", game: null, setCode: null };
const RANGE_GAME: PurgeRange = { scope: "game", game: "opcg", setCode: null };
const RANGE_SET: PurgeRange = { scope: "set", game: "opcg", setCode: "OPK-14" };

function object(name: string, sizeBytes = 47000): BucketObject {
  return { name, sizeBytes };
}

function card(
  id: string,
  game: string,
  setCode: string,
  imageUrl: string | null = "https://x/y.webp",
  sourceImageUrl: string | null = "https://src/y",
): CardImageRow {
  return { id, game, setCode, imageUrl, sourceImageUrl };
}

describe("parsePurgeRange — 남는 인자를 조용히 무시하지 않는다", () => {
  it("scope가 없거나 모르는 값이면 거부한다", () => {
    expect(parsePurgeRange({ scope: null, game: null, setCode: null })).toEqual({
      error: "scope_missing",
    });
    expect(parsePurgeRange({ scope: "everything", game: null, setCode: null })).toEqual({
      error: "scope_missing",
    });
  });

  it("🚨 --scope all에 --set이 붙으면 거부한다 — 세트를 지우려던 의도가 전량 삭제가 되는 것을 막는다", () => {
    expect(parsePurgeRange({ scope: "all", game: null, setCode: "OPK-14" })).toEqual({
      error: "set_unexpected",
    });
    expect(parsePurgeRange({ scope: "all", game: "opcg", setCode: null })).toEqual({
      error: "game_unexpected",
    });
  });

  it("scope game은 --game을 요구하고 --set을 거부한다", () => {
    expect(parsePurgeRange({ scope: "game", game: null, setCode: null })).toEqual({
      error: "game_required",
    });
    expect(parsePurgeRange({ scope: "game", game: "opcg", setCode: "OPK-14" })).toEqual({
      error: "set_unexpected",
    });
    expect(parsePurgeRange({ scope: "game", game: "opcg", setCode: null })).toEqual({
      range: RANGE_GAME,
    });
  });

  it("scope set은 둘 다 요구한다", () => {
    expect(parsePurgeRange({ scope: "set", game: "opcg", setCode: null })).toEqual({
      error: "set_required",
    });
    expect(parsePurgeRange({ scope: "set", game: "opcg", setCode: "OPK-14" })).toEqual({
      range: RANGE_SET,
    });
  });
});

describe("purgePrefix · selectObjects", () => {
  const objects = [
    object("opcg/OPK-14/OP14-001.webp"),
    object("opcg/OPK-14/OP14-002.webp"),
    object("opcg/PROMO/OP01-004_P1.webp"),
    object("ptcg/SV1/001.webp"),
  ];

  it("all은 버킷 전체다", () => {
    expect(purgePrefix(RANGE_ALL)).toBe("");
    expect(selectObjects(objects, RANGE_ALL)).toHaveLength(4);
  });

  it("game은 게임 아래 전부다", () => {
    expect(purgePrefix(RANGE_GAME)).toBe("opcg/");
    expect(selectObjects(objects, RANGE_GAME)).toHaveLength(3);
  });

  it("set은 그 세트만이다", () => {
    expect(purgePrefix(RANGE_SET)).toBe("opcg/OPK-14/");
    expect(selectObjects(objects, RANGE_SET).map((o) => o.name)).toEqual([
      "opcg/OPK-14/OP14-001.webp",
      "opcg/OPK-14/OP14-002.webp",
    ]);
  });

  it("🚨 접두사가 세트 경계에서 끊긴다 — OPK-1이 OPK-14를 삼키지 않는다", () => {
    const tricky = [object("opcg/OPK-1/a.webp"), object("opcg/OPK-14/b.webp")];
    const selected = selectObjects(tricky, { scope: "set", game: "opcg", setCode: "OPK-1" });
    expect(selected.map((o) => o.name)).toEqual(["opcg/OPK-1/a.webp"]);
  });
});

describe("selectCards", () => {
  const cards = [
    card("1", "opcg", "OPK-14"),
    card("2", "opcg", "PROMO"),
    card("3", "ptcg", "SV1"),
    card("4", "opcg", "OPK-14", null),
  ];

  it("범위대로 고른다", () => {
    expect(selectCards(cards, RANGE_ALL)).toHaveLength(4);
    expect(selectCards(cards, RANGE_GAME)).toHaveLength(3);
    expect(selectCards(cards, RANGE_SET)).toHaveLength(2);
  });

  it("⚠️ image_url이 이미 null인 행도 범위에는 든다 — 「없다」와 「범위 밖」은 다르다", () => {
    const selected = selectCards(cards, RANGE_SET);
    expect(selected).toHaveLength(2);
    expect(selected.filter((c) => c.imageUrl !== null)).toHaveLength(1);
  });
});

describe("buildPurgePlan", () => {
  const objects = [object("opcg/OPK-14/a.webp", 1000), object("opcg/OPK-14/b.webp", 2000)];
  const cards = [card("1", "opcg", "OPK-14"), card("2", "opcg", "OPK-14", null)];

  it("객체 수 · 바이트 · 비울 행 수를 센다", () => {
    const plan = buildPurgePlan({
      range: RANGE_SET,
      objects,
      cards,
      localFiles: [],
      includeSourceUrl: false,
      local: false,
    });
    expect(plan.objectCount).toBe(2);
    expect(plan.totalBytes).toBe(3000);
    expect(plan.cardCount).toBe(2);
    expect(plan.imageUrlToClear).toBe(1);
  });

  it("🚨 선택 인자는 기본이 꺼짐이다 — 켜지 않으면 0이다 (ⓓ)", () => {
    const plan = buildPurgePlan({
      range: RANGE_SET,
      objects,
      cards,
      localFiles: ["data/images/opcg/OPK-14/a.webp"],
      includeSourceUrl: false,
      local: false,
    });
    expect(plan.sourceUrlToClear).toBe(0);
    expect(plan.localFileCount).toBe(0);
  });

  it("--include-source-url · --local을 켜면 센다", () => {
    const plan = buildPurgePlan({
      range: RANGE_SET,
      objects,
      cards,
      localFiles: ["data/images/opcg/OPK-14/a.webp", "data/images/opcg/PROMO/x.webp"],
      includeSourceUrl: true,
      local: true,
    });
    expect(plan.sourceUrlToClear).toBe(2);
    expect(plan.localFileCount).toBe(1);
  });

  it("샘플은 최대 20건이다 (ⓑ)", () => {
    const many = Array.from({ length: 50 }, (_, i) => object(`opcg/OPK-14/${i}.webp`));
    const plan = buildPurgePlan({
      range: RANGE_SET,
      objects: many,
      cards,
      localFiles: [],
      includeSourceUrl: false,
      local: false,
    });
    expect(plan.sample).toHaveLength(20);
  });
});

describe("purgeConclusion — 대상 0건은 초록이 아니다", () => {
  const empty = buildPurgePlan({
    range: RANGE_SET,
    objects: [],
    cards: [],
    localFiles: [],
    includeSourceUrl: false,
    local: false,
  });

  it("🚨 지울 것이 없으면 초록이 아니다 — 「깨끗이 지웠다」와 「못 찾았다」를 섞지 않는다", () => {
    const conclusion = purgeConclusion(empty);
    expect(conclusion.ok).toBe(false);
    expect(conclusion.code).toBe("nothing_to_purge");
    expect(conclusion.line).toContain("지울 것이 없다");
  });

  it("버킷이 비어도 DB에 지울 행이 있으면 초록이다", () => {
    const plan = buildPurgePlan({
      range: RANGE_SET,
      objects: [],
      cards: [card("1", "opcg", "OPK-14")],
      localFiles: [],
      includeSourceUrl: false,
      local: false,
    });
    expect(purgeConclusion(plan).ok).toBe(true);
  });

  it("초록 결론이 객체 수와 범위를 담는다", () => {
    const plan = buildPurgePlan({
      range: RANGE_SET,
      objects: [object("opcg/OPK-14/a.webp", 2048)],
      cards: [card("1", "opcg", "OPK-14")],
      localFiles: [],
      includeSourceUrl: false,
      local: false,
    });
    const line = purgeConclusion(plan).line;
    expect(line).toContain("초록");
    expect(line).toContain("객체 1건");
    expect(line).toContain("game=opcg set=OPK-14");
  });
});

describe("decideApply — 드라이런이 기본이다 (ⓐ · ⓑ)", () => {
  const green = purgeConclusion(
    buildPurgePlan({
      range: RANGE_SET,
      objects: [object("opcg/OPK-14/a.webp")],
      cards: [card("1", "opcg", "OPK-14")],
      localFiles: [],
      includeSourceUrl: false,
      local: false,
    }),
  );
  const red = purgeConclusion(
    buildPurgePlan({
      range: RANGE_SET,
      objects: [],
      cards: [],
      localFiles: [],
      includeSourceUrl: false,
      local: false,
    }),
  );

  it("🚨 --apply가 없으면 한 객체도 지우지 않는다", () => {
    expect(decideApply({ apply: false, conclusion: green })).toEqual({
      allowed: false,
      reason: "not_requested",
    });
  });

  it("🚨 결론이 초록이 아니면 --apply여도 거부한다", () => {
    expect(decideApply({ apply: true, conclusion: red })).toEqual({
      allowed: false,
      reason: "conclusion_not_green",
    });
  });

  it("초록 + --apply일 때만 허용한다", () => {
    expect(decideApply({ apply: true, conclusion: green })).toEqual({ allowed: true });
  });
});

describe("purgeSteps — 🚨 DB를 버킷보다 먼저 비운다 (§9.4 ⓕ-4의 1→2)", () => {
  function planWith(includeSourceUrl: boolean, local: boolean) {
    return buildPurgePlan({
      range: RANGE_SET,
      objects: [object("opcg/OPK-14/a.webp")],
      cards: [card("1", "opcg", "OPK-14")],
      localFiles: ["data/images/opcg/OPK-14/a.webp"],
      includeSourceUrl,
      local,
    });
  }

  it("🚨 clear_image_url이 delete_objects보다 앞이다 — 이 단언이 이 파일의 존재 이유 절반이다", () => {
    // 순서가 뒤집히면 파일은 없는데 DB가 URL을 가리키는 창이 생기고,
    // 그동안 화면이 404를 그린다.
    const steps = planWith(false, false);
    const order = purgeSteps(steps);
    expect(order.indexOf("clear_image_url")).toBeLessThan(order.indexOf("delete_objects"));
    expect(order[0]).toBe("clear_image_url");
  });

  it("선택 단계는 켤 때만 들어간다", () => {
    expect(purgeSteps(planWith(false, false))).toEqual([
      "clear_image_url",
      "delete_objects",
      "verify_sample",
      "write_report",
    ]);
    expect(purgeSteps(planWith(true, true))).toEqual([
      "clear_image_url",
      "delete_objects",
      "clear_source_image_url",
      "delete_local",
      "verify_sample",
      "write_report",
    ]);
  });

  it("표본 검증과 리포트가 언제나 마지막 둘이다 (ⓔ · ⓕ)", () => {
    const order = purgeSteps(planWith(true, true));
    expect(order.slice(-2)).toEqual(["verify_sample", "write_report"]);
  });
});

describe("pickVerifySample — 무작위 20건 (ⓔ)", () => {
  const objects = Array.from({ length: 100 }, (_, i) => object(`opcg/OPK-14/${i}.webp`));

  it("20건을 고른다", () => {
    expect(pickVerifySample(objects, () => 0.5)).toHaveLength(20);
  });

  it("대상이 20건보다 적으면 있는 만큼만 고른다", () => {
    expect(pickVerifySample(objects.slice(0, 7), () => 0.5)).toHaveLength(7);
    expect(pickVerifySample([], () => 0.5)).toHaveLength(0);
  });

  it("🚨 rng가 인자다 — 무작위를 테스트할 수 있어야 절차가 검증된다", () => {
    const a = pickVerifySample(objects, () => 0);
    const b = pickVerifySample(objects, () => 0.999);
    expect(a).not.toEqual(b);
  });

  it("고른 것에 중복이 없다", () => {
    let seed = 0;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const picked = pickVerifySample(objects, rng);
    expect(new Set(picked).size).toBe(picked.length);
  });
});

describe("formatPurgePlan — 드라이런 출력 (ⓑ)", () => {
  const plan = buildPurgePlan({
    range: RANGE_SET,
    objects: [object("opcg/OPK-14/a.webp", 47000), object("opcg/OPK-14/b.webp", 47000)],
    cards: [card("1", "opcg", "OPK-14")],
    localFiles: [],
    includeSourceUrl: false,
    local: false,
  });
  const text = formatPurgePlan(plan, purgeConclusion(plan));

  it("객체 수 · 경로 접두사 · 샘플 · 결론을 전부 낸다", () => {
    expect(text).toContain("버킷 객체    : 2건");
    expect(text).toContain("opcg/OPK-14/");
    expect(text).toContain("opcg/OPK-14/a.webp");
    expect(text).toContain("결론: 초록");
  });

  it("기본 꺼짐인 두 옵션을 「건드리지 않는다」로 명시한다 — 침묵하지 않는다", () => {
    expect(text).toContain("source_image_url : 건드리지 않는다 (기본)");
    expect(text).toContain("로컬 data/images : 건드리지 않는다 (기본)");
  });

  it("실행 순서를 출력에 적는다 — 사람이 순서를 눈으로 확인한다", () => {
    expect(text).toContain("DB를 먼저 비우고 버킷을 지운다");
    expect(text.indexOf("clear_image_url")).toBeLessThan(text.indexOf("delete_objects"));
  });
});

describe("isObjectGone — ⓔ의 「404 확인」은 실물과 달랐다 (2026-08-30 실측)", () => {
  // 🚨 Supabase Storage는 없는 객체에 HTTP 400을 준다. 404는 본문 안에 있다.
  // ⓔ를 문자 그대로 구현하면 정상 회수가 전부 「남아 있다」로 오보되고,
  // 그러면 회수 절차가 스스로를 검증하지 못한다.
  const gone400 = '{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}';

  it("🚨 400 + NoSuchKey를 「사라졌다」로 읽는다 — 실측한 실제 응답이다", () => {
    expect(isObjectGone(400, gone400)).toBe(true);
  });

  it("순수한 404도 「사라졌다」다 — 원격이 다르게 답할 수 있다", () => {
    expect(isObjectGone(404, null)).toBe(true);
  });

  it("🚨 200은 남아 있는 것이다", () => {
    expect(isObjectGone(200, null)).toBe(false);
  });

  it("⚠️ 모르는 응답은 「사라졌다」로 읽지 않는다 — 증명 못 하면 남아 있는 것으로 센다", () => {
    expect(isObjectGone(500, null)).toBe(false);
    expect(isObjectGone(403, null)).toBe(false);
    expect(isObjectGone(400, '{"error":"something else"}')).toBe(false);
    expect(isObjectGone(400, null)).toBe(false);
  });
});
