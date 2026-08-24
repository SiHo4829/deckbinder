import { request } from "@playwright/test";

/**
 * 라우트 워밍업.
 *
 * dev 서버는 라우트를 처음 요청받은 시점에 컴파일하고, 프로덕션 서버도 첫 요청에서
 * 모듈 로드와 Supabase 최초 연결을 수행한다. 그 지연이 첫 테스트의 단언 타임아웃을
 * 그대로 잡아먹어, 실행할 때마다 "그때 처음 열린 라우트"의 테스트가 깨졌다.
 * spec들이 serial이라 하나가 깨지면 뒤가 통째로 미실행되어 통과 건수도 믿을 수 없었다.
 *
 * 상세 라우트는 존재하지 않는 id/슬러그로 두드린다. 404가 나더라도 라우트 자체는
 * 컴파일·로드되므로 목적을 달성한다.
 */
const WARMUP_PATHS = [
  "/",
  "/cards",
  "/news",
  "/admin/login",
  "/cards/00000000-0000-0000-0000-000000000000",
  "/news/__warmup__",
  "/api/cards?limit=1",
  "/api/cards/facets",
  // 인증이 없으면 proxy.ts가 /admin/login으로 리다이렉트한다(§2.7의 로그인 프리페치와
  // 같은 이유). 대상 페이지 자체는 컴파일되지 않지만, 로그인해서 두드리는 다른 spec과
  // 비용을 분담시키지 않기 위해 그래도 목록에 남겨 둔다 — 라우트가 생기면 추가하는
  // §7 유지 규칙을 지킨다.
  "/admin/cards",
  "/admin/cards/00000000-0000-0000-0000-000000000000",
  // 루트 not-found.tsx(T1.12-4) 콜드 컴파일을 미리 밀어낸다.
  "/__warmup-404__",
];

export default async function globalSetup() {
  const port = process.env.PLAYWRIGHT_PORT ?? 3100;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
  const ctx = await request.newContext({ baseURL });

  // webServer가 먼저 뜨지만, 첫 응답까지 여유를 둔다.
  for (let i = 0; i < 30; i += 1) {
    try {
      await ctx.get("/", { timeout: 10_000 });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }

  // 실패해도 무시한다 — 워밍업은 최선 노력이고, 검증은 각 테스트가 한다.
  for (const path of WARMUP_PATHS) {
    await ctx.get(path, { timeout: 60_000 }).catch(() => undefined);
  }

  await ctx.dispose();
}
