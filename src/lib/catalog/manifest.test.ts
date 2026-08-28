import { describe, expect, it } from "vitest";

import { latestManifestFilename, recoverFromManifest } from "./manifest";

/**
 * 리뷰 결함 2 — 재실행이 나머지 페이지를 건너뛰고 "정상 완주(exit 0)"로
 * 끝났다. 원인은 매니페스트를 **읽는** 코드가 없었던 것이다(쓰기만 있었다).
 * 이 판단(어느 파일이 최신인가 · 유효한가 · lastPageIndex가 무엇인가)을
 * `src/lib/catalog/manifest.ts`로 옮기고 여기서 고정한다.
 */
describe("latestManifestFilename", () => {
  it("1. 빈 배열 → null", () => {
    expect(latestManifestFilename([])).toBeNull();
  });

  it("2. manifest-*.json이 아닌 파일은 후보에서 제외한다", () => {
    expect(latestManifestFilename(["cards.jsonl", "cards.jsonl.bak-20260828T000000Z"])).toBeNull();
  });

  it("3. 여러 매니페스트 중 사전식(=시간순) 최댓값을 고른다 — 입력 순서와 무관하다", () => {
    const filenames = [
      "manifest-20260828T090000Z.json",
      "manifest-20260828T120000Z.json",
      "manifest-20260827T235959Z.json",
    ];
    expect(latestManifestFilename(filenames)).toBe("manifest-20260828T120000Z.json");
  });

  it("4. 무관한 파일과 섞여 있어도 최신 매니페스트만 고른다", () => {
    const filenames = ["cards.jsonl", "manifest-20260828T090000Z.json", "manifest-broken.json"];
    expect(latestManifestFilename(filenames)).toBe("manifest-20260828T090000Z.json");
  });
});

describe("recoverFromManifest", () => {
  it("5. 유효한 매니페스트 → lastPageIndex를 그대로 복구한다", () => {
    expect(recoverFromManifest({ schemaVersion: 1, lastPageIndex: 7 })).toEqual({ found: true, lastPageIndex: 7 });
  });

  it("6. lastPageIndex: null은 「1페이지짜리 세트, 완주」라는 유효한 값이다 — found: true로 복구한다", () => {
    expect(recoverFromManifest({ schemaVersion: 1, lastPageIndex: null })).toEqual({
      found: true,
      lastPageIndex: null,
    });
  });

  it("7. lastPageIndex: 0도 유효하다 (falsy지만 페이지 인덱스로는 유효)", () => {
    expect(recoverFromManifest({ schemaVersion: 1, lastPageIndex: 0 })).toEqual({ found: true, lastPageIndex: 0 });
  });

  it("8. schemaVersion이 1이 아니면 신뢰하지 않는다 → found: false", () => {
    expect(recoverFromManifest({ schemaVersion: 2, lastPageIndex: 7 })).toEqual({ found: false });
  });

  it("9. lastPageIndex가 숫자·null이 아니면 신뢰하지 않는다 → found: false", () => {
    expect(recoverFromManifest({ schemaVersion: 1, lastPageIndex: "7" })).toEqual({ found: false });
    expect(recoverFromManifest({ schemaVersion: 1, lastPageIndex: -1 })).toEqual({ found: false });
    expect(recoverFromManifest({ schemaVersion: 1, lastPageIndex: 1.5 })).toEqual({ found: false });
  });

  it("10. lastPageIndex 필드 자체가 없으면 신뢰하지 않는다 → found: false", () => {
    expect(recoverFromManifest({ schemaVersion: 1 })).toEqual({ found: false });
  });

  it("11. 객체가 아니거나 null·배열이면 신뢰하지 않는다 → found: false", () => {
    expect(recoverFromManifest(null)).toEqual({ found: false });
    expect(recoverFromManifest("broken")).toEqual({ found: false });
    expect(recoverFromManifest(42)).toEqual({ found: false });
  });
});
