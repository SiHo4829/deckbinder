import { describe, expect, it } from "vitest";

import { composeGameRules } from "@/lib/domain/rules";

describe("composeGameRules", () => {
  // ★ plan §4.7 ⓑ의 재하드코딩 방지 장치가 이 케이스 하나다.
  // 60/50 · 7/5 · 4를 직접 단언하면 그 테스트가 숫자를 코드에 다시 심는다.
  it("넘긴 수치를 그대로 돌려준다 — 도메인이 매수를 알지 않는다", () => {
    const rules = composeGameRules({ deckSize: 99, handSize: 3, copyLimit: 1 }, "ptcg");

    expect(rules.deckSize).toBe(99);
    expect(rules.handSize).toBe(3);
    expect(rules.copyLimit).toBe(1);
    expect(rules.code).toBe("ptcg");
  });

  it("opcg는 leader(1) · don(10) 존을 갖고 리더 색상 일치를 요구한다", () => {
    const rules = composeGameRules({ deckSize: 50, handSize: 5, copyLimit: 4 }, "opcg");

    expect(rules.leaderColorMatch).toBe(true);
    expect(rules.extraZones).toEqual([
      { zone: "leader", size: 1, countsTowardCopyLimit: false },
      { zone: "don", size: 10, countsTowardCopyLimit: false },
    ]);
    expect(rules.mulligan).toEqual({ kind: "redraw_once" });
  });

  it("ptcg는 추가 존이 없고 색상 일치를 요구하지 않는다", () => {
    const rules = composeGameRules({ deckSize: 60, handSize: 7, copyLimit: 4 }, "ptcg");

    expect(rules.extraZones).toEqual([]);
    expect(rules.leaderColorMatch).toBe(false);
    expect(rules.mulligan).toEqual({
      kind: "redraw_while_missing_role",
      role: "basic_pokemon",
      maxRedraws: Number.POSITIVE_INFINITY,
    });
  });
});
