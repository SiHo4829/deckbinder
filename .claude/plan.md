# DeckBinder — 아키텍처 설계서 (plan.md)

> 작성: Architect Agent · 상위 기준 문서: `CLAUDE.md` > `AGENT.md` > `README.md`
> 본 문서는 Developer 에이전트가 구현 시 따르는 **디렉토리 구조 / 프레임워크 구성 / 데이터 모델 / API 계약**의 단일 기준(SSOT)이다.
> `CLAUDE.md`와 충돌하는 내용이 발견되면 `CLAUDE.md`가 우선하며, 본 문서를 갱신한다.

---

## 0. 문서 성격

본 문서는 **현재 확정된 설계**만 담는다. 태스크별 진행 이력은 git 로그에 있으므로 여기서 중복하지 않는다.

되돌리려면 근거를 다시 확인해야 하는 결정만 아래에 남긴다.

| 결정 | 근거 |
|------|------|
| 지원 TCG는 **포켓몬 + 원피스** 2종 (유희왕 제외) | §4.0 |
| 카드 데이터는 **자체 구축**. 외부 사이트 연동 없음 | §4.4 |
| `cards.name_ja`는 `not null`, `name_ko`는 nullable | §4.4 |
| 대체 카드는 `base_code`(생성 컬럼)로 판정. `similar_group_id`는 007에서 제거 | §4.6 |
| 단일 앱 구조(`src/` 4구획). 모노레포 아님 | CLAUDE.md 지정 |
| shadcn base는 `radix` (CLI 기본값 `base` 아님) | §2.6 |
| RLS 정책과 **함께 GRANT를 반드시 준다** | §4.1-1 |
| 쓰기 직후 정확성이 필요한 라우트는 **동적(SSR)**. ISR은 전제가 아니다 | §1 P1 · T1.12-7 |
| 시간 조건 RLS(`<= now()`)를 쓰면 앱이 찍는 시각에 **마진을 준다**(`published_at` = `now - 5초`) | §2.7 ★ |
| 관리자 인증은 **T3.1까지 토큰 방식 유지**. 전제 3가지가 붙는다 | §9.2 ⓒ |
| 카탈로그 복구는 **로컬 덤프**로 한다. Supabase 자동 백업에 의존하지 않는다 | §9.2 ⓑ |

---

## 1. 설계 원칙

| # | 원칙 | 근거 |
|---|------|------|
| P1 | **읽기 중심, 쓰기 최소. RSC 기본.** SEO와 애드센스를 확보하는 것은 **서버 렌더**이지 ISR이 아니다 — ISR은 수단 중 하나일 뿐 전제가 아니다. 렌더 모드는 라우트마다 **"관리자 쓰기 직후 정확해야 하는가"** 하나로 가른다: 그렇다면 **동적(SSR)**, 아니라면 ISR. | CLAUDE.md: RSC 기본 / README: 애드센스 / §2.7 · T1.12-7 |
| P2 | **스크래핑은 앱 서버에서 분리** — 외부 사이트 접근은 전부 Cloudflare Workers에서만 수행. Next.js는 대상 사이트에 직접 접근하지 않는다. | CLAUDE.md: Proxy/Scraper |
| P3 | **되팔이 방지는 서버 계약으로 강제** — "1회 1장", "분당 3회", "8~12초 연출"은 프론트 제약이 아니라 API 스키마와 서버 쿼터로 강제한다. | CLAUDE.md: Crawler Restrictions |
| P4 | **도메인 로직은 프레임워크에서 분리** — 시뮬레이터 · 확률 · 가격 정규화는 `src/lib/domain`의 순수 함수로 두어 TDD가 쉬운 형태로 만든다. | AGENT.md: TDD 우선 |
| P5 | **웹 ↔ 워커 계약은 zod 스키마 공유** — 두 런타임이 `src/lib/validation`의 동일 스키마를 import 하여 계약 드리프트를 차단한다. | CLAUDE.md: strict typing |
| P6 | **시세는 기준가 1개만 노출** — 시계열/차트 API를 애초에 만들지 않는다. 히스토리는 내부 집계용으로만 보관. | CLAUDE.md: Price Representation |

> **P1의 "동적이면 SSR"이 SEO를 깎지 않는다.** 봇은 어느 쪽이든 완성된 HTML을 받는다. 동적으로 돌려 잃는 것은 **캐시 히트와 DB 왕복 비용**뿐이고, 트래픽이 0에 가까운 지금 그 값은 0이다. 얻는 것은 **정확성**인데 그게 손입력(T1.14)의 전제다.
>
> **되돌릴 조건 — 트래픽이 생겨 DB 왕복 비용이 실제로 측정되는 시점.** 그때 ISR로 되돌리려면 셋 중 하나가 성립해야 한다: ⓐ `revalidateTag`가 fetch Data Cache에 닿는지 재실측(§2.7 — 현 버전에서는 닿지 않는다) ⓑ 관리자 쓰기를 Server Actions로 옮겨 read-your-own-writes 경로를 쓴다(§5.1 API 계약 재작성) ⓒ Supabase 조회를 `fetch` 직호출로 바꿔 캐시 옵션을 쿼리 단위로 제어한다. **셋 다 확인하지 않은 채 세그먼트 `revalidate`를 다시 붙이지 않는다** — 그것이 이번 사고의 재발 경로다.

---

## 2. 프레임워크 구성

`CLAUDE.md`의 스택을 실제 패키지 단위로 확정한다.

### 2.1 CLAUDE.md 확정 사항 (변경 불가)

| 영역 | 선택 |
|------|------|
| 패키지 매니저 | **npm** (`npm install` / `npm run dev` / `npm run build` / `npm run lint`) |
| 프레임워크 | **Next.js 16.3.2 (App Router)** + React 19.2.8 — `CLAUDE.md`의 "14+" 조건 충족. 파괴적 변경은 §2.4 참조 |
| 언어 | **TypeScript (strict 필수)** |
| 스타일 | **Tailwind CSS + shadcn/ui** |
| 클라이언트 상태 | **Zustand** |
| 서버 상태 | **TanStack Query** |
| DB/인증 | **Supabase (PostgreSQL, RLS 활성화)** |
| 프록시/스크래퍼 | **Cloudflare Workers** |

### 2.2 본 설계서에서 추가 확정하는 사항

| 영역 | 선택 | 사유 |
|------|------|------|
| 검증 스키마 | **zod** | 웹 ↔ 워커 계약 공유, react-hook-form 연동 |
| 폼 | **react-hook-form** | zod resolver 연계 |
| 단위/통합 테스트 | **Vitest + Testing Library + MSW** | AGENT.md의 TDD 파이프라인 필수 요건 |
| E2E | **Playwright** | 매물 검색 연출 완주 등 시간 축 검증 필요 |
| 애니메이션 | **Framer Motion** | 3공 바인더 페이지 넘김, 진행 단계 연출 |
| 워커 라우팅 | **Hono** | Workers 네이티브 경량 라우터 |
| 워커 파싱 | **HTMLRewriter** (1순위) / `node-html-parser` (폴백) | 스트리밍 파싱이 CPU 예산에 유리 |
| 워커 쿼터 | **Durable Object** | 분당 3회 카운터의 강한 일관성 |
| URL 상태 | **nuqs** | 카드 필터의 URL 동기화(공유 · SEO) |

### 2.3 npm scripts

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",                            // Next 16에서 `next lint` 제거됨
    "typecheck": "next typegen && tsc --noEmit",  // typegen 산출물이 .next/(gitignore)라 선행 필요
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:reset": "supabase db reset",              // 로컬 리허설 (Docker 필요)
    "db:migrate": "supabase db push",             // 원격 적용
    "db:types": "supabase gen types typescript …" // 스키마 변경 후 필수
  }
}
```

> 마이그레이션은 **항상 `db:reset`으로 로컬 리허설 후 `db:migrate`** 한다. §4.1-1의 GRANT 누락은 이 리허설에서 잡혔다.

> ⚠️ `CLAUDE.md`의 Commands 목록에 `test` · `typecheck`가 없다. 추가를 권장한다.

### 2.4 Next.js 16 파괴적 변경 (Developer 필독)

설치된 Next 16은 학습 데이터의 App Router 관례와 다르다. **Next 관련 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 가이드를 확인한다.**

| 변경 | 영향 받는 태스크 | 대응 |
|------|------------------|------|
| **`params` / `searchParams` 비동기화** — 동기 접근 완전 제거 | T1.7, T1.8, T2.4, T3.5 등 모든 동적 라우트(`[cardId]`, `[deckId]`, `[slug]`, `[sessionId]`) | `const { cardId } = await props.params` 형태로 await |
| **`cookies()` / `headers()` / `draftMode()` 비동기화** | T1.4 Supabase 서버 클라이언트, T3.1 인증 | `const cookieStore = await cookies()` |
| **타입 헬퍼 생성** — `PageProps<'/cards/[cardId]'>`, `LayoutProps`, `RouteContext` | 전 라우트 | `next typegen`으로 생성. `npm run typecheck`에 포함됨 |
| **`middleware.ts` → `proxy.ts`** — 함수명도 `proxy`, edge 런타임 미지원(nodejs 고정) | T3.1 Supabase 세션 갱신 | 파일명 · export명 모두 `proxy` |
| **`next lint` 제거** | 전체 | `eslint` 직접 실행 (등록 완료) |
| **`images.domains` 폐기** → `remotePatterns` | T1.7 카드 이미지 (§9.3) | `next.config.ts`에 `images.remotePatterns` 사용 |
| **Turbopack 기본 활성** | 전체 | 별도 조치 없음 |

> `next dev` 실행 시 Next가 `CLAUDE.md` 하단에 `<!-- BEGIN:nextjs-agent-rules -->` 블록을 자동 추가한다. 제거해도 재생성되므로 커밋에 포함한다.

> **트러블슈팅 — dev 서버 디렉토리당 1개 제한:** Next 16은 같은 디렉토리에서 dev 서버를 중복 기동하지 못하게 막는다. 좀비 프로세스가 남으면 `npm run test:e2e`가 `webServer was not able to start (exit code 1)`로 실패한다. 기존 서버의 PID는 `.next/dev/logs/next-development.log` 또는 기동 시 출력에 표시되며, `taskkill /PID <pid> /F`로 정리한 뒤 재실행한다.

### 2.5 툴체인 버전 제약 (Node)

**현재 개발 환경 Node v20.15.1** 기준으로 아래 패키지를 하향 고정했다. Next 16 자체는 `>=20.9.0`이라 문제없지만, 최신 테스트 툴체인은 Node **20.19.0+** 를 요구한다(20.19에서 백포트된 `require(esm)`과 rolldown 네이티브 바인딩).

| 패키지 | 고정 버전 | 하향 사유 |
|--------|-----------|-----------|
| `vitest` | `^3.2.7` | v4는 rolldown 사용 → Node 20.19+ 필요, 네이티브 바인딩 설치 불가 |
| `@vitejs/plugin-react` | `^4` | v6는 vite@8(rolldown)을 끌어옴 |
| `vite-tsconfig-paths` | `^5` | 동일 |
| `jsdom` | `^26` | v30은 `require(esm)` 사용 → Node 20.19+ 필요 |

> **권장 조치:** Node를 **22 LTS**로 올리면 위 4개를 최신(vitest 4 / plugin-react 6 / jsdom 30)으로 되돌릴 수 있다. 팀 전체가 동일 버전을 쓰도록 `.nvmrc` 추가를 권장한다. shadcn CLI(`>=20.18.1`)도 같은 이유로 경고를 낸다.

### 2.6 shadcn/ui 설정 (T1.2 확정)

shadcn CLI 4.19에서 `-b/--base` 플래그의 의미가 **base color → primitive 라이브러리**(`base` / `radix` / `aria`)로 바뀌었다. 프리셋도 필수 선택 항목이다.

| 항목 | 값 | 사유 |
|------|-----|------|
| base (primitive) | **`radix`** | §2.1의 "shadcn/ui (Radix 기반)" 유지. CLI 기본값은 `base`(Base UI)로 바뀌었으나 Radix가 성숙도 · 레퍼런스 면에서 우위 |
| preset | **`nova`** (Lucide + Geist) | 스캐폴드가 이미 Geist 폰트를 쓰고 있어 일관 |
| baseColor | `neutral` | 카드 이미지가 주인공이므로 채도 낮은 중립 배경 |
| cssVariables | `true` | 토큰 기반 테마 |

**alias는 CLI 기본값에서 2개를 수정했다.** 기본값을 그대로 두면 `CLAUDE.md`의 `src/` 4구획 규칙과 §3.3 구조를 위반한다.

| alias | CLI 기본값 | 수정값 | 사유 |
|-------|-----------|--------|------|
| `hooks` | `@/hooks` | **`@/lib/hooks`** | `src/hooks`는 CLAUDE.md가 허용한 4구획(app/components/lib/types) 밖 |
| `utils` | `@/lib/utils` | **`@/lib/utils/cn`** | §3.3은 `utils/`를 디렉토리로 정의. 파일 `utils.ts`와 디렉토리 `utils/`가 공존하면 import 해석이 모호해짐 |

**프로젝트 토큰은 `globals.css` 최하단의 별도 블록에 둔다.** shadcn이 생성·갱신하는 영역과 분리해야 재초기화 시 유실되지 않는다. 현재 정의된 프로젝트 토큰:

| 토큰 | 용도 |
|------|------|
| `--color-game-ptcg` / `-foreground` | 포켓몬 게임 배지 · 필터 · 티어표 |
| `--color-game-opcg` / `-foreground` | 원피스 게임 배지 · 필터 · 티어표 |

> **기준가 전용 색상 토큰은 의도적으로 만들지 않았다.** 가격에 의미색(상승 녹색 등)을 부여하면 P6의 "시세 변동 표현 배제" 원칙과 충돌한다. 기준가는 `foreground` / `primary`로 표기한다.

### 2.7 실행 환경에서 확인된 제약 (Developer 필독)

문서만 봐서는 알 수 없고, 실제로 부딪혀서 알아낸 것들이다. 모두 **조용히 잘못 동작**하는 유형이라 다시 밟기 쉽다.

| 제약 | 증상 | 대응 |
|------|------|------|
| **PostgREST 행 상한** | `limit=100000`을 보내도 서버 설정(`db-max-rows`, 기본 **1000**)에서 잘린다. 에러 없이 잘리므로 대조·집계가 **틀린 결과를 조용히 낸다** | 1000행을 넘길 수 있는 조회는 `Range` 헤더로 페이지네이션한다 |
| **Supabase 클라이언트 런타임** | 순수 Node 20.15에서 `createServerClient`/`createClient`가 네이티브 WebSocket 부재로 **즉시 실패**한다. Next 런타임(dev·build)은 undici를 번들해서 정상 동작한다 | 앱 코드는 `@/lib/supabase/*` 그대로 사용. **독립 실행 스크립트**는 PostgREST를 직접 호출한다 |
| **일본어 전문검색** | `simple` 사전은 공백으로 토큰을 나눈다. 일본어에는 공백이 없어 카드명 전체가 토큰 1개가 되고 **부분일치가 전혀 안 된다** | 검색은 `search_vector`가 아니라 **`ilike` + `pg_trgm` 인덱스**로 한다. `name_ja`/`name_ko`를 `or`로 묶는다 |
| **`cookies()` → 강제 동적 렌더링** | `createSupabaseServerClient()`는 `await cookies()`를 호출한다. `cookies()`는 Request-time API라 **이를 쓰는 세그먼트는 정적 생성·ISR이 성립하지 않는다.** `revalidate`를 붙여도 무시된다 | 공개 읽기(뉴스 · 카드 상세 · sitemap)는 쿠키를 읽지 않는 `createSupabaseAnonClient()`(`src/lib/supabase/public.ts`)를 쓴다. anon 키라 RLS는 그대로 적용된다 |
| **동적 라우트의 기본은 Dynamic** | `generateStaticParams`가 **없으면** 동적 라우트는 요청마다 렌더된다. 빌드 출력의 `ƒ`가 그 신호다 | 빌드 시 전부 생성하고 싶지 않으면 **빈 배열을 반환**한다. `dynamicParams`(기본 true)로 첫 요청에 생성 후 캐시된다(`●`) |
| **DB 타입 미생성** | 타입 없이 쓰면 Supabase가 임베드 관계를 **배열로 추론**하지만 런타임은 객체다. 컬럼이 아닌 필드를 insert/update에 넘겨도 잡히지 않는다(실제로 PATCH가 `keyword_ids`를 넘기고 있었다) | `npx supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres > src/types/database.ts`. **스키마를 바꾸면 다시 생성한다** |
| **nuqs 배열 직렬화** | 배열 파라미터를 **쉼표로 직렬화**한다(`keywords=a,b`). 반복 키(`keywords=a&keywords=b`)로 보내면 첫 값만 읽어 **필터가 조용히 일부만 적용**된다 | 키워드 코드를 `^[a-z0-9_]+$`로 제한해 쉼표가 값에 들어갈 수 없게 막았다. 서버 파서는 두 형식을 모두 받는다 |
| **`useSearchParams` + 정적 프리렌더** | Suspense 경계가 없으면 `next build`가 실패한다. **dev와 E2E는 통과**해서 빌드까지 돌리지 않으면 놓친다 | nuqs를 쓰는 컴포넌트를 `<Suspense>`로 감싼다 |
| **커서 키 ≠ 유니크 키** | `cards`의 유니크는 `(game_id, code)`인데 커서를 `code` 하나로 잡았다. 게임 필터 없이 훑을 때 두 게임에 같은 코드가 있으면 **카드 한 장이 조용히 사라진다.** 에러도 빈 결과도 아니라 눈치채기 어렵다 | 커서는 **유니크 제약과 같은 폭**이어야 한다. `(code, id)` 튜플로 정렬·비교한다 (007) |
| **`generateMetadata` + 페이지 본문의 중복 조회** | 둘이 같은 인자로 같은 조회를 각각 한 번씩 한다. Next 15+ 의 `fetch` 기본은 캐시 안 함이라 **DB 왕복이 2배**가 되는데 화면은 멀쩡하다 | 조회 함수를 React `cache()`로 감싼다. 캐시 범위가 렌더 1회라 최신성은 그대로다 |
| **eslint flat config는 `.gitignore`를 안 본다** | `supabase start`가 만드는 `supabase/.temp/`를 린트가 스캔해 남의 번들 코드에서 오류 수백 개가 쏟아진다 | `eslint.config.mjs`의 `globalIgnores`에 명시한다 |
| **PostgREST `.or()` 문자열 필터** | `.or("name_ja.ilike.%q%,name_ko.ilike.%q%")`처럼 조건을 **문자열로 이어 붙이는** API다. `q`에 사용자 입력의 **쉼표·괄호**가 그대로 들어가면 필터 문법이 깨진다. 400이 나면 그나마 낫고, 운이 나쁘면 조건이 조용히 다른 뜻으로 파싱된다 | 조립 전에 `q`에서 `[,()]`를 제거하거나 이스케이프한다 (관리자 카드 검색이 첫 사용처) |
| **`server-only` + jsdom 단위 테스트** | `server-only`의 exports 맵이 `react-server → empty.js` / `default → index.js`이고 **`index.js`는 `throw`만 있는 파일**이다. vitest는 `environment: "jsdom"`이라 `react-server` 조건이 걸리지 않아 `src/lib/admin/**`을 import 하는 순간 터진다 | `vitest.config.mts`의 `resolve.alias`로 `server-only`를 빈 모듈에 매핑한다. 이 alias가 없으면 `src/lib/admin/**`은 단위 테스트 자체가 불가능하다 |
| **로그인 화면에서 시작되는 비로그인 프리페치** | `/admin/login`이 admin 라우트 그룹 안에 있어 **레이아웃의 nav가 로그인 화면에도 렌더된다.** 프로덕션 빌드의 Next는 그 `<Link href="/admin">`을 **비로그인 상태로 프리페치**하고, `proxy.ts`가 쿠키 부재로 내보낸 `/admin/login?next=%2Fadmin`이 라우터 캐시에 남는다. 로그인이 성공(POST 200 + 쿠키 발급)해도 직후의 `router.push("/admin")`이 그 캐시를 써서 **다시 로그인 화면으로 튕긴다.** dev는 프리페치를 하지 않아 드러나지 않는다 | 인증 성공 후에는 `router.refresh()`로 캐시를 **먼저 버린 뒤** 이동한다(`admin-login-form.tsx`). 인증 상태에 따라 결과가 갈리는 흐름은 **프로덕션 빌드로 확인한다** — dev와 dev 기준 E2E는 통과한다 |
| **E2E 단언 타임아웃 < 콜드 라우트** | dev 서버는 라우트를 첫 요청에 컴파일하고, 프로덕션 서버도 첫 요청에서 모듈 로드 · Supabase 최초 연결을 한다. **클릭 후 이동을 기다리는 단언은 `page.goto`(내비게이션 30초)가 아니라 expect 타임아웃(기본 5초)을 쓰므로** 그 지연에 그대로 걸린다. 실행할 때마다 "그때 처음 열린 라우트"의 테스트가 깨져 증상이 산발적으로 보인다 | `tests/e2e/global-setup.ts`가 상세 라우트까지 미리 두드려 워밍업하고, `expect.timeout`을 15초로 올렸다 (§7) |
| **ISR 상세 라우트에 `loading.tsx`를 두면 `notFound()`가 소프트 404가 된다** | `loading.tsx`는 Suspense 경계를 만들어 라우트를 **스트리밍**시킨다. 스트리밍은 200으로 시작하므로 그 뒤에 `notFound()`를 던져도 **상태 코드를 바꿀 수 없다**(Next 16 `loading.js` 문서 "Status Codes"). `/cards/[cardId]` · `/news/[slug]`가 여기 해당한다 | **그 두 라우트에 `loading.tsx`를 두지 않는다.** 없으면 `notFound()`가 정상 404를 낸다 — A/B/A로 실측 확인했다(추가 전 404 → 추가 후 200 → 제거 후 다시 404). ⚠️ **`proxy.ts`에서 존재 여부를 미리 조회해 우회하는 방법으로 가지 말 것** — T1.12에서 한 번 그 길로 갔다가 되돌렸다. 상세 조회마다 DB 왕복이 1회 붙어 SSG/ISR의 이득을 상쇄하고, 보안 민감 파일인 `proxy.ts`가 커진다 |
| **세그먼트 `revalidate`가 supabase-js의 fetch까지 Data Cache에 넣는다 — `revalidatePath`로는 그 항목이 지워지지 않는다** | 관리자 API가 무효화를 정상 호출하고 **라우트 캐시도 실제로 비워지는데**(무효화 직후 첫 요청이 `x-nextjs-cache: MISS`, 2회차부터 `HIT`) **화면 내용이 그대로다.** 새로고침·재방문을 아무리 반복해도 세그먼트 `revalidate` 값이 지나기 전에는 바뀌지 않는다 | 페이지의 `export const revalidate = N`은 **그 세그먼트 안에서 일어나는 모든 `fetch`에 적용된다.** supabase-js는 내부적으로 `fetch`를 쓰므로 **PostgREST 응답이 `tags: []`인 N초짜리 Data Cache 항목으로 저장된다.** `revalidatePath`는 **Full Route Cache만** 비우므로 이 항목에 손이 닿지 않고, **재생성이 낡은 Data Cache를 다시 읽어 같은 화면을 만든다.** ⚠️ **증상이 "무효화했는데 안 바뀐다"로 나타나 원인 지목이 어렵다** — 무효화 코드 · RLS · 쿼리 · 테스트 하네스를 차례로 의심하게 되는데 전부 정상이다. **진단은 두 가지로 한다: ⓐ 응답의 `x-nextjs-cache`가 `MISS`인가** — MISS인데 내용이 낡았다면 범인은 라우트 캐시가 아니라 데이터 캐시다 **ⓑ `.next/cache/fetch-cache`의 해당 항목이 `tags: []`인가.** ⚠️ **이 행은 T1.12-7이 쫓던 증상의 *증폭기*이지 원인이 아니다** — 원인은 아래 "RLS의 `now()`" 행이다. 캐시는 그 RLS 창이 만든 **빈 결과를 300초~1시간 얼려 두는** 역할이었고, 그래서 무효화를 어떻게 고쳐도 첫 실패가 없어지지 않았다. **다만 카드 쪽은 순수하게 이 캐시 문제다**(`cards_public_read`에는 시간 조건이 없다) — 수정·삭제 반영이 최대 1시간 지연됐고 동적 전환으로 약 1초가 됐다. **대응은 태그가 아니라 세그먼트를 동적으로 돌리는 것이다** — 태그를 붙여 `revalidateTag`로 비우는 길은 **이 버전에서 막혀 있다**(T1.12-7에서 실측으로 확인하고 철회했다). **영향 범위는 anon 클라이언트를 캐시 세그먼트에서 부르는 곳 전부다** — `/news`(300) · `/news/[slug]`(300) · 홈(600) · `sitemap.xml`(3600) · **`/cards/[cardId]`(3600 — 최대 1시간)**. Route Handler(`/api/cards` · `/api/cards/facets`)는 세그먼트 `revalidate`가 없어 Data Cache가 걸리지 않으므로 해당 없다. **새로 만든 글·카드도 해당 없다** — 그 URL로 조회한 적이 없어 캐시 항목 자체가 없다. **위험한 쪽은 언제나 "한 번 열어 본 뒤 고치거나 지운 것"이다** — 그래서 이 경로의 E2E는 **쓰기 전에 상세를 한 번 방문해야** 회귀를 잡는다 |
| **`revalidateTag`는 이 Next 버전에서 fetch Data Cache에 닿지 않는다 — 문서 안내대로 해도 안 된다** | 태그는 정상 기록된다(`.next/cache/fetch-cache` 항목에 `tags: ["news"]`). 그런데 `revalidateTag(tag, { expire: 0 })`을 불러도 **캐시 파일 mtime이 쓰기 이전 그대로**다 — 재생성이 낡은 항목을 그대로 재사용한다. deprecated 단일 인자 형태도 동일하다. 같은 큐(`store.pendingRevalidatedTags`)를 쓰는 **`revalidatePath`는 확실히 듣는다**(항상 `MISS`를 유발) | ⚠️ **`revalidateTag.md`가 "Route Handler에서 즉시 만료가 필요하면 `{ expire: 0 }`"이라고 명시적으로 안내하는데도 그렇다.** 문서를 읽고 그대로 구현한 뒤 실측하면 안 되는 유형이라, **다음 사람이 같은 문서를 읽고 같은 설계를 다시 한다.** 프로덕션 빌드 + curl로 T1.12-7에서 실측했다. 우회로도 전부 대가가 있다: `cache: "no-store"` 주입은 무효화를 해결하지만 라우트가 **동적(`ƒ`)으로 떨어지고**, `next: { revalidate: 1 }` 주입은 라우트를 정적으로 유지하는 대신 **fetch의 최저 revalidate가 세그먼트 값을 덮어 라우트 수명이 1초가 된다**(빌드 표에 `1s`로 뜬다 — 300/600/3600 계약이 조용히 폐기된다). **결론: 태그 기반 무효화를 이 스택에서 다시 설계하지 않는다.** 정확성이 필요한 라우트는 세그먼트를 **동적으로 선언**하고(T1.12-7), 되돌리려면 §1 P1 주석의 되돌릴 조건 ⓐ를 **실측으로** 다시 확인한다. 참고로 **이 사실이 T1.12-7 증상의 원인은 아니었다**(아래 "RLS의 `now()`" 행) — 그래도 사실이므로 남긴다 |
| **RLS의 `now()`는 DB 시계, 앱이 찍는 `published_at`은 앱 서버 시계다 — 그 차이만큼 "안 보이는 창"이 생긴다** ★ | 방금 발행한 글이 **anon 조회에서 잠깐 막힌다.** 실측: 시계 차이 **약 0.4~0.9초**, 가시화까지 **약 1.2초**. 발행 직후 조회 → 안 보임, 2초 뒤 → 보임. **사람 손으로는 재현되지 않는다** — E2E는 로그인+글 2개 작성+이동이 약 2초 안에 끝나서 정확히 이 창에 빠졌다 | `news_posts`의 공개 정책은 `using (published_at is not null and published_at <= now())`이고 그 `now()`는 **DB가 평가한다**(마이그레이션 006). 반면 `published_at`은 **앱이 `new Date()`로 계산해 보낸다.** 앱 시계가 조금이라도 앞서면 그만큼 자기 글이 자기에게 안 보인다. ⚠️ **증상이 캐시 문제와 구별되지 않는다** — "썼는데 목록에 없다"가 똑같고, 그래서 T1.12-7은 무효화 계층을 두 번 다시 설계하고서야 원인에 닿았다. **진단 2단: ⓐ 캐시가 아예 없는 동적 라우트에서도 재현되면 캐시가 아니다** (이 한 번의 확인이 위 두 행의 미로를 건너뛰게 해 준다) **ⓑ `published_at`과 `created_at`을 나란히 찍어 본다** — `created_at`은 DB가 찍으므로, 앱이 먼저 계산한 `published_at`이 오히려 뒤에 오면 그 차이가 곧 시계 차이다. **처방은 앱이 `now`가 아니라 `now - 5초`를 찍는 것이다**(`src/lib/news/publish.ts`, 마이그레이션 0건). 5초는 관측 차이의 5배 이상이면서 날짜 단위 표시·정렬에 무해하다. 예약 발행(미래 시각)은 기존 값이 보존되므로 이 마진을 타지 않는다. ⭐ **일반 규칙 — 시간 조건 RLS(`<= now()`)를 쓰는 곳은 앱이 찍는 시각에 반드시 마진을 준다.** `published_at`뿐 아니라 앞으로 들어올 예약 공개 · 시즌 · 쿼터 윈도우(T2.x)가 전부 같은 구조다. **그리고 "정확히 앱 시계를 찍는다"를 단언하는 단위 테스트를 쓰지 않는다** — 그런 테스트가 이 버그를 다시 불러들인다. 단언은 "현재보다 과거인가" · "마진이 날짜를 바꾸지 않는가"로 한다 |


### 2.8 비주얼 언어 (T1.10 확정)

목표는 **"돈 내고 쓰는 서비스처럼 보이는 것"**이 아니라 **믿고 볼 수 있어 보이는 것**이다. 시세를 다루는 서비스라 화려함은 오히려 신뢰를 깎는다.

**톤 — 조용한 아카이브/갤러리**

카드 일러스트가 화면에서 유일하게 채도가 높은 요소다. UI는 무채색으로 물러선다. `globals.css`에 토큰 3개를 추가했다.

| 토큰 | 용도 |
|------|------|
| `--surface` | 한 단계 눌린 바탕 (필터 패널 · 예고 섹션) |
| `--surface-raised` | 카드 타일 바탕 — 이미지 로드 전 깜빡임을 막는다 |
| `--hairline` | 구분선. `border`보다 옅게 |

유틸리티 3개도 `@layer components`에 둔다.

- `.aspect-card` — `63 / 88`. **실물 TCG 카드 비율**이다. 이미지 유무와 무관하게 그리드 높이가 흔들리지 않는다
- `.card-placeholder` — 이미지 없는 카드의 격자 패턴. 빈칸 대신 `code`를 얹어 정보로 만든다
- `.eyebrow` — 제목 위 소형 대문자 라벨. 페이지마다 위계의 첫 칸을 고정한다

**규칙**

1. **차트 금지** (CLAUDE.md). 기준가는 배지 하나. 산출 불가일 때도 배지 자리를 비우지 않고 "산출 불가"로 채워 *값이 없는 것*과 *기능이 없는 것*을 구분한다
2. **레어도 배지는 `bg-foreground/85` + `text-background`**. 반투명 배경(`bg-background/85`)은 밝은 일러스트 위에서 읽히지 않는다
3. **미완성 화면에 "준비 중"만 두지 않는다.** `ComingSoon`으로 무엇을 만들고 있는지 3개 항목으로 보이고, 지금 쓸 수 있는 곳(도감)으로 보낸다. 애드센스 심사가 보는 것이 이 화면들이다
4. **호버는 그림자와 1.03 스케일까지.** 카드가 튀어오르면 목록을 훑기 어렵다
5. 대체 카드는 **텍스트 목록이 아니라 썸네일**이다. 어느 일러스트인지가 선택 기준이기 때문이다

---

## 3. 전체 디렉토리 구조

`CLAUDE.md`가 `src/` 하위를 `app` / `components` / `lib` / `types` 4구획으로 고정했으므로 **이 4개 외의 최상위 구획을 `src/` 안에 만들지 않는다.** Zustand 스토어와 순수 도메인 로직은 `src/lib` 하위에 배치한다.

Cloudflare Worker는 Next.js 빌드 대상이 아니므로 `src/` 밖의 `workers/`에 둔다.

```
deckbinder/
├── .claude/
│   ├── agents/
│   │   ├── architect.md
│   │   ├── developer.md
│   │   └── reviewer.md
│   └── plan.md                     # 본 문서
├── .github/workflows/ci.yml
├── docs/
│   ├── adr/                        # 아키텍처 결정 기록
│   └── crawler-compliance.md       # 스크래핑 대상별 준수 사항
├── public/
├── src/
│   ├── app/                        # 라우팅 · API · 데이터 페칭 (얇게 유지)
│   ├── components/
│   │   ├── ui/                     # shadcn 원시 컴포넌트
│   │   ├── features/               # 도메인 UI (cards, decks, simulator, market, collection, news)
│   │   └── common/                 # Header, Footer, AffiliateCarousel, ErrorBoundary
│   ├── lib/
│   │   ├── supabase/               # 클라이언트 · 서버 · 관리자 인스턴스
│   │   ├── domain/                 # 프레임워크 무의존 순수 로직
│   │   ├── validation/             # zod 스키마 (워커와 공유)
│   │   ├── query/                  # TanStack Query 설정 · queryKey 팩토리
│   │   ├── stores/                 # Zustand 스토어
│   │   ├── hooks/                  # 공용 훅
│   │   ├── env.ts                  # 환경변수 런타임 검증
│   │   └── utils/
│   ├── types/                      # TypeScript 인터페이스 정의
│   └── proxy.ts                    # Next 16 미들웨어. /admin 경로 보호 + 카드·뉴스 상세 존재 확인(§2.7, T1.12)
├── supabase/
│   ├── migrations/
│   ├── seed/
│   └── config.toml
├── tests/
│   └── e2e/                        # Playwright 스펙 + global-setup.ts (§7). 단위 테스트는 소스 옆 *.test.ts
├── workers/
│   └── crawler/                    # Cloudflare Workers (별도 package.json)
├── AGENT.md
├── CLAUDE.md
├── README.md
├── next.config.ts
├── components.json                 # shadcn 설정 (base=radix, preset=nova, alias는 §3.3 규칙에 맞춰 수정됨)
├── tsconfig.json
└── package.json
```

### 3.1 src/app — 라우팅

라우트 그룹으로 **콘텐츠(SEO/애드센스) 영역**과 **앱(유틸리티) 영역**의 레이아웃을 분리한다.

```
src/app/
├── layout.tsx                            # 루트: Provider, 폰트, 메타데이터
├── page.tsx                              # 홈: 메타 요약 + 신규 카드 + 뉴스 피드
├── error.tsx                             # 전역 에러 경계
├── (content)/                            # ── 애드센스 대상 콘텐츠 레이아웃
│   ├── layout.tsx
│   ├── news/
│   │   ├── page.tsx                      # 기사 목록
│   │   └── [slug]/page.tsx               # 기사 상세 (ISR)
│   ├── privacy/page.tsx                  # 개인정보처리방침 (애드센스 심사 요건)
│   └── disclaimer/page.tsx               # 면책 조항
├── (app)/                                # ── 유틸리티 레이아웃 (사이드바/필터)
│   ├── layout.tsx
│   ├── cards/
│   │   ├── page.tsx                      # 도감 · 스마트 검색
│   │   └── [cardId]/
│   │       ├── page.tsx                  # 상세 · 기준가 · 대체 카드
│   │       └── market/page.tsx           # 일본 중고 매물 실시간 조회
│   ├── decks/
│   │   ├── page.tsx                      # 레시피 목록 · 메타 티어표
│   │   ├── [deckId]/page.tsx             # 레시피 상세 + 소스 연결
│   │   └── builder/page.tsx              # 덱 빌더 + 첫 손패 시뮬레이터
│   └── binder/
│       ├── page.tsx                      # 내 컬렉션 (인증 필요)
│       └── [slug]/page.tsx               # 공개 바인더 (SNS 공유, OG 이미지)
├── admin/                                # ── 관리자 (색인 제외, proxy.ts가 보호)
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── page.tsx                          # 대시보드
│   ├── sets/page.tsx                     # 세트 등록
│   └── cards/new/page.tsx                # 카드 등록
├── auth/
│   ├── login/page.tsx
│   └── callback/route.ts                 # OAuth 콜백 (T3.1)
├── api/                                  # Route Handlers (§6)
│   ├── cards/
│   │   ├── route.ts
│   │   └── [cardId]/
│   │       ├── route.ts
│   │       └── alternatives/route.ts
│   ├── decks/
│   │   ├── route.ts
│   │   └── [deckId]/route.ts
│   ├── collection/
│   │   ├── route.ts
│   │   └── [itemId]/route.ts
│   ├── binder/
│   │   ├── share/route.ts
│   │   └── [slug]/route.ts
│   ├── news/route.ts
│   ├── admin/                            # 전 라우트 requireAdmin() 통과 후 service_role 사용
│   │   ├── session/route.ts
│   │   ├── sets/route.ts
│   │   └── cards/route.ts · cards/[cardId]/route.ts
│   └── market/
│       ├── session/route.ts              # POST — 쿼터 검사 + 서명 토큰 발급
│       └── stream/[sessionId]/route.ts   # GET(SSE) — 진행 단계 + 결과
├── opengraph-image.tsx
├── sitemap.ts
└── robots.ts
```

### 3.2 src/components — UI

```
src/components/
├── ui/                                   # shadcn 원시 (수정 최소, 소스 복사 방식)
│   ├── button.tsx  dialog.tsx  sheet.tsx  select.tsx  skeleton.tsx ...
├── features/                             # 도메인별 UI 묶음
│   ├── cards/
│   │   ├── card-browser.tsx              # 필터+그리드 조립, URL 동기화 · 무한스크롤
│   │   ├── card-grid.tsx
│   │   ├── card-filter-panel.tsx         # 검색어 · 게임 · 패싯 셀렉트 · 키워드 칩
│   │   ├── keyword-filter.tsx            # 효과 키워드 AND 조합 칩
│   │   ├── card-detail.tsx
│   │   ├── base-price-badge.tsx          # 기준가 1개만 표기 (차트 금지)
│   │   ├── similar-cards.tsx             # 대체 카드 — 썸네일 그리드 (일러스트가 선택 기준)
│   │   └── use-card-search.ts
│   ├── decks/
│   │   ├── deck-list.tsx  tier-table.tsx  deck-detail.tsx
│   │   ├── deck-builder.tsx
│   │   └── deck-source-link.tsx          # 필요 카드 → 매물 검색 진입
│   ├── simulator/
│   │   ├── opening-hand.tsx              # 첫 손패 표시 (ptcg 7장 / opcg 5장)
│   │   ├── mulligan-button.tsx
│   │   └── probability-panel.tsx
│   ├── market/
│   │   ├── market-search-button.tsx      # 1장 단위 조회 트리거
│   │   ├── progressive-loader.tsx        # 8~12초 진행 단계 연출
│   │   ├── condition-filter.tsx          # All / A급·미개봉 / PSA·BGS
│   │   └── listing-list.tsx
│   ├── collection/
│   │   ├── binder-view.tsx               # 가상 3공 바인더
│   │   ├── binder-page.tsx
│   │   ├── wishlist-panel.tsx
│   │   ├── collection-value.tsx          # 총 가치
│   │   └── share-binder-dialog.tsx
│   ├── news/
│   │   ├── news-list.tsx
│   │   ├── news-article.tsx
│   │   └── markdown.tsx                  # react-markdown 매핑 (raw HTML 미허용)
│   └── admin/                            # 관리자도 도메인 묶음이다 — ui/features/common 3분할(CLAUDE.md) 준수
│       ├── field.tsx                     # Field · TextInput · TextArea · NativeSelect · StatusMessage
│       ├── use-admin-form.ts             # 등록·수정 폼 공통 제출·에러 처리 (method · resetOnSuccess · extra)
│       ├── admin-login-form.tsx
│       ├── admin-delete-button.tsx       # 확인 → 삭제 2단계. endpoint · redirectTo · label (T1.12)
│       ├── set-form.tsx
│       ├── card-form.tsx                 # 등록·수정 겸용 (cardId? · initial? · initialKeywordIds?)
│       ├── keyword-form.tsx
│       └── news-form.tsx                 # 작성·수정 겸용 (method + resetOnSuccess)
└── common/
    ├── header.tsx                        # 서버 컴포넌트. 내비 · 테마 토글 조립
    ├── main-nav.tsx                      # 데스크톱 내비 (client — usePathname)
    ├── mobile-nav.tsx                    # 모바일 시트 내비 (client)
    ├── footer.tsx                        # 4단 — 서비스/정보 내비 · 면책 · 정책 링크
    ├── theme-provider.tsx                # next-themes 래퍼 (client)
    ├── theme-toggle.tsx                  # 라이트 / 다크 전환 (client)
    ├── affiliate-carousel.tsx            # 하단 제휴 마케팅 캐러셀 (T3.6)
    ├── error-boundary.tsx                # 기능 단위 클라이언트 에러 경계
    ├── ad-slot.tsx                       # ADSENSE_CLIENT 없으면 null
    ├── coming-soon.tsx                   # 미완성 화면을 "예고"로 보이게 (§2.8)
    └── empty-state.tsx                   # icon · action 지원
```

### 3.3 src/lib — 로직

```
src/lib/
├── admin/
│   ├── session.ts                        # ADMIN_TOKEN 검증 · 쿠키 값 (server-only)
│   ├── guard.ts                          # requireAdmin() — 인증의 실제 판단 지점
│   ├── responses.ts                      # zod/Postgres 오류 → 응답 매핑
│   └── queries.ts                        # 관리자 화면 조회 — 목록 · 단건 · 집계 (service_role)
├── supabase/
│   ├── client.ts                         # 브라우저용 (anon key)
│   ├── server.ts                         # RSC/Route Handler용 (쿠키 세션)
│   └── admin.ts                          # service_role — 'server-only' import 필수
├── domain/                               # ★ React·Next·Supabase import 금지 (순수 함수)
│   ├── simulator/
│   │   ├── shuffle.ts                    # 시드 기반 Fisher-Yates (테스트 재현성)
│   │   ├── draw.ts                       # 게임별 첫 손패 드로우 · 멀리건
│   │   └── probability.ts                # 초기 손패 하이퍼기하 확률
│   ├── deck/
│   │   ├── validate.ts                   # 매수 제한 · 덱 크기 검증
│   │   └── stats.ts                      # 타입 · 역할 분포 집계
│   ├── pricing/
│   │   ├── base-price.ts                 # 단일 기준가 산출 (§5.3)
│   │   └── outlier.ts                    # 이상치 제거
│   └── collection/
│       └── value.ts                      # 컬렉션 총 가치 계산
├── validation/                           # ★ 워커와 공유 — next/* import 금지
│   ├── card.ts  deck.ts  listing.ts
│   ├── market-session.ts                 # cardId 단일 문자열 강제 (배열 불가)
│   └── collection.ts
├── query/
│   ├── provider.tsx
│   └── keys.ts                           # queryKey 팩토리 중앙화
├── stores/
│   ├── deck-builder-store.ts
│   ├── market-search-store.ts
│   └── binder-ui-store.ts
├── hooks/
│   └── use-media-query.ts ...
├── navigation.ts                         # 주 내비게이션 정의 (헤더 데스크톱 · 모바일 공유)
├── env.ts                                # parseEnv 헬퍼 + 클라이언트 환경변수 (NEXT_PUBLIC_*)
├── env.server.ts                         # ★ 서버 시크릿 전용. 'server-only'로 브라우저 import 차단
└── utils/
    ├── cn.ts                             # 클래스 병합
    ├── form.ts                           # 폼 컨트롤 공용 클래스
    └── (예정) format.ts  currency.ts  hash.ts
```

**모듈 규칙 (Reviewer 검증 항목)**

1. `src/app/**`은 얇게 유지 — 라우팅 · 데이터 페칭 · 조립만 담당하고 UI 구현은 `src/components/features/**`에 둔다.
2. `src/lib/domain/**`과 `src/lib/validation/**`은 React · Next · Supabase를 import 하지 않는다. 워커에서도 import 되기 때문이다.
3. `src/components/features/*` 간 직접 import 금지. 교차가 필요하면 `src/lib/domain` 또는 상위 라우트에서 조립한다.
4. `src/lib/supabase/admin.ts`는 `import 'server-only'`를 선언하며, 이 파일 외에서 `service_role` 키를 참조하지 않는다.
5. `NEXT_PUBLIC_` 접두사는 공개해도 무방한 값에만 붙인다.
6. **관리자 조회는 `src/lib/admin/queries.ts`에만 둔다.** 공개 화면용 `src/lib/cards/queries.ts`는 anon 클라이언트를 쓰고 키워드를 표시용(`{ code, label }`)으로 되돌리므로, `keyword_id`가 필요한 관리자 폼에는 **재사용할 수 없다.** 형태가 비슷해 보여도 두 계층을 합치지 않는다.

### 3.4 workers/crawler — Cloudflare Workers

```
workers/crawler/
├── src/
│   ├── index.ts                    # Hono 앱 엔트리
│   ├── routes/
│   │   ├── scrape.ts               # POST /scrape — 단일 카드 매물 조회
│   │   └── health.ts
│   ├── adapters/                   # 사이트별 어댑터 (동일 인터페이스)
│   │   ├── types.ts
│   │   ├── mercari.ts
│   │   ├── rakuma.ts
│   │   └── yahoo-auction.ts
│   ├── lib/
│   │   ├── token.ts                # HMAC 세션 토큰 검증 (단일 사용)
│   │   ├── rate-limit.ts           # Durable Object 클라이언트
│   │   ├── normalize.ts            # 매물 → Listing 정규화, 상태 · 등급 파싱
│   │   ├── fetcher.ts              # 타임아웃 · 재시도 · UA 관리
│   │   └── cache.ts                # KV 단기 캐시 (TTL 10분)
│   └── durable/quota-counter.ts    # 분당 3회 카운터
├── test/
│   ├── adapters/*.test.ts          # 고정 HTML 픽스처 기반 파서 테스트
│   └── fixtures/
├── tsconfig.json                   # 루트 tsconfig 확장, `@/lib/validation/*` 경로 별칭 공유
├── wrangler.toml
└── package.json
```

**어댑터 인터페이스** — 신규 사이트 추가 시 이 계약만 구현하면 되도록 고정한다.

```ts
export interface MarketAdapter {
  readonly source: 'mercari' | 'rakuma' | 'yahoo_auction';
  search(query: MarketQuery, ctx: FetchContext): Promise<RawListing[]>;
  normalize(raw: RawListing): Listing;
}
```

---

## 4. 도메인 설계

### 4.0 지원 TCG 범위 (확정)

**초기 지원: 포켓몬 카드 게임(`ptcg`) · 원피스 카드 게임(`opcg`) 2종.** 유희왕은 범위에서 제외한다.

두 게임은 덱 구조와 첫 손패 규칙이 서로 다르므로, **덱 검증과 시뮬레이터는 게임별 룰 테이블을 주입받는 형태로 구현한다.** 규칙을 코드에 하드코딩하지 않는다.

| 항목 | 포켓몬 (`ptcg`) | 원피스 (`opcg`) |
|------|-----------------|-----------------|
| 메인 덱 매수 | 정확히 **60장** | 정확히 **50장** |
| 동일 카드 매수 제한 | **4장** (기본 에너지는 무제한) | **4장** (카드 넘버 기준) |
| 별도 존 | 없음 | **리더 1장**, **DON!! 덱 10장** |
| 첫 손패 | **7장** | **5장** |
| 멀리건 조건 | 기본 포켓몬 0장이면 공개 후 재드로우 (상대가 1장 추가 드로우) | 1회 한정, 5장 되돌리고 재드로우 |
| 추가 제약 | — | 덱 카드 색상이 리더 색상에 포함되어야 함 |

> ⚠️ **README의 "첫 손패 5장 드로우" 표기는 원피스 기준이다.** 포켓몬은 7장이므로 시뮬레이터 UI 문구와 `draw.ts`는 게임별로 분기해야 한다. README 수정 권장.

`deck_cards.zone` enum은 위 구조에 맞춰 `main | leader | don`으로 정의한다. (초안의 `extra` / `side`는 유희왕 구조여서 폐기)

기본 에너지 무제한 예외는 `cards.sub_type = 'basic_energy'`로 식별하여 `validate.ts`에서 매수 제한을 면제한다.

### 4.1 데이터 모델 (Supabase / PostgreSQL)

```
── 마스터 데이터 ─────────────────────────────
games              (id, code'ptcg|opcg', name_ko, name_ja,
                    deck_size, hand_size, copy_limit)   -- 게임별 룰 (§4.0)
card_sets          (id, game_id→games, code, name_ko, name_ja, released_at)
cards              (id, game_id, set_id→card_sets, code,
                    name_ja NOT NULL,      -- 크롤러 검색 키 (§4.4, 002에서 교정)
                    name_ko NULL,          -- 커버리지 부분적. 표기는 coalesce(name_ko, name_ja)
                    name_en NULL,
                    rarity, attribute, card_type, sub_type, image_url,
                    effect_text,
                    base_code GENERATED)   -- split_part(code, '_', 1). 대체 카드 판정 (§4.6)
keywords           (id, game_id, code'draw|energy_accel|search|...', label_ko, label_ja)
card_keywords      (card_id→cards, keyword_id→keywords)     -- 태그 검색용 M:N, PK(card_id, keyword_id)

── 시세 ─────────────────────────────────────
card_prices        (id, card_id→cards, base_price_jpy, base_price_krw,
                    sample_size, method'trimmed_median', collected_at)
                    -- 노출은 카드당 최신 1행뿐. 히스토리는 내부 집계 전용, 차트 API 없음.

── 덱 ───────────────────────────────────────
decks              (id, game_id, owner_id→profiles NULL, name, description,
                    source_type'tournament|meta|user', tier'S|A|B|C' NULL,
                    tournament_name, placed_at, is_public, created_at)
deck_cards         (deck_id→decks, card_id→cards, zone'main|leader|don', count)
                    -- leader/don은 원피스 전용. 포켓몬은 main만 사용한다.

── 사용자 ───────────────────────────────────
profiles           (id→auth.users, nickname, avatar_url, created_at)
collection_items   (id, user_id→profiles, card_id→cards, quantity,
                    condition'all|a_grade_unopened|psa_bgs_graded',   -- ★ 필터 3종과 동일 enum
                    grade_label'PSA10|BGS9.5|...' NULL,
                    is_wishlist, acquired_price_krw)
binder_shares      (id, user_id→profiles, slug UNIQUE, title, is_active, view_count)

── 콘텐츠 ───────────────────────────────────
news_posts         (id, slug UNIQUE check '^[a-z0-9][a-z0-9-]*$',
                    title, summary, content_md, thumbnail_url,
                    author_name,          -- profiles FK는 T3.1에서 승격
                    published_at,         -- null=초안, 과거=공개, 미래=예약
                    created_at, updated_at)
                    -- 초안 차단은 RLS가 한다. 앱 쿼리에서 조건을 빠뜨려도 새지 않는다.
                    -- ★ published_at은 앱이 찍고 RLS는 DB의 now()로 검사한다.
                    --   두 시계가 어긋나 "방금 발행한 글이 안 보이는 창"이 생기므로
                    --   앱은 now가 아니라 now-5초를 찍는다 (§2.7 · publish.ts).

── 운영/방어 ────────────────────────────────
market_sessions    (id, user_id NULL, ip_hash, card_id→cards,
                    status'pending|done|failed',
                    requested_at, completed_at, result_count)
                    -- 쿼터 감사 로그 겸 SSE 세션 레코드
```

> **`similar_groups` / `search_vector` 제거 (007)** — 둘 다 001에서 만들었지만 이후 설계가 바뀌어 앱이 한 번도 조회하지 않았다. `similar_groups`는 §4.6이 `base_code`로 대체했고, `search_vector`는 §2.7의 일본어 tsvector 문제로 `ilike`+`pg_trgm`에 자리를 내줬다. 특히 `search_vector`는 **insert/update마다 트리거가 돌고 GIN 인덱스가 갱신되는데 읽는 곳이 없었다.** `CLAUDE.md`의 `similar_group_id` 지정 문구도 함께 갱신했다.

**인덱스 / 검색**

- 부분일치 보강: `pg_trgm` GIN 인덱스를 `cards.name_ko`와 **`cards.name_ja`** 양쪽에 둔다. 실데이터 대부분이 일본어명에 쌓이므로 일본어 인덱스가 실질적으로 더 중요하다 (002).
- `card_keywords(keyword_id, card_id)` — 키워드 교차 필터용 역방향 인덱스.
- `market_sessions(ip_hash, requested_at DESC)`, `market_sessions(user_id, requested_at DESC)` — 쿼터 조회용.

**§4.1-1 ★ RLS 정책만으로는 접근 제어가 성립하지 않는다 (T1.5 실측)**

PostgreSQL은 **테이블 레벨 권한(GRANT)을 먼저 검사하고, 통과한 뒤에야 RLS 정책으로 행을 거른다.** 이 프로젝트의 기본 권한 상태에서 신규 테이블은 다음과 같았다.

| 역할 | 마이그레이션 직후 기본 권한 | 결과 |
|------|------------------------------|------|
| `anon` / `authenticated` | `REFERENCES, TRIGGER, TRUNCATE` | SELECT 없음 → 정책이 허용해도 `42501 permission denied` |
| `service_role` | `REFERENCES, TRIGGER, TRUNCATE` | INSERT 없음 → 시드 · 배치 수집 불가 |

즉 정책만 작성하면 **도감 읽기가 전부 막히고 시드도 실패한다.** 게다가 세 역할 모두 붙어 있던 `TRUNCATE`는 **RLS를 우회**하므로 회수해야 한다.

**따라서 모든 마이그레이션은 RLS 정책과 함께 다음 3종을 반드시 포함한다.**

```sql
revoke all on <테이블…> from anon, authenticated, service_role;
grant select on <테이블…> to anon, authenticated;              -- 읽기 대상만
grant select, insert, update, delete on <테이블…> to service_role;  -- TRUNCATE 제외
```

Reviewer는 신규 테이블마다 `revoke all` → 최소 권한 `grant` → RLS 정책 3단이 모두 있는지 확인한다.

**RLS 정책 (전 테이블 필수 — CLAUDE.md: RLS enabled)**

| 테이블 | 정책 |
|--------|------|
| `games`, `card_sets`, `cards`, `keywords`, `card_keywords`, `card_prices`, `news_posts` | 익명 `SELECT` 허용, 쓰기는 `service_role`만 |
| `decks` | `SELECT`: `is_public OR owner_id = auth.uid()` / 쓰기: 소유자만 |
| `deck_cards` | 상위 `decks`의 가시성을 따름 |
| `collection_items` | 전 작업 `user_id = auth.uid()` |
| `binder_shares` | `SELECT`: `is_active` / 쓰기: 소유자만. 공개 바인더는 뷰 `v_public_binder`로만 노출 |
| `profiles` | `SELECT`: 전체(닉네임·아바타) / 쓰기: 본인만 |
| `market_sessions` | 클라이언트 직접 접근 금지 (`service_role` 전용) |

### 4.2 상태 관리 분리 규칙

| 상태 종류 | 도구 | 위치 | 예시 |
|-----------|------|------|------|
| 서버 데이터 | TanStack Query | `src/lib/query` | 카드 검색 결과, 덱 목록, 컬렉션, 매물 결과 |
| 클라이언트 편집 상태 | Zustand | `src/lib/stores` | 덱 빌더 구성 카드, 시뮬레이터 손패, 바인더 페이지 인덱스 |
| URL 상태 | nuqs / `searchParams` | `src/app` | 카드 필터(속성 · 레어도 · 키워드), 정렬, 페이지 |

> 필터 조건은 **반드시 URL에 반영**한다 — 링크 공유 가능성과 도감 페이지 SEO 색인 확보가 목적이다.

### 4.3 단일 기준가 산출

1. 워커가 3개 사이트에서 최근 판매가 / 현재가 샘플 수집
2. 상태 필터 적용(파손 · 부품용 제외) 후 상 · 하위 10% 절사
3. 절사중앙값(trimmed median) → `base_price_jpy`
4. 환율 스냅샷 적용 → `base_price_krw`
5. `sample_size < 3` 이면 **"기준가 산출 불가"** 로 표기 — 추정치를 노출하지 않는다
6. UI 노출은 `base-price-badge.tsx` 단일 컴포넌트로 통일. 변동률 · 스파크라인 · 차트 컴포넌트를 만들지 않는다


### 4.4 카드 데이터 원천 — **자체 구축 (외부 연동 없음)**

**2026-08-23 방침 변경.** 외부 사이트 연동을 전면 중단하고 카드 데이터를 자체 DB로 직접 관리한다.

* 수집했던 데이터(포켓몬 12,619장 · 원피스 4,962장 · 세트 243개)는 **전량 삭제**했다. `games`의 룰 2행만 남는다.
* 수집 스크립트와 파서(`scripts/seed*.ts`, `src/lib/domain/ingest/*`)는 **제거**했다. 남겨두면 누군가 실행해 자체 데이터를 덮어쓸 위험이 있다.
* 등록 경로는 **관리자 화면**(§4.5)이다.

`docs/crawler-compliance.md`의 포켓몬·원피스 항목은 이력으로만 남긴다. 일본 중고 매물 크롤러(T2.7)는 별개이며 그대로 유효하다.

**유지되는 제약**

| 컬럼 | 제약 | 사유 |
|------|------|------|
| `cards.name_ja` | `not null` | 크롤러가 메르카리·라쿠마·야후옥션을 검색하는 유일한 키(§5.3). 자체 입력에서도 필수다 |
| `cards.name_ko` | nullable | 한국 미발매 카드가 존재한다. 표기는 `coalesce(name_ko, name_ja)` |
| `cards.sub_type` | `basic_energy`면 매수 제한 면제 | §4.0 |


### 4.6 대체 카드 판정 — 기본 코드(base_code)

**같은 카드의 다른 인쇄본**을 대체 카드로 본다. 게임상 동일하므로 플레이어는 그중 가장 싼 것을 사면 된다.

```
OP17-001      루피 (일반)
OP17-001_p1   루피 (패러렐)
OP17-001_p2   루피 (SEC)
```

`cards.base_code`는 코드에서 밑줄 뒤 접미사를 뗀 **생성 컬럼**이다(`split_part(code, '_', 1)`).

* 앱 로직에 판정이 흩어지지 않는다. 코드를 고치면 자동으로 따라간다.
* `(game_id, base_code)` 인덱스를 타므로 대체 카드 조회가 인덱스 스캔이다.
* 관리자가 따로 묶는 작업이 없다.

> ⚠️ **코드 규칙:** 밑줄(`_`)은 **다른 인쇄본을 구분하는 용도로만** 쓴다. 일반 카드 코드에 밑줄을 넣으면 의도치 않게 묶인다.

> **`similar_group_id`는 007에서 제거했다.** 행이 하나도 없었고 등록 화면도 없었다. 효과가 비슷한 **다른 이름의 카드**를 묶을 필요가 생기면 효과 키워드 태그(`card_keywords`)로 커버하고, 그래도 부족하면 그때 다시 설계한다. `CLAUDE.md`의 지정 문구도 함께 갱신했다.

### 4.5 관리자 화면 (T1.6-A)

| 항목 | 내용 |
|------|------|
| 인증 | `ADMIN_TOKEN` 환경변수 + httpOnly 쿠키(해시 저장, 12시간). **T3.1 계정 권한 전까지 임시.** 토큰 규격 · 보관 · 회전은 §9.2 ⓐ |
| 회전 = 즉시 무효화 | 쿠키에 든 값이 `sha256(ADMIN_TOKEN)`이고 `isValidAdminCookie()`가 매 요청 **현재 토큰의 해시**와 비교한다. 따라서 토큰을 바꾸는 순간 발급된 쿠키가 전부 불일치한다 — **세션 무효화 목록을 만들지 않는다** |
| 경로 보호 | `src/proxy.ts`가 `/admin/*`에서 쿠키 존재를 확인해 로그인으로 보낸다 |
| 값 검증 | 각 API가 `requireAdmin()`으로 쿠키 값을 직접 검증한다. proxy만 믿지 않는다 |
| 쓰기 권한 | `service_role`(RLS 우회)이므로 인증 뒤에서만 호출한다 |
| 화면 | `/admin`(대시보드) · `/admin/sets` · `/admin/keywords` · `/admin/cards`(목록 — 검색 · 페이지네이션) · `/admin/cards/new`(등록) · `/admin/cards/[cardId]`(수정 · 삭제) |
| API | `POST /api/admin/session` · `POST /api/admin/sets` · `POST /api/admin/cards` · `PATCH·DELETE /api/admin/cards/[cardId]` |

> **카드 도달 경로는 목록(`/admin/cards`) 하나로 모은다.** 대시보드 표의 각 행도 같은 상세로 링크한다. 등록만 되고 다시 찾을 수 없는 상태가 T1.12 이전의 실제 문제였다(§8 T1.12).

> ⚠️ **토큰 1개 = 전체 쓰기 권한**이다. 유출되면 카탈로그 전체를 조작할 수 있고, T1.12에서 삭제 화면이 생겨 그 범위가 "등록·수정"에서 **하드 삭제**(§9.10)까지 넓어졌다. **2026-08-25에 토큰 방식을 T3.1까지 유지하기로 결정했고, 그 대신 전제 3가지를 붙였다 — §9.2.** 그중 하나가 **관리자 API의 파괴 표면 동결**이다: 일괄 삭제 · 전량 덮어쓰기 엔드포인트를 늘리지 않는다.


---

## 5. API 명세

### 5.1 Route Handlers (`src/app/api`)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/cards` | 도감 검색. `q, game, set, rarity, attribute, cardType, keywords[], cursor, cursorId, limit`. **키워드는 AND(모두 보유)**. 커서는 `(code, id)` 튜플 (007) | — |
| GET | `/api/cards/facets` | 필터 선택지(레어도 · 속성 · 종류 · 세트 · 키워드). `game`으로 좁힌다 | — |
| GET | `/api/cards/:cardId` | 상세 + 최신 기준가 1건 | — |
| GET | `/api/cards/:cardId/alternatives` | 동일 `base_code` 카드 목록 (현재는 상세 RSC가 직접 조회) | — |
| GET | `/api/decks` | 레시피 목록. `game, tier, sourceType, cursor` | — |
| GET | `/api/decks/:deckId` | 레시피 상세(카드 구성 포함) | — |
| POST | `/api/decks` | 사용자 덱 저장 | ✅ |
| PATCH / DELETE | `/api/decks/:deckId` | 소유자만 | ✅ |
| GET | `/api/collection` | 내 컬렉션 + 총 가치 | ✅ |
| POST | `/api/collection` | 카드 추가(소장 / 위시리스트) | ✅ |
| PATCH / DELETE | `/api/collection/:itemId` | 수량 · 상태 변경 | ✅ |
| POST | `/api/binder/share` | 공유 슬러그 발급 / 토글 | ✅ |
| GET | `/api/binder/:slug` | 공개 바인더 조회 | — |
| GET | `/api/news` | 기사 목록 | — |
| **POST** | **`/api/market/session`** | **쿼터 검사 → 세션 생성 → 서명 토큰 발급. body: `{ cardId: string, condition }`** | 선택 |
| **GET** | **`/api/market/stream/:sessionId`** | **SSE. 진행 단계 이벤트 + 최종 결과** | 세션 소유자 |

**관리자 API** (`/api/admin/*`) — 전 라우트가 `requireAdmin()` 통과 후 `service_role`로 쓴다 (§4.5).

| Method | Path | 설명 |
|--------|------|------|
| POST / DELETE | `/api/admin/session` | 토큰 로그인 / 로그아웃 |
| POST | `/api/admin/sets` | 세트 등록 |
| POST | `/api/admin/keywords` | 효과 키워드 등록 |
| POST | `/api/admin/news` | 뉴스 작성 |
| PATCH · DELETE | `/api/admin/news/:postId` | 뉴스 수정(발행 토글 포함) · 삭제 |
| POST | `/api/admin/cards` | 카드 등록 (`keyword_ids` 포함. 연결 실패 시 카드를 되돌린다) |
| PATCH / DELETE | `/api/admin/cards/:cardId` | 카드 수정 · 삭제. **PATCH는 `keyword_ids`를 받아 태그를 전량 교체한다**(T1.12 이전에는 400으로 거부). 삭제는 하드 삭제 — §9.10 |

> **키워드 재태깅은 앱 레벨 보상 트랜잭션이다.** 이전 `keyword_id` 목록을 읽어 두고 → `delete` → `insert` 하며, insert가 실패하면 읽어 둔 목록을 되돌려 넣는다. `POST /api/admin/cards`가 카드를 되돌리는 것과 같은 패턴으로, 되돌릴 대상이 **카드가 아니라 이전 태그 목록**이라는 점만 다르다. DB 트랜잭션(RPC)을 쓰지 않으므로 마이그레이션이 필요 없고, `service_role`의 `card_keywords` DELETE 권한은 마이그레이션 001에 이미 있다.

**금지 엔드포인트** — 아래는 설계상 만들지 않는다.
`GET /api/cards/:id/price-history` · `POST /api/market/batch` · `GET /api/cards/export` · 공개 API 키 발급

> 시뮬레이터에는 API를 두지 않는다 — `src/lib/domain/simulator`의 순수 함수로 클라이언트에서 실행한다 (무지연 + 서버 부하 0 + 단위 테스트 용이).

### 5.2 Worker API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/scrape` | `Authorization: Bearer <HMAC 세션 토큰>`, body `{ cardId, cardNameJa, condition }` → `{ listings: Listing[] }` |
| GET | `/health` | 상태 확인 |

`condition`은 **정확히 3값만** 허용한다 (CLAUDE.md 지정): `all` · `a_grade_unopened` · `psa_bgs_graded`

### 5.3 매물 검색 시퀀스

```
Client                Next.js /api/market            Worker              외부 사이트
  │                        │                            │                    │
  ├─ POST /session ───────►│                            │                    │
  │                        ├─ 쿼터 검사(분당 3회)        │                    │
  │                        ├─ market_sessions INSERT     │                    │
  │◄── { sessionId, token }┤                            │                    │
  │                        │                            │                    │
  ├─ GET /stream/:id (SSE)►│                            │                    │
  │◄─ stage: queued        ├─ POST /scrape ────────────►│                    │
  │◄─ stage: mercari       │                            ├─ fetch ───────────►│
  │◄─ stage: rakuma        │                            ├─ fetch ───────────►│
  │◄─ stage: yahoo         │                            ├─ fetch ───────────►│
  │◄─ stage: comparing     │◄── listings ───────────────┤                    │
  │◄─ stage: sorting       ├─ 기준가 대조 · 정렬          │                    │
  │◄─ result: Listing[]    ├─ market_sessions UPDATE     │                    │
```

**진행 단계 연출 규칙 (CLAUDE.md: 8–12s Progressive Loading)**

- 단계: `queued → mercari → rakuma → yahoo_auction → comparing → sorting → done`
- 총 소요 8~12초를 **서버 스트림이 통제**한다. 실제 응답이 3초에 끝나도 남은 단계 이벤트를 페이싱하여 전송한다.
- 클라이언트 타이머만으로 연출하면 DevTools에서 우회 가능하므로 방어 수단으로 취급하지 않는다. `progressive-loader.tsx`는 서버가 보내는 stage 이벤트를 **표시만** 한다.

### 5.4 되팔이 방지 다층 방어

| 계층 | 조치 | 구현 위치 |
|------|------|-----------|
| 스키마 | `cardId`는 배열 불가 · 단일 문자열만 허용 | `src/lib/validation/market-session.ts` |
| 쿼터 | 로그인 시 user_id, 비로그인 시 IP 해시 기준 **분당 3회** | `market_sessions` + Worker Durable Object |
| 토큰 | HMAC 서명 · TTL 60초 · **단일 사용**(사용 후 KV 무효화) | `workers/crawler/src/lib/token.ts` |
| 페이싱 | 서버 통제 8~12초 SSE 스트림 | `/api/market/stream` |
| 노출 | 벌크 조회 · 공개 API 키 · CSV 내보내기 미제공 | 설계상 부재 |
| 감사 | 전 요청 `market_sessions` 기록 → 이상 패턴 탐지 | DB |

> IP는 원문 저장 대신 **솔트 해시**로 보관한다 (`src/lib/utils/hash.ts`, 개인정보 최소 수집 원칙).

---

## 6. 환경 변수

```
# .env.local (gitignore 대상 / 저장소에는 .env.example만 커밋)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 서버 전용. NEXT_PUBLIC_ 접두사 금지
NEXT_PUBLIC_SITE_URL=

ADMIN_TOKEN=                      # 관리자 화면. 코드 하한은 16자, 운영 규격은 43자 난수 — §9.2 ⓐ
NEXT_PUBLIC_ADSENSE_CLIENT=       # 애드센스 승인 후. 없으면 광고를 렌더하지 않는다

SUPABASE_DB_PASSWORD=             # 로컬 CLI 전용(link / db push). 앱 런타임 미사용

# T2.9에서 활성화
# CRAWLER_WORKER_URL=
# CRAWLER_SHARED_SECRET=
# IP_HASH_SALT=
```

* `src/lib/env.ts`가 클라이언트 변수를, `src/lib/env.server.ts`가 서버 시크릿을 부팅 시 검증한다.
* 시크릿은 **추적되는 파일(`.gitignore` 포함)에 절대 적지 않는다.**
* 시크릿 보관처는 **로컬 `.env.local`과 배포 플랫폼의 환경변수 UI 두 곳뿐이다.** 비밀 관리자 도구는 도입하지 않는다 (근거 §9.2 ⓐ).

---

## 7. 테스트 전략 (TDD)

단위 테스트는 소스 옆에 `*.test.ts`로 두고, E2E만 `tests/e2e`에 둔다.

| 레벨 | 도구 | 대상 | 필수 케이스 |
|------|------|------|-------------|
| 단위 | Vitest | `src/lib/validation` | 검색 파라미터 정규화 · limit 상한, 관리자 입력의 선택 항목 null 정규화 · `name_ja` 필수 |
| 단위 | Vitest | `src/lib/domain` | 시드 셔플 재현성, 멀리건 후 덱 상태 불변, 하이퍼기하 확률값, 기준가 이상치 제거, `sample_size<3` 시 산출 불가, 컬렉션 총액 |
| 단위 | Vitest | `src/components/common` | 에러 경계 폴백 · reset |
| 단위 | Vitest | `workers/crawler/src/adapters` | 픽스처 HTML → `Listing` 정규화, 파싱 실패 시 graceful skip |
| 통합 | vitest-pool-workers | 워커 | 토큰 재사용 거부, 만료 토큰 거부, 잘못된 서명 거부 |
| E2E | Playwright | 앱 셸 | 홈 렌더 · 내비 이동 · 타이틀 템플릿 · 다크 모드 토글 |
| E2E | Playwright | 도감 | 검색어 URL 동기화 · URL 복원 · 빈 결과 안내 · 게임 필터 |
| E2E | Playwright | 관리자 | 미인증 접근 차단 · 잘못된 토큰 거부 · API 401 · **세트→카드 등록→도감 반영** · 중복 코드 차단 |

**데이터 의존 금지.** 도감 E2E는 카드가 몇 장 있는지를 전제하지 않는다. 카탈로그는 관리자가 직접 채우므로 양이 고정되지 않는다. 등록 후 반영은 관리자 E2E가 자기 데이터를 만들어 검증한다.

**E2E 기준선은 `CI=1`(프로덕션 빌드) 기준으로 잡는다.**

`playwright.config.ts`는 `CI`가 있으면 `npm run build && npm run start`로, 없으면 `next dev`로 서버를 띄운다. **두 모드는 결과가 다를 수 있다** — 프리페치 · 정적 프리렌더처럼 프로덕션에만 있는 동작은 dev E2E를 전부 통과해도 그대로 남는다(§2.7의 관리자 로그인 프리페치가 실제 사례이며, 배포 환경의 사용자도 겪던 버그였다). 따라서 §8에 "몇 건 ✅"을 적을 때는 **`CI=1` 실행 결과만** 쓴다. `webServer.timeout`이 300초인 것도 이 경로가 빌드를 포함하기 때문이다(120초로는 빌드 도중 끊긴다).

- **`tests/e2e/global-setup.ts`** — 홈 · 도감 · 뉴스 · 관리자 로그인과 **상세 라우트**(존재하지 않는 id/슬러그)를 미리 요청해 첫 컴파일 · 최초 DB 연결 비용을 스펙 밖으로 밀어낸다. 404가 나도 라우트는 로드되므로 목적을 달성한다. **라우트를 추가하면 워밍업 목록에도 넣는다.**
- **serial describe는 통과 건수를 왜곡한다.** 자기 데이터를 만들어 쓰는 spec 4개(`card-detail` · `news` · `cursor` · `filters`)가 `test.describe.configure({ mode: "serial" })`라, **앞의 1건이 깨지면 뒤가 통째로 "did not run"** 이 된다. 실패 1건이 실제로는 여러 건의 미검증을 뜻하므로 통과 건수만 보고 판단하지 않는다.

**Developer 규칙:** 각 태스크는 `실패하는 테스트 커밋` → `구현 커밋` 순서를 지킨다 (AGENT.md).

---

## 8. 구현 로드맵

완료 항목은 한 줄로 남긴다. 무엇을 왜 그렇게 했는지는 해당 절(§)에 있다.

### Phase 1 — 기반 구축

- [x] **T1.1** 저장소 · Next 16 스캐폴딩 · npm scripts · Vitest/Playwright 하네스 (§2.3, §2.5)
- [x] **T1.2** shadcn/ui 초기화 + 디자인 토큰 (§2.6)
- [x] **T1.3** 루트 레이아웃 · 라우트 그룹 · 앱 셸 · 다크 모드
- [x] **T1.4** Supabase 연결 · 환경변수 검증 (§6)
- [x] **T1.5** 마이그레이션 001 — 카드 마스터 스키마 · 인덱스 · RLS · GRANT (§4.1)
- [x] **T1.5b/003** `name_ja`/`name_ko` nullability 교정 (cards · card_sets) (§4.4)
- [x] **T1.6-A** 관리자 등록 화면 — 인증 · 세트/카드 등록 · 대시보드 (§4.5)
- [x] **T1.7** `GET /api/cards` + 도감 (검색 · URL 동기화 · 무한스크롤)
- [x] **T1.7b** 필터 확장 — 마이그레이션 004(`search_cards` · `card_facets` SQL 함수 + EXECUTE 권한). 레어도 · 속성 · 종류 · 발매 팩 셀렉트(건수 표기) + **효과 키워드 AND 조합** 칩. 관리자에 `/admin/keywords` 등록과 카드 폼 태깅 추가
- [x] **T1.8** 카드 상세 `/cards/[cardId]` — 마이그레이션 005(`base_code` 생성 컬럼 + `(game_id, base_code)` 인덱스, §4.6). **DB 타입 생성 도입**(`src/types/database.ts` — §2.7 "DB 타입 미생성"). `card_prices`가 아직 없어(T2.8) 기준가는 항상 "산출 불가"다
- [x] **T1.9** 뉴스 · SEO · 애드센스 요건 — 마이그레이션 006(`news_posts`, **초안 차단은 RLS가 한다**). `react-markdown`+`remark-gfm` · `sitemap.ts`(1000행 페이지네이션) · `robots.ts` · OG · 개인정보처리방침 · 면책 · `AdSlot`(ID 없으면 미렌더). 부수로 `/cards/[cardId]`를 익명 클라이언트로 전환 (§2.7 "`cookies()` → 강제 동적 렌더링")
- [x] **T1.10** 비주얼 정리 (§2.8) — 갤러리 톤 토큰 3개 + 유틸 3개, 홈 전면 재작성, 카드 그리드 재설계(실물 비율 · 레어도 배지 대비), `/decks`·`/binder`를 `ComingSoon`으로
  - **주의**: 푸터에 목록이 생겨 `getByRole("listitem")`이 전역에서 6개를 잡았다. 뉴스 마크다운 E2E는 `getByRole("article")`로 범위를 좁혔다 — 전역 셀렉터가 두 번째 사용처를 만나면 깨진다
- [x] **T1.11** 리팩토링 — 마이그레이션 007(`search_vector` · `similar_groups` 제거, §4.1). **커서 버그 수정**(§2.7 "커서 키 ≠ 유니크 키"). `CardImage` 통합 · 상세 조회 React `cache()` · `requireAdminInput()` · `revalidateNews()` · `db:clean`/`db:sample` 등록 · `CLAUDE.md`의 `similar_group_id` → `base_code`
  - **`CI=1`(프로덕션 빌드) 전수 검증을 여기서 처음 했다**(§7). 그전 수치는 serial describe의 미실행분이 섞여 실측된 적이 없었고, 그 과정에서 관리자 로그인 프리페치(제품 버그)와 콜드 라우트 타임아웃(하네스) 두 건을 잡았다 (§2.7)

- [x] **T1.12** 관리자 운영 최소 완결 + 404 (§4.5, §5.1) — 백로그 **A-1~3 · B-1~2 · D**를 묶었다. **마이그레이션 0건.** `feat/t1-12-admin-ops` → `main` `--no-ff` 머지(`cff265d`)
  - **착수 근거:** 등록한 카드에 **다시 도달할 경로가 0개**였다. 게다가 `name_ja`(§4.4 — 크롤러의 유일한 검색 키)와 `code`(§4.6 — `base_code`의 원천)의 오타를 고칠 화면이 없었다. 병목이 코드가 아니라 카탈로그인 상황에서 입력 도구를 고치는 것이 이후 전 작업의 처리량을 올린다
  - **T1.12-1** `/admin/cards` 목록(검색 · 페이지네이션) — **`search_cards` RPC를 쓰지 않는다**: ⓐ `code`가 검색 대상에서 빠져 있고 ⓑ `security invoker`라 anon RLS 기준이며 ⓒ total을 주지 않는다. admin 클라이언트로 직접 조회하고 입력은 `sanitizeSearchTerm`으로 거른다(§2.7 "PostgREST `.or()` 문자열 필터"). **공용 `AdminTable`을 만들지 않았다** — 사용처 2곳, 추상화가 이르다
  - **T1.12-2** `/admin/cards/[cardId]` 수정 · 삭제 — `CardForm`을 등록·수정 겸용으로 확장, `AdminDeleteButton`을 `news-delete-button`에서 일반화(`endpoint` · `redirectTo` · `label`). **삭제 영역은 `<form>` 밖 형제로 둔다**(danger zone)
  - **T1.12-3** 키워드 재태깅 — `PATCH`의 400 제거. 앱 레벨 보상 트랜잭션(계약은 §5.1). `service_role`의 `card_keywords` DELETE 권한이 001에 이미 있어 **권한 마이그레이션 불필요**
  - **T1.12-4** `not-found.tsx` — **루트 하나면 충분하다**(루트 레이아웃 안에서 렌더되므로 상세의 `notFound()`와 미매칭 URL을 모두 덮는다). **상세 `loading.tsx`는 만들었다가 제거했다** — §2.7 "ISR 상세 라우트에 `loading.tsx`". 백로그 B-2가 이 판단으로 닫혔다
  - **T1.12-5** 관리자 인증 단위 테스트 17건 — `session.ts`는 인터넷과 `service_role` 쓰기 사이의 **유일한 방벽**인데 E2E 401 1건으로만 간접 검증되고 있었고, T1.12-1~3이 그 쓰기 표면을 넓혔다. 선행으로 `vitest.config.mts`의 `server-only` alias가 필요했다 (§2.7)
  - **T1.12-6** 문서 갱신
  - **T1.12-7** 발행 직후 가시성 — **원인 1겹 + 증폭 1겹.** 진단이 세 번 바뀐 끝의 결론만 남긴다. 중간 가설의 잔재는 §2.7의 함정 행 3개에 있다
    - **원인 — RLS 가시화 창 (§2.7 ★).** `published_at`은 **앱 시계**, 공개 RLS의 `now()`는 **DB 시계**다. 발행 직후 약 1.2초 자기 글이 자기에게 안 보인다. **처방: `resolvePublishedAt`이 `now - 5초`를 찍는다**(마이그레이션 0건). 단위 테스트의 `toBe(NOW.toISOString())`도 함께 갈았다 — **"정확히 앱 시계를 찍는다"를 못박아 이 버그를 다시 불러들이는 테스트**였다
    - **증폭 — Data Cache (§2.7).** 세그먼트 `revalidate`가 supabase-js fetch까지 캐시에 넣어 그 **빈 결과를 300초~1시간 얼렸다.** 무효화를 두 번 다시 설계하고도 첫 실패가 사라지지 않은 이유다. `revalidateTag`로 비우는 길은 **이 버전에서 막혀 있다**(§2.7 — 실측 후 철회)
    - **처방 2 — 쓰기 직후 정확성이 필요한 라우트를 동적으로.** `/news` · `/news/[slug]` · `/cards/[cardId]`에 `force-dynamic` + `revalidate` 제거 + `generateStaticParams` 제거. **홈과 sitemap은 ISR로 남긴다**(관리자가 확인하는 경로가 아니고, 홈은 트래픽과 심사원의 첫 화면이라 ISR 가치가 가장 크다). 판정 기준은 **P1에 올렸다**
      - `/cards/[cardId]`의 `generateStaticParams`는 `return []`이라 **포기한 프리렌더가 애초에 없었다** — 빌드 표의 `●`는 "빌드에 프리렌더됨"이 아니라 "첫 요청에 생성 후 캐시됨"이고, 그 캐시가 카드 수정·삭제 지연의 본체였다. `/news/[slug]`만 실제 프리렌더를 포기했고, 대가는 요청당 DB 왕복 1회 · 덤으로 빌드가 DB에 의존하지 않게 됐다
      - **`revalidate` 제거만 하지 않고 `force-dynamic`을 명시한다** — 설정이 텅 빈 라우트는 "왜 비어 있지?"로 읽혀 **누군가 ISR을 다시 붙인다.** 덤으로 `generateStaticParams`와 공존 불가라 프리렌더 재도입을 빌드가 막아 준다
    - **카드 쪽은 순수하게 캐시 문제였다**(`cards_public_read`에 시간 조건 없음). 수정·삭제 반영이 **최대 1시간 → 약 1초**
    - **계약 변경 — `revalidateNews`/`revalidateCards`가 인자를 잃었다.** `slug`·`cardId`를 받던 이유는 그 경로의 라우트 캐시를 비우기 위해서였는데 **그 라우트들이 동적이라 비울 캐시가 없다.** 남은 대상은 홈과 sitemap 둘뿐이다
    - **태그 인프라는 전량 폐기했다**(`cache-tags.ts` 등) — 동적 렌더에서 아무 일도 하지 않는 **"동작하지 않는 안전장치"**가 되기 때문이다. 007의 `search_vector` 제거와 같은 판단
    - **E2E 회귀 기준(계속 유효):** 쓰기 직후 반영을 단언하는 spec은 **쓰기 *전에* 상세를 한 번 방문해야 한다.** 방문하지 않으면 캐시 항목이 애초에 없어 **우연히 통과한다** — 카드 수정·삭제 spec이 실제로 그 상태였다. "발행 취소 → 즉시 404"도 이때 신설했다(기존 "초안은 주소를 알아도 404"는 *처음부터 초안인 글*이라 이 경로를 덮지 못한다)

  - **주의(전역 셀렉터):** `data-testid="form-error"`를 `field.tsx` · `admin-delete-button.tsx` · `admin-login-form.tsx` 세 곳이 공유하는데 **카드 수정 화면은 폼과 삭제 버튼이 공존**한다. 둘이 동시에 에러를 내면 Playwright strict mode가 "resolved to 2 elements"로 실패한다. `AdminDeleteButton`은 항상 `data-testid="admin-delete-zone"`인 `<section>` 안에서만 렌더하므로 E2E는 `page.locator("form")` / `getByTestId("admin-delete-zone")`으로 범위를 좁힌다 — T1.10의 `listitem` 사고와 **같은 유형**이다
  - **최종 검증:** `lint`·`typecheck` ✅ / `test` **94건** ✅ / `test:e2e` **`CI=1`(프로덕션 빌드) 46건** ✅ / 빌드 렌더 모드 — `/` `○ 10m` · `/sitemap.xml` `○ 1h` · `/news` · `/news/[slug]` · `/cards/[cardId]` · `/admin/**` 모두 `ƒ`

> **Phase 1 종료 (2026-08-25).** T1.1~T1.12가 모두 닫히고 **`main`에 머지됐다**(`--no-ff` `cff265d`). 기반(스캐폴딩 · 스키마/RLS/GRANT · 도감 · 상세 · 뉴스/SEO · 비주얼 · 리팩토링 · 관리자 운영)은 서 있고, **남은 병목은 코드가 아니라 그 위에 올릴 데이터다** — §9.8 실측으로 카탈로그는 0행이다. 다음은 §8 맨 뒤 "다음 작업".

### Phase 1.5 — 데이터 착수 (2026-08-25 신설)

코드가 아니라 **그 위에 올릴 데이터**를 다루는 두 태스크다. 순서가 고정이다 — T1.13이 없으면 T1.14의 결과물이 클릭 한 번에 사라진다 (§9.2 ⓑ).

> **선행은 모두 끝났다** — T1.12-7(반영 지연 최대 1시간 → 약 1초)과 `main` 머지. T1.12-7 전에는 카드를 고쳐도 상세가 옛 내용을 보여줘 T1.14의 입력 검증 자체가 성립하지 않았다.

- [ ] **T1.13** 카탈로그 로컬 덤프 — `npm run db:dump` · S~M (Docker 가능 여부에 따라)
  - **§9.2 ⓑ의 실행이다.** 무료 플랜에 자동 백업이 없으므로 이것이 유일한 되돌릴 수단이다
  - `package.json`에 `db:dump` 추가 — `supabase db dump`의 `--data-only`로 원격 데이터를 `backups/`에 파일로 받는다. **정확한 플래그 조합은 `npx supabase db dump --help`로 확인하고 등록한다**(대상 지정이 `--linked`인지 `--db-url`인지, 비밀번호를 `SUPABASE_DB_PASSWORD`에서 읽는지). 어느 쪽이든 **비밀번호를 명령줄에 리터럴로 적지 않는다**
  - **첫 단계는 Docker 의존 확인이다.** CLI는 `pg_dump`를 Supabase Postgres 이미지 컨테이너에서 돌린다. Docker가 없거나 원격 대상에서 실패하면 **폴백**으로 `scripts/dump-catalog.ts`를 만든다 — `scripts/cleanup-sample.ts`와 같은 **PostgREST 직호출** 방식이어야 한다(§2.7: 순수 Node 20.15에서 supabase-js는 못 뜬다) + **`Range` 헤더 페이지네이션 필수**(§2.7의 1000행 상한. 이걸 빠뜨리면 에러 없이 잘린 백업이 만들어져 **백업이 있다고 착각하게 된다** — 가장 나쁜 실패 모드다)
  - `.gitignore`에 `backups/` 추가 — 시크릿은 없지만 카탈로그를 git 히스토리에 박을 이유가 없다
  - `.env.example`의 `ADMIN_TOKEN` 주석을 §9.2 ⓐ의 생성 명령으로 갱신
  - **복원 시 주의 2가지**: ① 순서는 FK를 따른다 — `games → card_sets → cards → keywords → card_keywords → news_posts`(`cards.set_id`가 `on delete restrict`다) ② **`cards.base_code`는 생성 컬럼이라 값을 넣으면 안 된다**(§4.6). `pg_dump`는 알아서 제외하지만 폴백 JSON 경로는 직접 걷어내야 한다
  - **운영 규칙**: 손입력 세션이 끝날 때마다 1회, 그리고 **`npm run db:clean` 실행 직전에 반드시 1회.** §9.9대로 `db:clean`은 이제 실데이터와 같은 DB를 청소하는데 드라이런이 없다
  - **완료 기준:** `npm run db:dump`가 파일을 만들고, **그 파일로 로컬(`db:reset`) DB를 복원해 `card_sets`·`cards`·`keywords`·`card_keywords`·`news_posts` 행 수가 원격과 일치하는 것을 1회 실측한다.** 덤프 파일이 `git status`에 뜨지 않는다

- [ ] **T1.14** 실제 카드 손입력 1배치 — 원피스 ST-01 · ST-02 (34종) · M
  - **선행: T1.13.** 목표는 카탈로그를 채우는 것이 아니라 **측정하는 것**이다 — 아래 "측정 기록"을 채우는 것이 산출물이고, 그 값이 A-4 · A-5 · B-4 · B-5의 순위를 정한다
  - **왜 이 세트인가** — 기준을 먼저 세우고 후보를 걸렀다

    | 기준 | 원피스 **ST-01 + ST-02** (채택) | 원피스 OP-01 일부 | 포켓몬 일본판 확장팩 1종 |
    |------|------|------|------|
    | 30~50종에 **완결 단위**로 맞는가 | ✅ 17 + 17 = **34종. 두 세트가 통째로 다 들어간다** | ❌ 121종 중 일부 — "반쯤 찬 세트"가 남아 어디까지 넣었는지 기억에 의존 | ❌ 60~100종 |
    | `code` 체계의 규칙성 (§4.6) | ✅ `ST01-001`~`ST01-017` 연번. 밑줄 없음 | ✅ `OP01-###` | ⚠️ 공식 표기가 컬렉터 넘버(`001/187`)라 **세트 접두사를 우리가 창작해야 한다.** `base_code`가 `code`에서 파생되므로 나중에 코드 규칙을 바꾸면 대체 카드 판정이 통째로 흔들린다 |
    | 키워드 태깅 난이도 | ✅ 효과 텍스트가 짧고 정형적. 종류가 `LEADER`/`CHARACTER`/`EVENT`/`STAGE` 4종뿐이라 필터 표본으로도 좋다 | ✅ 동일 | ❌ 효과 텍스트가 길고 레어도 축이 10종 이상 |
    | `name_ja` 확보 (§4.4 · 크롤러 유일 키) | ✅ 공식 일본어명 그대로 | ✅ | ✅ |
    | 덤으로 얻는 것 | ✅ **ST-01은 리더 1장 + 메인 50장짜리 완성 덱이다** — §4.0의 opcg 덱 구조(리더/메인/DON)를 Phase 2에서 실데이터로 처음 돌려볼 최소 단위가 그대로 생긴다 | — | — |

    > **알고 감수하는 공백: 이 배치에는 파라렐이 없어 `_p1` 접미사 규칙(§4.6)을 실데이터로 밟지 못한다.** 그 때문에 OP-01에서 파라렐 카드 몇 장만 골라 넣는 유혹이 있는데 **하지 않는다** — "반쯤 찬 세트"를 만들지 않는 것이 더 중요하고, `base_code` 규칙은 다음 배치(OP-01 전량)에서 밟으면 된다. 이번 배치에서는 `base_code == code`가 된다
    > **외부 사이트 연동은 여전히 금지다(§4.4).** 위 세트 정보는 **사람이 보고 옮겨 적기 위한 참고**일 뿐이고, 어떤 사이트도 앱·스크립트가 자동으로 읽지 않는다

  - **필드별 입력 출처** — `/admin/sets`에서 세트 2개, `/admin/keywords`에서 opcg 키워드를 **먼저** 만든 뒤 카드를 넣는다

    | 컬럼 | 필수 | 무엇을 넣는가 | 주의 |
    |------|------|---------------|------|
    | `game_id` | ✅ | 폼의 게임 셀렉트 = 원피스 | 마이그레이션 001이 넣어 둔 2행 중 하나 |
    | `set_id` | 선택(사실상 필수) | 먼저 만든 `ST-01` / `ST-02` | 카드와 **같은 게임**이어야 한다(복합 FK). 비우면 도감의 발매 팩 필터에서 빠진다 |
    | `code` | ✅ | 공식 카드 넘버 그대로 — `ST01-001` … `ST01-017` | **밑줄 금지**(§4.6 — 인쇄본 접미사 전용). `(game_id, code)` 유니크라 중복은 409로 막힌다 |
    | `base_code` | — | **입력하지 않는다.** 생성 컬럼이라 폼에 칸이 없다 | 이번 배치에서는 `code`와 같아진다 |
    | `name_ja` | ✅ | 공식 일본어명 (`モンキー・D・ルフィ`) | **크롤러의 유일한 검색 키(§4.4).** 중점(`・`)·장음 표기를 공식대로. 여기 오타가 나면 T2.7 매물 조회가 통째로 빗나가는데 **화면에서는 멀쩡해 보인다** |
    | `name_ko` | 선택 | 한국 정식 발매명이 있으면, 없으면 비운다 | 표기는 `coalesce(name_ko, name_ja)` |
    | `name_en` | 선택 | **이번 배치는 비운다** | `search_cards`가 아직 `name_en`을 보지 않는다(백로그 C-1). 넣어도 검색되지 않아 입력 시간만 든다 |
    | `rarity` | 선택 | `L` · `C` · `SR` (ST-01 기준) | 도감 레어도 필터의 **선택지 자체가 된다.** 표기를 통일할 것 — `SR`과 `スーパーレア`가 섞이면 필터가 둘로 갈라진다 |
    | `attribute` | 선택 | 원피스는 **색**을 넣는다 — ST-01 적 / ST-02 녹 | 한글/일본어/영문 중 하나로 통일. 위와 같은 이유 |
    | `card_type` | 선택 | `LEADER` · `CHARACTER` · `EVENT` · `STAGE` | 4종뿐이라 필터 표본으로 적합 |
    | `sub_type` | 선택 | **비운다** | 이 컬럼은 `basic_energy` 판정 전용이다(§4.0). 원피스의 特徴(`麦わらの一味` 등)은 **한 카드에 여러 개**라 단일 텍스트 컬럼에 맞지 않는다 — 넣지 말고 아래 측정에 미결로 올린다 |
    | `image_url` | 선택 | 외부 URL 직접 입력 (§9.4 미결) | `z.url()`만 통과하면 저장된다. `CardImage`가 `<img>`라 `remotePatterns` 설정은 불필요. **핫링크라 원본이 사라지면 이미지도 사라진다** — 이번 배치는 그 상태를 그대로 겪어 보는 것이 목적이다 |
    | `effect_text` | 선택 | 공식 텍스트 그대로 | 키워드 태깅의 근거이자 향후 C-2 검색 대상 |
    | `keyword_ids` | 선택 | 폼의 키워드 칩 | 키워드 `code`는 `^[a-z0-9_]+$`(§2.7 nuqs 쉼표 직렬화 방어) |

    `card_sets`는 `code` · `name_ja`(필수) · `name_ko`(선택) · `released_at`(`YYYY-MM-DD`)이다. **세트 코드는 공식 표기 `ST-01`, 카드 코드는 공식 카드 넘버 `ST01-001`** — 접두사가 서로 다르지만 **공식이 그렇게 쓰므로 우리가 통일하지 않는다.** 임의로 맞추면 실물·판매 사이트와 대조가 안 된다

  - ⚠️ **"방금 넣은 카드가 안 보인다"에 속아 같은 카드를 두 번 넣지 말 것.** `/cards` 도감은 ISR이 아니라 클라이언트가 `/api/cards`를 조회하므로 §2.7의 재생성 지연은 **없다.** 대신 **TanStack Query의 전역 `staleTime`이 5분**(`src/lib/query/provider.tsx`)이라 **같은 탭에서 같은 필터로 다시 열면 최대 5분간 이전 결과가 그대로 나온다.** 원인은 다르지만 화면 증상은 §2.7의 `/news`와 똑같다. **입력 확인은 `/cards`가 아니라 `/admin/cards`에서 한다** — `force-dynamic` RSC라 항상 최신이고 코드로 검색되므로 중복을 `(game_id, code)` 유니크(409)에 부딪히기 전에 눈으로 잡는다. 카드 **수정**을 `/cards/{id}` 상세에서 확인하는 것은 **T1.12-7 이후로는 믿을 수 있다**(약 1초). 이 라우트는 이제 `ƒ`이며, **여기에 다시 `revalidate`를 붙이면 T1.14의 확인 경로가 통째로 무너진다**(§2.7)
  - **완료 기준:** 34종이 `/admin/cards`에서 코드로 검색되고, `/cards`의 원피스 필터·레어도·종류 필터에 잡히고, 상세가 열린다. 아래 **측정 기록이 채워진다.** 마무리로 `npm run db:dump` 1회

  **측정 기록** — 반나절 뒤 이 표들이 A-4 · A-5 · B-4 · B-5의 순위를 정한다. **집계값만 남기고 장별 원자료는 남기지 않는다**(§0: 이력은 여기 두지 않는다).

  | 항목 | 값 |
  |------|-----|
  | 대상 / 종수 | ST-01 · ST-02 / 34종 |
  | 시작 · 종료 · 총 소요 | |
  | 장당 중앙값 | |
  | 첫 5장 평균 → 마지막 5장 평균 | (숙련 효과. 차이가 작으면 손입력은 **줄지 않는 비용**이라는 뜻이고 A-5의 근거가 된다) |
  | 세트 · 키워드 사전 준비에 든 시간 | |

  | 필드 | 값이 어디서 왔나 | 막힌 지점 / 소요 비중 |
  |------|------------------|------------------------|
  | `name_ja` | | |
  | `rarity` · `attribute` · `card_type` | | (표기 통일을 지켰나. 무엇으로 정했나) |
  | `image_url` | | (§9.4 판단 재료) |
  | `effect_text` · 키워드 | | |
  | `sub_type`(特徴 미결) | | |

  | 실데이터에서 무너진 지점 | 화면 / 증상 | 영향 | 대응 후보 |
  |---|---|---|---|
  | | | | |

  | 그래서 다음은 | 판단 | 근거(위 수치 중 무엇) |
  |---|---|---|
  | **A-4** 세트·키워드 수정/삭제 | | |
  | **A-5** CSV 일괄 등록 | | (⚠️ 착수 시 §9.2 ⓒ 전제 3 재검토) |
  | **B-4** 도감 결과 건수 | | |
  | **B-5** 도감 정렬 | | |

**T1.11 리팩토링에서 확인한 백로그**

**A-1~3 · B-1~2 · D는 T1.12에서 닫혔다.** 아래는 **남은 항목과 T1.12에서 뺀 이유**다.

**A. 관리자 운영** (T1.6-A 미포함분)

- [x] **A-1~3** 카드 목록 · 수정/삭제 UI · 키워드 재태깅 → T1.12-1~3
- [ ] **A-4** 세트 수정 · 삭제, 키워드 수정 · 삭제 (지금은 등록만 가능) — 개수가 적고 "다시 못 찾는" 문제가 아니라 T1.12에서 뺐다. `AdminDeleteButton`이 일반화돼 있어 **각각 S**다
- [ ] **A-5** CSV 일괄 등록 · **L** — 수백 장을 폼 하나씩은 비현실적이지만 중복 처리 · 부분 실패 · 드라이런 · 게임/세트 매핑 설계가 먼저다. **잘못 만들면 카탈로그를 덮어쓴다** — §4.4가 시드 스크립트를 삭제한 것과 같은 위험이라 별도 설계 태스크로 분리한다. **선행 2가지: T1.13**(되돌릴 수단) · **T1.14**(입력 표본). 임포터가 upsert로 기존 행을 덮게 되면 관리자 API의 파괴 표면이 넓어지므로 **§9.2 ⓒ 전제 3을 함께 재검토한다**

**B. 사용자 화면 — 없어서 티가 나는 것**

- [x] **B-1** `not-found.tsx` → T1.12-4
- [x] **B-2** `loading.tsx` — **철회하고 닫는다.** 상세 라우트에 두면 `notFound()`가 200이 되어 소프트 404가 된다(§2.7). 남은 이득은 도감 → 상세 클라이언트 내비게이션 구간뿐이었고 색인·애드센스(§9.1)가 우선이다. **상세 로딩 체감을 다시 다루려면 `loading.tsx`가 아닌 방법이어야 한다 — 이 경로는 막혀 있다**
- [ ] **B-3** `global-error.tsx` — 루트 레이아웃 자체가 터진 경우만 잡아 빈도가 낮고 `<html>`/`<body>`를 직접 렌더해야 해 검증이 번거롭다
- [ ] **B-4** 도감 결과 건수 표시 — `search_cards`가 total을 주지 않는다. count를 따로 받을지 커서 방식을 유지할지 판단 필요
- [ ] **B-5** 도감 정렬 옵션 (지금은 코드순 고정) — 정렬 키를 바꾸면 **커서 튜플도 바꿔야 하는데**(§2.7 "커서 키 ≠ 유니크 키") 007에서 방금 고친 곳이다. 하루에 끼워 넣을 일이 아니다

**C. 검색·데이터** — `search_cards` 재작성은 마이그레이션 008 + `db:types` 재생성을 부르는데, 카탈로그가 거의 비어 있어 지금 체감 이득이 0에 가깝다

- [ ] **C-1** `name_en`이 검색에서 빠져 있다 — `search_cards`는 `name_ja`/`name_ko`만 본다
- [ ] **C-2** `effect_text` 검색 — "카드를 뽑는다"로 찾고 싶은 수요가 크고, **키워드 수작업 태깅도 줄여준다**(입력 비용과 직결)

**D. 테스트 공백** — [x] `session.ts` · `responses.ts` 무테스트 → T1.12-5에서 해소

**E. 운영**

- [ ] `db:types`가 **로컬 Docker DB**를 가리킨다. 원격에만 적용하고 타입을 뽑으면 스키마와 조용히 어긋난다 — **마이그레이션을 만드는 태스크는 `db:reset` → `db:migrate` → `db:types` 순서를 지킨다**
- [ ] 나머지는 §9 참조 (사이트 URL · Node 22 · E2E 데이터 누적)

### Phase 2 — 핵심 유틸리티

- [ ] **T2.1** `src/lib/domain/simulator` — 손패 매수를 게임 룰로 주입 (ptcg 7장 / opcg 5장)
- [ ] **T2.2** `src/lib/domain/deck` 검증 · 통계 — ptcg 60장 / opcg 50장, 4장 제한(기본 에너지 예외), opcg 리더 색상 일치
- [ ] **T2.3** 마이그레이션 002 — decks / deck_cards + RLS + GRANT
- [ ] **T2.4** 덱 레시피 목록 · 티어표 · 상세
- [ ] **T2.5** 덱 빌더 UI + 첫 손패 드로우 · 멀리건
- [ ] **T2.6** `workers/crawler` 스캐폴딩 (Hono + wrangler)
- [ ] **T2.7** 어댑터 3종 (메르카리 · 라쿠마 · 야후옥션) — **착수 전 §9.2 약관 검토 필수**
- [ ] **T2.8** 마이그레이션 003 — market_sessions / card_prices
- [ ] **T2.9** `POST /api/market/session` (쿼터 + HMAC) + Durable Object
- [ ] **T2.10** `GET /api/market/stream/:id` SSE + 서버 페이싱 연출
- [ ] **T2.11** 매물 결과 UI (진행 연출 · 상태 필터 3종)
- [ ] **T2.12** 기준가 파이프라인 (§4.3)

### Phase 3 — 개인화 및 고도화

- [ ] **T3.1** Google / Kakao OAuth + `proxy.ts` 세션 갱신 + `profiles`
  - **관리자 권한을 여기서 계정 기반으로 교체한다** (§4.5의 토큰 방식은 임시)
- [ ] **T3.2** 마이그레이션 004 — collection_items / binder_shares + RLS + GRANT + 공개 뷰
- [ ] **T3.3** 가상 3공 바인더 + 위시리스트
- [ ] **T3.4** 컬렉션 총 가치
- [ ] **T3.5** 공유 바인더 + 동적 OG 이미지
- [ ] **T3.6** 제휴 링크 캐러셀
- [ ] **T3.7** E2E 시나리오 확장 + GitHub Actions CI

### 다음 작업 (2026-08-25 종료 시점 기준)

**순서: ① `main` push → ② `ADMIN_TOKEN` 교체 → ③ T1.13 덤프 → ④ T1.14 손입력.** ①②는 각각 5분 · 5분이고, **③은 ④의 착수 조건**이다.

- **① `origin`에 push.** 로컬 `main`이 5커밋 앞서 있다. 백업이 로컬에만 있는 상태를 하루 넘기지 않는다
- **② `ADMIN_TOKEN` 43자 난수로 교체** (§9.2 ⓐ의 명령 그대로). **데이터가 들어가기 전에** 끝내야 하는 항목이다
- **③ T1.13 — 되돌릴 수단.** §9.2 ⓑ. 무료 플랜에 자동 백업이 없어 이것이 유일한 복구 경로다. **복원 리허설 1회까지가 완료 기준**이다
- **④ T1.14 — 손입력 1배치(ST-01 · ST-02 34종).** 목표는 채우는 것이 아니라 **측정**이다

> **2026-08-25에 ③(당시 번호 기준 손입력)을 착수하지 못했다.** 발행 직후 글이 목록에 안 나오는 문제를 추적하는 데 반나절이 들어갔고 T1.12-7로 닫혔다. 얻은 것은 §2.7의 함정 3개와 P1 개정이다.

**왜 도구(A-5 CSV)가 아니라 손입력이 먼저인가.** A-5는 중복 처리 · 부분 실패 · 드라이런 · 게임/세트 매핑을 먼저 설계해야 하는 L짜리다. **카드를 한 장도 넣어 보지 않은 상태**에서 그 설계를 하면 전부 추측이 되고, 잘못 만든 임포터는 카탈로그를 덮어쓴다 — §4.4가 시드 스크립트를 삭제한 것과 같은 위험이다. 반대로 손입력 반나절은 그 설계의 입력값을 만든다. **34장을 넣어 보고도 견딜 만하면 A-5는 아예 필요 없을 수도 있다.**

**A-4 · A-5 · B-4 · B-5의 순위는 T1.14의 측정값이 정한다.** 지금 고르면 추측이다.

| 손입력에서 이런 일이 나오면 | 다음은 이것 |
|---|---|
| 세트명 · 키워드 오타를 고칠 화면이 없어 막힌다 | **A-4** — 각각 S |
| 장당 입력이 견디기 어렵고 열이 반복적이다 | **A-5** 설계 태스크(번호는 그때 딴다). T1.13이 전제이고, upsert를 하게 되면 §9.2 ⓒ 전제 3을 다시 판단한다 |
| 30장 넘게 쌓이자 도감의 총 건수 · 정렬 부재가 걸린다 | **B-4 · B-5**. 단 B-5는 커서 튜플을 다시 건드린다(§2.7) |

**미루는 것 — 근거를 붙여 남긴다.**

- **C-1 · C-2 검색 확장** — 마이그레이션 008 + `db:types` 재생성 사이클(백로그 E)을 부른다. 이득이 **카드 수에 비례**하는데 34장 수준에서는 `ilike` 하나로 다 찾힌다. 수백 장이 되는 시점에 재평가한다
- **Phase 2 착수** — "카드가 없으니 코드나 짜자"는 유혹이 가장 센 자리지만 **Phase 2가 데이터에 더 굶주려 있다.** T2.4·T2.5는 카드가 있어야 화면이 성립하고, T2.7은 §9.3 약관 검토가 선행이며 검색 키인 `name_ja`를 가진 카드가 0장이면 조회 대상 자체가 없다. **예외는 T2.1 · T2.2** — 순수 함수라 DB도 데이터도 필요 없다. 손입력이 견디기 어려울 때의 **피신처**로만 남겨 둔다
- **§9.1 애드센스** — 기사는 콘텐츠 작업이지만 **도메인 교체(§9.1 ②)와 `ads.txt`(③)가 정해지기 전에는 써 두어도 심사에 넣을 수 없다.** 도메인 결정이 먼저이고 30분짜리 판단이다. 기사 소재도 카드 데이터가 있어야 나오므로 순서상 T1.14 뒤다

**운영 메모** — `.claude/agents/*.md`의 `model` 값을 고쳐도 **실행 중인 세션은 시작 시점의 정의를 캐시한다.** 바꾼 값은 새 세션부터 적용된다.

---

## 9. 미해결 — 결정이 필요한 사항

1. **애드센스 심사 제출 전 준비물** — ①실제 기사 5~10편 발행(코드가 아니라 콘텐츠 문제) ②`NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 교체 ③`ads.txt` 배치와 퍼블리셔 ID 입력 ④EEA 트래픽이 있으면 인증 CMP 도입. ~~플레이스홀더 페이지가 "제작 중"으로 보이는 것~~ → T1.10에서 `ComingSoon`으로 해소. **§2.7의 데이터 캐시 문제는 여기에 실질 위험이 아니다.** T1.12-7 뒤 색인 대상인 `/news/[slug]`와 `/cards/[cardId]`는 **동적이라 항상 최신**이다. 지연이 남는 곳은 **`sitemap.xml`(3600) 하나이고 그건 알고 남긴 것**이다 — 크롤 주기가 시간 단위 이상이라 1시간 늦게 실린 URL이 색인 결과를 바꾸지 않고, 내려간 URL이 1시간 더 실려 있어도 크롤러가 404를 받아 스스로 뺀다. **조치 없음.** 재평가는 실제 색인 제출 후 Search Console에서 지연이 관측되면 한다.
2. **관리자 토큰 — 결정 완료 (2026-08-25).** 손입력 데이터가 들어가기 전에 정해야 했던 항목이다. 결론은 **T3.1까지 토큰 방식을 유지하되 전제 3가지를 붙인다**이며, 아래 ⓐⓑⓒ가 그 내용이다.

   **ⓐ `ADMIN_TOKEN` 규격 · 보관 · 회전**

   값은 **256비트 난수를 base64url로 인코딩한 43자**로 둔다. 생성은 명령 하나로 끝난다 — 프로젝트가 이미 Node를 요구하므로 새 도구가 붙지 않는다.

   ```
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   base64url을 고른 이유는 `+ / =`가 나오지 않아 `.env` 인용과 URL 인코딩에서 사고가 없기 때문이다. PowerShell만 쓸 수 있는 환경이면 아래를 쓴다. **`Get-Random`은 암호학적 난수원이 아니므로 토큰 생성에 쓰지 않는다.**

   ```
   $b=[byte[]]::new(32); [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```

   **`session.ts`의 16자 하한은 그대로 둔다.** 그 하한의 역할은 `ADMIN_TOKEN=changeme` 같은 **설정 실수를 부팅 시 잡는 것**이지 강도를 보장하는 것이 아니다(`a`×32도 통과한다). 하한을 32로 올리면 `session.test.ts`의 16자 경계값 케이스를 함께 고쳐야 하는데 **그렇게 얻는 방어력은 0**이다 — 강도는 하한이 아니라 위 생성 명령이 만든다.

   보관은 **로컬 `.env.local`과 배포 플랫폼의 환경변수 UI 두 곳뿐이고, 두 값은 서로 다르게 둔다.** 값을 나누는 비용은 0인데 유출 시 어느 쪽이 샜는지 좁혀지고, 터미널 히스토리 · 스크린샷처럼 새기 쉬운 쪽이 프로덕션이 아니게 된다. **비밀 관리자(1Password 등)는 도입하지 않는다** — 시크릿이 3종(`SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_DB_PASSWORD` · `ADMIN_TOKEN`)이고 보관처가 2곳인데다, `ADMIN_TOKEN`은 **우리가 만드는 값이라 잃어버리면 새로 만들면 된다.** 백업할 가치가 없는 시크릿에 관리 도구를 붙이면 표면만 는다.

   **회전 절차**: 새 값 생성 → 배포 환경변수 교체 → `.env.local` 교체 → dev 서버 재시작. **기존 세션은 자동으로 죽는다**(§4.5의 "회전 = 즉시 무효화"). 회전 시점은 ① **지금 1회**(손입력 착수 전) ② 유출 의심 시 즉시 ③ T3.1에서 폐기. **정기 회전은 두지 않는다** — 단독 개발이고, 회전 자체가 "로컬만 바꾸고 배포를 잊는" 실수의 유입 경로다.

   **ⓑ 되돌릴 수단 — 로컬 덤프(`npm run db:dump`, T1.13). Supabase 자동 백업에 의존하지 않는다.**

   | 안 | 실제로 보장되는 것 | 판단 |
   |----|--------------------|------|
   | Supabase 자동 백업 | **무료 플랜에는 자동 백업이 없다.** 공식 문서가 무료 플랜 프로젝트에 `supabase db dump`로 직접 내보내 오프사이트 백업을 유지하라고 안내한다. 일간 백업은 Pro(7일)부터이고 PITR은 그 위의 유료 애드온이다 | **기각** — 지금 없는 것에 기댈 수 없다 |
   | 로컬 덤프 스크립트 | 원격 데이터를 개발자 머신의 파일로 받는다. 기존 `db:*` 계열과 같은 자리 | **채택** |

   > **플랜은 저장소에서 확인할 수 없어 무료 플랜을 가정한다.** Pro 이상이면 일간 백업 7일이 덧붙지만, 그것도 **프로젝트 전체를 한 시점으로 되돌리는 큰 망치**라 카드 몇 장을 되살리는 용도로는 여전히 로컬 덤프가 낫다. 근거: <https://supabase.com/docs/guides/platform/backups> · <https://supabase.com/docs/reference/cli/supabase-db-dump>

   **관리자 전용 "내보내기 API"는 만들지 않는다.** §5.1의 금지 엔드포인트에 `GET /api/cards/export`가 있고 §5.4가 CSV 내보내기 미제공을 되팔이 방지의 한 층으로 세워 두었다. 내보내기를 API로 만들면 **토큰 1개가 카탈로그 전량 반출 권한까지 갖게 되어 ⓐ가 지키려는 것을 스스로 깎는다.** 덤프는 **로컬 스크립트**여야 한다 — service_role 키를 가진 개발자 머신에서만 돌고 네트워크 표면이 늘지 않는다.

   **ⓒ 토큰 방식 유지 (T3.1까지).** 조기 이전을 기각한 근거는 하나다 — **위험의 소재가 인증 방식이 아니라 복구 불가능성이었다.** 토큰을 계정으로 바꿔도 관리자 본인이 실수로 지운 카드는 그대로 사라진다. 반대로 ⓑ가 있으면 토큰이 새어 카탈로그가 지워져도 되돌아온다. 즉 **같은 돈으로 살 수 있는 안전이 ⓑ 쪽이 훨씬 크다.**

   조기 이전은 규모도 맞지 않는다. T3.1을 앞당기면 OAuth 프로바이더 등록 · `profiles` 마이그레이션 · `proxy.ts` 세션 갱신 · 관리자 클레임 RLS까지 Phase 3 한 덩어리가 통째로 앞으로 온다. 관리자가 1명인 지금 그 값으로 줄어드는 위험은 "토큰 유출" 하나인데, 그 토큰은 이제 43자 난수 + 12시간 httpOnly 쿠키다. 한편 **"임시 인증이라 검증도 얇다"는 지적(§2.7 프리페치 버그)은 이미 상당 부분 해소됐다** — T1.12-5가 `session.ts`·`responses.ts`에 단위 17건을 붙였고 관리자 경로는 `CI=1` E2E 46건에 포함된다.

   **전제 — 하나라도 깨지면 ⓒ를 다시 판단한다.**
   1. **ⓐ 교체 완료** — 43자 난수로 바꾸고 저장소 밖에 둔다
   2. **ⓑ 복원 리허설 1회 성공** — 손입력 착수 **전**. 리허설하지 않은 백업은 백업이 아니다
   3. **관리자 API의 파괴 표면 동결** — 일괄 삭제 · 전량 덮어쓰기 엔드포인트를 늘리지 않는다. **A-5(CSV 일괄 등록)가 upsert로 기존 행을 덮게 되면 이 전제가 깨지므로, A-5 착수 시점에 ⓒ를 재검토한다**
3. **일본 중고 매물 사이트 약관** (T2.7 선행) — 메르카리 · 라쿠마 · 야후옥션의 이용약관 검토 결과를 `docs/crawler-compliance.md`에 기록해야 한다. 차단 시 대체 전략(공식 API · 제휴)이 필요하다.
4. **카드 이미지 저장 방식** — 현재는 관리자가 외부 URL을 직접 입력한다. 핫링크 대신 자체 호스팅(Supabase Storage / R2)으로 갈지, 그 경우 저작권 처리를 어떻게 할지. **판단 재료는 T1.14 손입력 배치가 만든다** — `image_url`을 34번 실제로 채워 보면 ⓐ 안정적인 공개 URL을 구할 수 있는지 ⓑ URL 확보가 장당 입력 시간의 몇 할인지가 수치로 나온다. 참고로 `CardImage`는 `next/image`가 아니라 `<img>`라 지금은 `images.remotePatterns` 설정이 필요 없다 — 자체 호스팅으로 옮길 때 이 선택도 함께 바뀐다.
5. **비로그인 매물 검색 허용 여부** — 허용 시 IP 해시 쿼터만으로 방어해야 해 우회 여지가 커진다. 로그인 필수면 방어력은 오르나 초기 유입이 준다.
6. **환율 갱신 주기** — 기준가 KRW 환산 스냅샷 주기(일 1회 권장).
7. **Node 버전** — 현재 20.15.1로 테스트 툴체인 4개를 하향 고정한 상태다(§2.5). 22 LTS로 올리면 해소된다.
8. **원격 DB의 임시 데이터** — T1.10 디자인 확인용 샘플과 E2E 잔여물이 쌓인다. 샘플은 **카드명과 일러스트가 맞지 않는 가짜 데이터**라 공개 전에 반드시 지워야 한다. `npm run db:clean`은 접두사 + 6자리 타임스탬프 정규식으로만 골라내므로 손으로 등록한 카드를 건드리지 않는다. **2026-08-25 종료 시점 실측: `card_sets` · `cards` · `keywords` · `news_posts` 모두 0행.** 손입력 데이터는 아직 없다.
9. **E2E가 데이터를 남긴다** — 각 spec이 `beforeAll`에서 만든 데이터를 지우지 않아 실행할수록 누적된다. 관측된 누적량은 회당 수십 행 수준이라 **성능이 아니라 "`db:clean`을 매번 잊지 않고 돌려야 하는 상태 그 자체"가 문제**다. 근본 해법은 **테스트 전용 Supabase 프로젝트 분리**다.
    - **자가 정리 선례:** `admin-cards.spec.ts`의 등록 → 수정 → **삭제** 왕복은 끝에 자기 카드를 지운다. 같은 파일의 페이지네이션 테스트(22장)는 **의도적으로 지우지 않는다** — 검색 결과가 22건임을 검증해야 하는데 매번 지우면 다음 실행의 대조군이 사라진다. 대신 `cleanup-sample.ts`가 패턴으로 걷어간다
    - **규칙 1 — 접두사를 새로 쓰는 스펙을 추가하면 `cleanup-sample.ts`의 표와 패턴을 같은 커밋에서 갱신한다.** T1.12-7이 이 규칙을 어긴 첫 사례다 — "발행 취소 → 404" 스펙이 남기는 `unpub-######`가 뉴스 패턴 `^(pub|draft)-`에 걸리지 않았다. **T1.12-7 커밋에서 `^(pub|unpub|draft)-`로 넓혀 해소했다**
    - **규칙 2 — 원인 추적용으로 만든 데이터는 그 세션 안에서 지운다.** `cleanup-sample.ts`에 진단용 접두사를 등록하지 않는다(진단은 반복되는 절차가 아니라 매번 다른 이름을 쓴다). 2026-08-25에 `probe-` · `diag-` · `repro-` 등 13건을 수동으로 걷어냈다 — 그 수동 작업이 이 규칙의 근거다
    - ⚠️ **T1.14부터 성격이 바뀐다** — `db:clean`이 손입력 실데이터와 같은 DB를 청소하는데 **드라이런이 없다.** 실행 직전에 `npm run db:dump`를 반드시 돌린다(T1.13)
10. **카드 삭제는 하드 삭제로 유지한다 (T1.12 결정)** — 참조하는 테이블이 아직 `card_keywords`뿐이고 여기에는 `on delete cascade`가 걸려 있어, soft-delete를 지금 도입하면 전 조회 경로에 `deleted_at is null` 조건을 다는 비용만 남는다. **전환 시점은 `deck_cards`(T2.3)와 `collection_items`(T3.2)가 들어올 때다.** 그때부터는 카드 1장을 지우는 것이 남의 덱과 컬렉션을 조용히 무너뜨리므로 하드 삭제를 유지할 수 없다. 두 마이그레이션 중 먼저 오는 쪽에서 재검토한다.
