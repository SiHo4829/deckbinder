import { describe, expect, it } from "vitest";

import { toPrintingFacts } from "@/lib/cards/printing-facts";

describe("toPrintingFacts", () => {
  const baseRow = {
    rarity: "SR",
    illustration_type: "오리지널",
    code: "ST01-001",
    base_code: "ST01-001",
  };

  it("정상 행 → 필드 여섯이 제대로 옮겨진다", () => {
    const facts = toPrintingFacts(
      baseRow,
      { printingsInGroup: 3 },
      { peerCount: 2, setSize: 40 },
    );

    expect(facts).toEqual({
      rarityLabel: "SR",
      illustration: "오리지널",
      isAlternatePrinting: false,
      printingsInGroup: 3,
      peerCount: 2,
      setSize: 40,
    });
  });

  it("rarity가 null → rarityLabel이 null", () => {
    const facts = toPrintingFacts(
      { ...baseRow, rarity: null },
      { printingsInGroup: 1 },
      { peerCount: 1, setSize: 40 },
    );

    expect(facts.rarityLabel).toBeNull();
  });

  it("setPeers가 null(set_id를 모른다) → set_unknown으로 떨어지는 값(setSize 0)", () => {
    const facts = toPrintingFacts(baseRow, { printingsInGroup: 1 }, null);

    expect(facts.peerCount).toBe(0);
    expect(facts.setSize).toBe(0);
  });

  it("code === base_code → isAlternatePrinting은 false", () => {
    const facts = toPrintingFacts(
      { ...baseRow, code: "ST01-001", base_code: "ST01-001" },
      { printingsInGroup: 1 },
      { peerCount: 1, setSize: 10 },
    );

    expect(facts.isAlternatePrinting).toBe(false);
  });

  it("code !== base_code → isAlternatePrinting은 true", () => {
    const facts = toPrintingFacts(
      { ...baseRow, code: "ST01-001_p1", base_code: "ST01-001" },
      { printingsInGroup: 2 },
      { peerCount: 1, setSize: 10 },
    );

    expect(facts.isAlternatePrinting).toBe(true);
  });

  it("illustration_type이 null → illustration이 null", () => {
    const facts = toPrintingFacts(
      { ...baseRow, illustration_type: null },
      { printingsInGroup: 1 },
      { peerCount: 1, setSize: 10 },
    );

    expect(facts.illustration).toBeNull();
  });

  it("printingsInGroup이 자기 자신을 포함한다 — 대체본 0건이면 1", () => {
    const facts = toPrintingFacts(
      baseRow,
      { printingsInGroup: 1 },
      { peerCount: 1, setSize: 10 },
    );

    expect(facts.printingsInGroup).toBe(1);
  });
});
