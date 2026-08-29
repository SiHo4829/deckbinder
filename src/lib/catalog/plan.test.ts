import { describe, expect, it } from "vitest";

import {
  buildImportPlan,
  type BuildImportPlanInput,
  type ExistingCardRow,
} from "@/lib/catalog/plan";
import type { NormalizedCard, NumericField } from "@/lib/validation/catalog";

function num(value: number | null, raw = String(value ?? "-")): NumericField {
  return { value, invalid: false, raw };
}

const baseCard: NormalizedCard = {
  sourceSetLabel: "[STK-27] 스타터 덱",
  code: "OP01-001",
  codeInvalid: false,
  codeMultipleUnderscoresWarning: false,
  nameKo: "테스트 카드",
  cardType: "캐릭터",
  colors: ["적색"],
  life: num(5000, "5000"),
  power: num(5000, "5000"),
  counter: num(1000, "1000"),
  attribute: "타격",
  traits: ["초신성"],
  rarity: "R",
  effectText: "효과 텍스트",
  triggerText: "",
  illustrationType: "오리지널",
  blockNumber: num(2, "2"),
  imageUrl: "https://onepiece-cardgame.kr/fileDownload?downname=abc",
  page: 1,
};

function nCard(overrides: Partial<NormalizedCard>): NormalizedCard {
  return { ...baseCard, ...overrides };
}

const game = { code: "opcg", id: "game-1" };
const set = { code: "OP01", id: "set-op01" };

function baseInput(overrides: Partial<BuildImportPlanInput>): BuildImportPlanInput {
  return {
    game,
    set,
    cards: [baseCard],
    existing: [],
    mode: "insert-only",
    ...overrides,
  };
}

describe("buildImportPlan — 분류 5종", () => {
  it("1. insert — DB에 없는 code", () => {
    const plan = buildImportPlan(baseInput({}));
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.verdict).toBe("insert");
    expect(plan.conclusion).toEqual({
      ok: true,
      counts: { total: 1, insert: 1, skipSameSet: 0, skipOtherSet: 0, update: 0, invalid: 0 },
    });
  });

  it("2. skip:same_set — 이미 있고 set_id가 --set과 같다", () => {
    const existing: ExistingCardRow[] = [{ code: "OP01-001", set_id: "set-op01", values: {} }];
    const plan = buildImportPlan(baseInput({ existing }));
    expect(plan.rows[0]?.verdict).toBe("skip:same_set");
  });

  it("3. skip:other_set — 이미 있고 set_id가 다르다", () => {
    const existing: ExistingCardRow[] = [{ code: "OP01-001", set_id: "set-other", values: {} }];
    const plan = buildImportPlan(baseInput({ existing }));
    expect(plan.rows[0]?.verdict).toBe("skip:other_set");
    expect(plan.rows[0]?.existingSetId).toBe("set-other");
  });

  it("4. update — --update에서 화이트리스트 컬럼 중 값이 다른 것이 있다", () => {
    const existing: ExistingCardRow[] = [
      { code: "OP01-001", set_id: "set-op01", values: { power: 1, name_ko: "옛 이름" } },
    ];
    const plan = buildImportPlan(baseInput({ existing, mode: "update" }));
    expect(plan.rows[0]?.verdict).toBe("update");
    expect(plan.rows[0]?.changes.length).toBeGreaterThan(0);
    expect(plan.rows[0]?.changes).toContainEqual({ column: "power", before: 1, after: 5000 });
  });

  it("5. invalid — 정규화가 ok:false다", () => {
    const plan = buildImportPlan(baseInput({ cards: [nCard({ cardType: "" })] }));
    expect(plan.rows[0]?.verdict).toBe("invalid");
    expect(plan.rows[0]?.row).toBeNull();
    expect(plan.rows[0]?.issues.length).toBeGreaterThan(0);
  });
});

it("6. 🚨 실측 3건이 PROMO 적재 뒤 STK 적재에서 skip:other_set으로 분류된다", () => {
  const promoCodes = ["OP09-089_P1", "OP06-110_P1", "OP09-043_P1"] as const;
  const existing: ExistingCardRow[] = promoCodes.map((code) => ({
    code,
    set_id: "set-promo", // 적재 순서 규칙(§4.8 ⓕ ★4)대로 PROMO가 먼저 굳었다
    values: {},
  }));
  const cards = promoCodes.map((code) => nCard({ code }));
  const plan = buildImportPlan(
    baseInput({ cards, existing, set: { code: "STK-27", id: "set-stk-27" } }),
  );
  expect(plan.rows).toHaveLength(3);
  for (const row of plan.rows) {
    expect(row.verdict).toBe("skip:other_set");
    expect(row.existingSetId).toBe("set-promo");
  }
});

it("7. --update에서 값이 같으면 update가 아니라 skip:same_set이다(빈 changes로 update를 만들지 않는다)", () => {
  const existing: ExistingCardRow[] = [
    {
      code: "OP01-001",
      set_id: "set-op01",
      values: {
        name_ko: "테스트 카드",
        rarity: "R",
        attribute: "타격",
        card_type: "캐릭터",
        effect_text: "효과 텍스트",
        colors: ["적색"],
        life: null,
        cost: 5000,
        power: 5000,
        counter: 1000,
        traits: ["초신성"],
        trigger_text: null,
        illustration_type: "오리지널",
        block_number: 2,
        source_image_url: baseCard.imageUrl,
      },
    },
  ];
  const plan = buildImportPlan(baseInput({ existing, mode: "update" }));
  expect(plan.rows[0]?.verdict).toBe("skip:same_set");
  expect(plan.rows[0]?.changes).toEqual([]);
});

it("8. 🚨 changes에 name_ja·code·set_id·game_id·image_url이 어떤 경우에도 나오지 않는다", () => {
  const existing: ExistingCardRow[] = [{ code: "OP01-001", set_id: "set-op01", values: {} }];
  const plan = buildImportPlan(baseInput({ existing, mode: "update" }));
  const columns = plan.rows[0]?.changes.map((c) => c.column) ?? [];
  for (const forbidden of ["name_ja", "code", "set_id", "game_id", "image_url"]) {
    expect(columns).not.toContain(forbidden);
  }
});

it("9. set이 null → 결론 적재 불가:set_not_found · 행 분류를 시도하지 않는다", () => {
  const plan = buildImportPlan(baseInput({ set: null }));
  expect(plan.conclusion).toEqual({ ok: false, reason: "set_not_found" });
  expect(plan.rows).toEqual([]);
});

it("10. game이 null → game_not_found", () => {
  const plan = buildImportPlan(baseInput({ game: null }));
  expect(plan.conclusion).toEqual({ ok: false, reason: "game_not_found" });
  expect(plan.rows).toEqual([]);
});

it("11. 파일 안 code 중복 → duplicate_code_in_file · 전건 중단", () => {
  const plan = buildImportPlan(
    baseInput({ cards: [nCard({ code: "OP01-001" }), nCard({ code: "OP01-001" })] }),
  );
  expect(plan.conclusion).toEqual({ ok: false, reason: "duplicate_code_in_file" });
  expect(plan.rows).toEqual([]);
});

it("12. 빈 파일 → empty_file", () => {
  const plan = buildImportPlan(baseInput({ cards: [] }));
  expect(plan.conclusion).toEqual({ ok: false, reason: "empty_file" });
});

it("13. 대소문자가 다른 code는 다른 카드다(_P1 vs _p1)", () => {
  const plan = buildImportPlan(
    baseInput({ cards: [nCard({ code: "OP01-001_P1" }), nCard({ code: "OP01-001_p1" })] }),
  );
  expect(plan.conclusion.ok).toBe(true);
  expect(plan.rows).toHaveLength(2);
  expect(plan.rows.map((r) => r.code)).toEqual(["OP01-001_P1", "OP01-001_p1"]);
});

describe("접두사 불일치 비율", () => {
  it("14. r = 0 — 전부 --set과 접두사가 같다", () => {
    const cards = [nCard({ code: "OP01-001" }), nCard({ code: "OP01-002" })];
    const plan = buildImportPlan(baseInput({ cards }));
    expect(plan.rows.every((r) => !r.prefixMismatch)).toBe(true);
  });

  it("15. 0 < r < 100 — 일부만 다른 접두사다(행 목록이 채워진다)", () => {
    const cards = [nCard({ code: "OP01-001" }), nCard({ code: "ST04-001" })];
    const plan = buildImportPlan(baseInput({ cards }));
    const mismatched = plan.rows.filter((r) => r.prefixMismatch);
    expect(mismatched).toHaveLength(1);
    expect(mismatched[0]?.code).toBe("ST04-001");
  });

  it("16. r = 100 — 전부 다른 접두사다(재판 전용 세트로 보인다)", () => {
    const cards = [nCard({ code: "ST04-001" }), nCard({ code: "ST04-002" })];
    const plan = buildImportPlan(baseInput({ cards }));
    expect(plan.rows.every((r) => r.prefixMismatch)).toBe(true);
  });
});
