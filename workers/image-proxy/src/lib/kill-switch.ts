/**
 * 킬 스위치 — **회수의 본체다** (plan §3.5 · §9.4 ⓖ-4).
 *
 * 🚨 자체 호스팅이었다면 회수는 "객체를 지우고 캐시 만료를 기다린다"였다.
 * 프록시에서 회수는 **"라우트를 끈다"**이고, 그것이 TTL을 캐시 효율만 보고
 * 정할 수 있게 만든 이유다. 이 파일이 그 문장이 서 있는 자리다.
 *
 * ⚠️ **환경변수로 두지 않는 이유**: 끄는 데 배포가 필요해지면 "초 단위"가
 * 깨진다. KV 키 하나로 두면 대시보드에서 즉시 켤 수 있다.
 */

/** 🚨 읽는 시점은 요청 처리 **1단계**다. 캐시 조회보다 앞이다. */
export const KILL_SWITCH_KEY = "image-proxy:kill";

/** 사람이 손으로 켤 때 쓰는 값. 자동 발동은 아래 사유를 남긴다. */
export const KILL_SWITCH_ON = "on";

export type KillReason = "manual" | "upstream_403" | "upstream_429";

export interface KillState {
  readonly killed: boolean;
  readonly reason: KillReason | null;
  /** ISO 8601. 언제 켜졌는지 사람이 읽는다. */
  readonly at: string | null;
}

/** KV의 최소 모양. 🚨 테스트가 실물 KV 없이 이 인터페이스만 만족시키면 된다. */
export interface KillSwitchStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const OFF: KillState = { killed: false, reason: null, at: null };

/**
 * 저장된 플래그를 읽어 상태로 옮긴다. **순수 함수** — 파싱만 한다.
 *
 * 🚨 **읽을 수 없거나 모양이 낯설면 「켜짐」으로 착지하지 않는다.** 값이 없는
 * 것은 실제로 꺼진 상태이고, 그것을 켜짐으로 읽으면 서비스가 이유 없이 죽는다.
 * ⚠️ 반대로 **아무 문자열이나 켜짐으로 읽는다** — 사람이 대시보드에서 급히
 * 켤 때 `"on"`을 정확히 못 적어도 켜져야 한다. 회수는 실패하는 쪽이 더 비싸다.
 */
export function parseKillState(raw: string | null): KillState {
  if (raw === null || raw.trim().length === 0) return OFF;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed !== null && typeof parsed === "object" && "reason" in parsed) {
      const record = parsed as { reason?: unknown; at?: unknown };

      return {
        killed: true,
        reason: typeof record.reason === "string" ? (record.reason as KillReason) : "manual",
        at: typeof record.at === "string" ? record.at : null,
      };
    }
  } catch {
    // JSON이 아니면 사람이 손으로 적은 값이다. 아래에서 켜짐으로 읽는다.
  }

  return { killed: true, reason: "manual", at: null };
}

export async function readKillState(store: KillSwitchStore): Promise<KillState> {
  try {
    return parseKillState(await store.get(KILL_SWITCH_KEY));
  } catch {
    // 🚨 KV를 못 읽는 것으로 서비스를 죽이지 않는다. 꺼진 것으로 본다.
    //    회수가 필요한 상황이면 사람이 화이트리스트를 비우는 두 번째 수단이 있다
    //    (§3.5 — IMAGE_PROXY_ALLOWED_HOSTS를 비우면 전부 거부).
    return OFF;
  }
}

/**
 * 자동 발동 — **원천이 403/429를 주면 켠다** (§4.8 ⓔ의 「403은 상대가 처음으로
 * 말을 한 것이다」를 프록시로 옮긴 것).
 *
 * 🚨 **한 번 켜지면 자동으로 꺼지지 않는다.** 이 모듈에 끄는 함수가 없는 것이
 * 그 규칙의 구현이다 — 끄는 것은 사람이 대시보드에서 한다. §4.8 ⓔ의
 * 「사람이 읽을 때까지 다시 돌리지 않는다」 그대로다.
 */
export async function tripKillSwitch(
  store: KillSwitchStore,
  reason: Exclude<KillReason, "manual">,
  now: Date,
): Promise<void> {
  try {
    await store.put(KILL_SWITCH_KEY, JSON.stringify({ reason, at: now.toISOString() }));
  } catch {
    // 🚨 기록에 실패해도 그 요청은 이미 거부된다. 여기서 던지면 그 거부가
    //    500이 되어 원인이 흐려진다.
  }
}
