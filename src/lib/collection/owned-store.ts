// 소유 카드 저장소 어댑터 (plan §4.13 ⓔ).
//
// 여기만 브라우저를 안다. 완성도 계산은 @/lib/domain/achievement/completion이
// 하고 그쪽은 이 파일을 모른다. 가른 이유는 T3.2(계정 기반)가 같은 인터페이스의
// 두 번째 구현이 되게 하기 위해서다 — 이 모양을 지금 고정하는 것이 목적이다.

/** T3.2가 계정 기반으로 다시 구현할 인터페이스. */
export interface OwnedCardStore {
  read(): Promise<readonly string[]>;
  add(keys: readonly string[]): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  clear(): Promise<void>;
  /** 저장소가 실제로 동작하는가. false면 화면이 고지한다 — §4.13 ⓔ-3. */
  readonly available: boolean;
  readonly kind: "local" | "memory" | "account";
}

/**
 * 게임을 가로지르는 단일 키. 항목마다 `<gameCode>:` 접두가 붙는다.
 *
 * 키를 게임별로 쪼개지 않는 이유는 접두 자체가 그 일을 하기 때문이다 —
 * code가 게임을 가로질러 유일하다는 보장을 확인하지 못했고(§4.9 ⓑ가
 * card_sets.code에 대해 같은 유보를 적었다), 접두는 그 미확인을 값으로 막는다.
 *
 * 저장하는 것은 cards.code이지 cards.id(uuid)가 아니다. id는
 * gen_random_uuid() 기본값이라 카탈로그를 다시 넣으면 바뀌고, 그러면
 * 사용자의 체크가 통째로 사라진다 (§4.13 ⓔ-1).
 */
export const OWNED_STORAGE_KEY = "deckbinder.owned.v1";

/**
 * localStorage를 만지는 유일한 자리. 속성 접근 · 읽기 · 쓰기 셋 다 try/catch다.
 *
 * `typeof window !== "undefined"` 하나로는 부족하다 — window.localStorage는
 * 속성 접근만으로 던질 수 있다(쿠키 차단 설정 · 일부 프라이빗 모드 ·
 * 샌드박스 iframe). 쓰기는 QuotaExceededError로 따로 던진다 (§4.13 ⓔ-2).
 */
function createLocalBackend(): {
  readAll: () => string[];
  writeAll: (keys: readonly string[]) => void;
  isUsable: () => boolean;
} {
  let usable = true;

  function storage(): Storage {
    // 이 접근 자체가 던질 수 있다. 부르는 쪽이 전부 try 안이다.
    return globalThis.localStorage;
  }

  function readAll(): string[] {
    let raw: string | null;

    try {
      raw = storage().getItem(OWNED_STORAGE_KEY);
    } catch {
      usable = false;
      return [];
    }

    if (raw === null) return [];

    try {
      const parsed: unknown = JSON.parse(raw);

      // 형식이 아니면 빈 배열로 착지하되 지우지는 않는다. 사용자의 데이터일
      // 수도 있는 것을 우리가 판단해서 버리지 않는다 (§4.13 ⓗ 저장소 ③).
      if (!Array.isArray(parsed)) return [];

      return parsed.filter((key): key is string => typeof key === "string");
    } catch {
      return [];
    }
  }

  function writeAll(keys: readonly string[]): void {
    try {
      storage().setItem(OWNED_STORAGE_KEY, JSON.stringify(keys));
    } catch {
      // 던지지 않는다. 대신 available을 내려 화면이 고지할 수 있게 한다 —
      // 체크가 되는 것처럼 보이게 하고 조용히 버리는 것이 이 절이 막는 것이다.
      usable = false;
    }
  }

  // 생성 시점에 한 번 만져 본다. 읽기만 하므로 사용자의 저장소를 더럽히지 않는다.
  readAll();

  return { readAll, writeAll, isUsable: () => usable };
}

/**
 * 브라우저 로컬 저장소 구현. `gameCode`로 좁힌 시야를 준다.
 *
 * 접두를 붙이고 떼는 것은 저장소의 일이고, 도메인은 그냥 string으로 받는다.
 * 그래서 add·remove·read는 전부 접두 없는 `cards.code`로 말한다.
 */
export function createLocalOwnedStore(gameCode: string): OwnedCardStore {
  const backend = createLocalBackend();
  const prefix = `${gameCode}:`;

  function mine(all: readonly string[]): string[] {
    return all.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  }

  return {
    kind: "local",
    get available() {
      return backend.isUsable();
    },

    async read() {
      return mine(backend.readAll());
    },

    async add(keys) {
      const all = backend.readAll();
      const next = [...all];

      for (const key of keys) {
        const stored = prefix + key;
        if (!next.includes(stored)) next.push(stored);
      }

      backend.writeAll(next);
    },

    async remove(keys) {
      const dropped = new Set(keys.map((key) => prefix + key));

      backend.writeAll(backend.readAll().filter((key) => !dropped.has(key)));
    },

    async clear() {
      // 이 게임의 몫만 지운다. 다른 게임의 체크는 우리 것이 아니다.
      backend.writeAll(backend.readAll().filter((key) => !key.startsWith(prefix)));
    },
  };
}

/**
 * localStorage에 손도 못 댈 때의 착지점. 던지지 않는다.
 *
 * 한 세션 동안만 산다 — 그것이 available이 true인데도 화면이 §4.13 ⓔ-3의
 * 한계를 계속 적어야 하는 이유다.
 */
export function createMemoryOwnedStore(): OwnedCardStore {
  const keys: string[] = [];

  return {
    kind: "memory",
    available: true,

    async read() {
      return [...keys];
    },

    async add(incoming) {
      for (const key of incoming) {
        if (!keys.includes(key)) keys.push(key);
      }
    },

    async remove(outgoing) {
      const dropped = new Set(outgoing);

      for (let i = keys.length - 1; i >= 0; i -= 1) {
        if (dropped.has(keys[i])) keys.splice(i, 1);
      }
    },

    async clear() {
      keys.length = 0;
    },
  };
}
