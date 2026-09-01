import { afterEach, describe, expect, it } from "vitest";

import {
  OWNED_STORAGE_KEY,
  createLocalOwnedStore,
  createMemoryOwnedStore,
  type OwnedCardStore,
} from "@/lib/collection/owned-store";

// 여기만 브라우저를 안다. 계산은 completion.ts가 한다 (plan §4.13 ⓔ).
//
// window.localStorage는 속성 접근만으로 던질 수 있다 — 쿠키 차단 설정 ·
// 일부 프라이빗 모드 · 샌드박스 iframe. typeof window 검사 하나로는 부족하다.
// 그 환경을 흉내 내려면 전역 속성 자체를 바꿔 끼워야 한다 (§4.13 ⓔ-2).

const REAL_LOCAL_STORAGE = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function restoreLocalStorage(): void {
  if (REAL_LOCAL_STORAGE) {
    Object.defineProperty(globalThis, "localStorage", REAL_LOCAL_STORAGE);
  }
}

function installLocalStorage(stub: Partial<Storage>): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => stub as Storage,
  });
}

/** 속성 접근 자체가 던지는 환경. typeof window로는 잡히지 않는다. */
function installHostileLocalStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
}

afterEach(() => {
  restoreLocalStorage();
  try {
    localStorage.clear();
  } catch {
    // 복원에 실패한 회차는 다음 테스트가 다시 끼워 넣는다.
  }
});

describe("createLocalOwnedStore — 저장소가 없는 환경", () => {
  it("속성 접근이 던져도 생성이 던지지 않고 available이 false다", async () => {
    installHostileLocalStorage();

    const store = createLocalOwnedStore("op");

    expect(store.available).toBe(false);
    expect(store.kind).toBe("local");
    // 체크가 되는 것처럼 보이게 하고 조용히 버리지 않는다 — 읽기도 던지지 않는다.
    await expect(store.add(["OP14-001"])).resolves.toBeUndefined();
    await expect(store.read()).resolves.toEqual([]);
  });

  it("쓰기가 QuotaExceededError를 던져도 던지지 않는다", async () => {
    installLocalStorage({
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
    });

    const store = createLocalOwnedStore("op");

    await expect(store.add(["OP14-001"])).resolves.toBeUndefined();
    // 쓰기가 버려졌다는 것을 화면이 알 수 있어야 한다 (§4.13 ⓔ-3).
    expect(store.available).toBe(false);
  });

  it("깨진 JSON은 빈 배열로 복구하고 지우지 않는다", async () => {
    localStorage.setItem(OWNED_STORAGE_KEY, "{이건 JSON이 아니다");

    const store = createLocalOwnedStore("op");

    await expect(store.read()).resolves.toEqual([]);
    // 사용자의 데이터일 수도 있는 것을 우리가 판단해서 지우지 않는다.
    expect(localStorage.getItem(OWNED_STORAGE_KEY)).toBe("{이건 JSON이 아니다");
  });
});

describe("createLocalOwnedStore — 정상 환경", () => {
  it("저장 키에 gameCode 접두가 붙고 다른 게임을 건드리지 않는다", async () => {
    const onePiece = createLocalOwnedStore("op");
    const pokemon = createLocalOwnedStore("ptcg");

    await onePiece.add(["OP14-001", "OP14-002"]);
    await pokemon.add(["OP14-001"]);

    // code가 게임을 가로질러 유일하다는 보장을 확인하지 못했다 (§4.13 ⓔ-1).
    const raw = JSON.parse(localStorage.getItem(OWNED_STORAGE_KEY) as string);
    expect(raw).toContain("op:OP14-001");
    expect(raw).toContain("ptcg:OP14-001");

    // 접두를 붙이는 것은 저장소의 일이고 도메인은 그냥 string으로 받는다.
    await expect(onePiece.read()).resolves.toEqual(["OP14-001", "OP14-002"]);
    await expect(pokemon.read()).resolves.toEqual(["OP14-001"]);

    await onePiece.remove(["OP14-001"]);
    await expect(onePiece.read()).resolves.toEqual(["OP14-002"]);
    await expect(pokemon.read()).resolves.toEqual(["OP14-001"]);

    await onePiece.clear();
    await expect(onePiece.read()).resolves.toEqual([]);
    // clear는 이 게임의 몫만 지운다.
    await expect(pokemon.read()).resolves.toEqual(["OP14-001"]);
  });

  it("같은 코드를 두 번 넣어도 한 번만 센다", async () => {
    const store = createLocalOwnedStore("op");

    await store.add(["OP14-001", "OP14-001"]);
    await store.add(["OP14-001"]);

    await expect(store.read()).resolves.toEqual(["OP14-001"]);
  });
});

describe("createMemoryOwnedStore", () => {
  it("같은 인터페이스를 만족하고 던지지 않는다", async () => {
    const store: OwnedCardStore = createMemoryOwnedStore();

    expect(store.kind).toBe("memory");
    expect(store.available).toBe(true);

    await store.add(["a", "b", "a"]);
    await expect(store.read()).resolves.toEqual(["a", "b"]);

    await store.remove(["a"]);
    await expect(store.read()).resolves.toEqual(["b"]);

    await store.clear();
    await expect(store.read()).resolves.toEqual([]);
  });

  // localStorage에 손도 못 댈 때의 착지점이다. 던지지 않는 것이 요건이다.
  it("저장소가 없는 환경에서도 만들어진다", async () => {
    installHostileLocalStorage();

    const store = createMemoryOwnedStore();

    await store.add(["a"]);
    await expect(store.read()).resolves.toEqual(["a"]);
  });
});
