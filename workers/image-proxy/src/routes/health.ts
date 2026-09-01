/**
 * `GET /health` (plan §3.5).
 *
 * 🚨 **원천의 사정을 밖으로 흘리지 않는다.** 킬 스위치가 켜졌는지, 서킷이
 * 열렸는지, 화이트리스트에 무엇이 있는지를 여기서 말하지 않는다 — 그것은
 * 우리 운영 정보이고, 공개 엔드포인트가 답할 것이 아니다. 운영자는 대시보드와
 * `wrangler tail`로 본다.
 */
export function handleHealth(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // 상태 확인이 캐시되면 확인이 아니게 된다.
      "Cache-Control": "no-store",
    },
  });
}
