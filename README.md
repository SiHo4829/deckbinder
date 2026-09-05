# deploy-hold — 배포 보류용 빈 브랜치

이 브랜치는 **일부러 비어 있다.** 코드가 없고 `wrangler.jsonc`도 없다.

## 왜 있는가

Cloudflare Workers Builds가 `deckbinder` 워커에 연결돼 있고, 저장소 루트에
`wrangler.jsonc`(`name = "deckbinder"` · `main = ".open-next/worker.js"`)가 생긴
뒤로는 **프로덕션 브랜치로 push하면 앱이 자동 배포될 수 있다.**

앱 배포는 아직 사람이 정한 순서를 밟지 않았다 (§9.3 ⓓ 재확인 → 워커 배포 →
salt → 킬 스위치 리허설). 그리고 커밋 메시지의 `[CI Skip]` 프리픽스는
Cloudflare가 **Pages 기준**으로 문서화한 것이라 Workers Builds에 대한 보장이
아니다.

그래서 **Settings → Build → Branch control의 프로덕션 브랜치를 이 브랜치로
지정한다.** 여기엔 빌드할 것이 없어 자동 배포가 아무것도 하지 않고, `main`은
프로덕션 브랜치가 아니게 되어 push해도 배포가 걸리지 않는다.

## 배포하는 날

프로덕션 브랜치를 `main`으로 되돌리고, `[CI Skip]` 커밋 관행도 함께 멈춘다.
**그 둘은 같은 날 풀리는 한 쌍이다.**

🚨 이 브랜치에 코드를 머지하지 않는다. **비어 있는 것이 이 브랜치의 기능이다.**
