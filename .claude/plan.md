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

---

## 1. 설계 원칙

| # | 원칙 | 근거 |
|---|------|------|
| P1 | **읽기 중심, 쓰기 최소** — 카드/덱/뉴스는 캐시 가능한 읽기. RSC 기본 + ISR로 SEO와 애드센스 심사를 확보한다. | CLAUDE.md: RSC 기본 / README: 애드센스 |
| P2 | **스크래핑은 앱 서버에서 분리** — 외부 사이트 접근은 전부 Cloudflare Workers에서만 수행. Next.js는 대상 사이트에 직접 접근하지 않는다. | CLAUDE.md: Proxy/Scraper |
| P3 | **되팔이 방지는 서버 계약으로 강제** — "1회 1장", "분당 3회", "8~12초 연출"은 프론트 제약이 아니라 API 스키마와 서버 쿼터로 강제한다. | CLAUDE.md: Crawler Restrictions |
| P4 | **도메인 로직은 프레임워크에서 분리** — 시뮬레이터 · 확률 · 가격 정규화는 `src/lib/domain`의 순수 함수로 두어 TDD가 쉬운 형태로 만든다. | AGENT.md: TDD 우선 |
| P5 | **웹 ↔ 워커 계약은 zod 스키마 공유** — 두 런타임이 `src/lib/validation`의 동일 스키마를 import 하여 계약 드리프트를 차단한다. | CLAUDE.md: strict typing |
| P6 | **시세는 기준가 1개만 노출** — 시계열/차트 API를 애초에 만들지 않는다. 히스토리는 내부 집계용으로만 보관. | CLAUDE.md: Price Representation |

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
│   └── proxy.ts                    # Next 16 미들웨어. /admin 경로 보호
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
| 인증 | `ADMIN_TOKEN` 환경변수 + httpOnly 쿠키(해시 저장, 12시간). **T3.1 계정 권한 전까지 임시** |
| 경로 보호 | `src/proxy.ts`가 `/admin/*`에서 쿠키 존재를 확인해 로그인으로 보낸다 |
| 값 검증 | 각 API가 `requireAdmin()`으로 쿠키 값을 직접 검증한다. proxy만 믿지 않는다 |
| 쓰기 권한 | `service_role`(RLS 우회)이므로 인증 뒤에서만 호출한다 |
| 화면 | `/admin`(대시보드) · `/admin/sets` · `/admin/keywords` · `/admin/cards`(목록 — 검색 · 페이지네이션) · `/admin/cards/new`(등록) · `/admin/cards/[cardId]`(수정 · 삭제) |
| API | `POST /api/admin/session` · `POST /api/admin/sets` · `POST /api/admin/cards` · `PATCH·DELETE /api/admin/cards/[cardId]` |

> **카드 도달 경로는 목록(`/admin/cards`) 하나로 모은다.** 대시보드 표의 각 행도 같은 상세로 링크한다. 등록만 되고 다시 찾을 수 없는 상태가 T1.12 이전의 실제 문제였다(§8 T1.12).

> ⚠️ **토큰 1개 = 전체 쓰기 권한**이다. 유출되면 카탈로그 전체를 조작할 수 있다. T3.1에서 계정 기반 권한으로 교체한다. **T1.12에서 삭제 화면이 생겨 노출 범위가 "등록·수정"에서 "카탈로그 삭제"까지 넓어졌다 — 재검토 시점은 §9.2 참조.**


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

ADMIN_TOKEN=                      # 관리자 화면(16자 이상). T3.1 정식 인증 전까지 임시
NEXT_PUBLIC_ADSENSE_CLIENT=       # 애드센스 승인 후. 없으면 광고를 렌더하지 않는다

SUPABASE_DB_PASSWORD=             # 로컬 CLI 전용(link / db push). 앱 런타임 미사용

# T2.9에서 활성화
# CRAWLER_WORKER_URL=
# CRAWLER_SHARED_SECRET=
# IP_HASH_SALT=
```

* `src/lib/env.ts`가 클라이언트 변수를, `src/lib/env.server.ts`가 서버 시크릿을 부팅 시 검증한다.
* 시크릿은 **추적되는 파일(`.gitignore` 포함)에 절대 적지 않는다.**

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
- [x] **T1.7b** 필터 확장 — 완료
  - 마이그레이션 004: `search_cards` · `card_facets` SQL 함수 (+ EXECUTE 권한)
  - 레어도 · 속성 · 종류 · 발매 팩 셀렉트(건수 표기) + **효과 키워드 AND 조합** 칩
  - 관리자: `/admin/keywords` 등록, 카드 폼에서 키워드 태깅
  - 검증: `test` 44건 ✅ / `test:e2e` 19건 ✅ (필터 5건 신규 — 레어도 · 키워드 단일/조합 · 칩 토글 · 게임 전환 시 초기화)
- [x] **T1.8** 카드 상세 (`/cards/[cardId]`) — 완료
  - 마이그레이션 005: `base_code` 생성 컬럼 + `(game_id, base_code)` 인덱스 (§4.6)
  - RSC 직접 조회(색인 대상이므로) · `generateMetadata` · 기준가 배지 · 효과 키워드 링크 · 대체 카드
  - **DB 타입 생성 도입** — `src/types/database.ts` + 3개 클라이언트에 `Database` 제네릭 연결
  - 검증: `test` 44건 ✅ / `test:e2e` 24건 ✅ (상세 5건 신규)
  - `card_prices`가 아직 없어(T2.8) 기준가는 항상 "산출 불가"다
- [x] **T1.9** 뉴스 모듈 · SEO · 애드센스 요건 — 완료
  - 마이그레이션 006: `news_posts` (초안 차단을 RLS에서 처리) + GRANT 3단
  - 뉴스 목록/상세 **ISR** · `react-markdown`+`remark-gfm` · 관리자 작성/수정/발행토글/삭제
  - `sitemap.ts`(PostgREST 1000행 페이지네이션) · `robots.ts` · `metadataBase`+OG
  - 개인정보처리방침(애드센스 필수 고지 포함) · 면책 조항 · 푸터 링크 · `AdSlot`(ID 없으면 미렌더)
  - **부수 수정**: `cookies()` 때문에 동적이던 `/cards/[cardId]`를 익명 클라이언트+`generateStaticParams`로 전환 → SSG
  - 검증: `test` 66건 ✅ / `test:e2e` 39건 ✅ / `build`에서 `/news` `○ 5m`, `/news/[slug]` `●`, `/cards/[cardId]` `●` 확인

- [x] **T1.10** 비주얼 정리 — 상업 서비스 수준의 화면 (§2.8)
  - 갤러리 톤 토큰 3개 + 유틸 3개 (`--surface` · `--surface-raised` · `--hairline` / `.aspect-card` · `.card-placeholder` · `.eyebrow`)
  - 홈 전면 재작성 — 히어로(수치 포함) · 카드 쇼케이스 · 기능 3종 · **제품 원칙 2종** · 최신 소식
  - 헤더 로고 락업(덱바인더/DECKBINDER) · 푸터 4단(서비스·정보 내비 + 정책 링크)
  - 카드 그리드 재설계(실물 비율 · 이미지 없는 카드 처리 · 레어도 배지 대비) · 상세 위계 정리 · 대체 카드 썸네일화
  - `/decks` · `/binder`를 `ComingSoon`으로 교체 — 빈 화면은 애드센스 심사에 불리하다
  - 검증: `test` 66건 ✅ / `test:e2e` 39건 ✅ / `build` ✅ / 브라우저 라이트·다크 육안 확인
  - **주의**: 푸터에 목록이 생겨 `getByRole("listitem")`이 전역에서 6개를 잡았다. 뉴스 마크다운 E2E는 `getByRole("article")`로 범위를 좁혔다

- [x] **T1.11** 전반 리팩토링 — 죽은 코드 제거 · 중복 통합 (§2.7, §4.1)
  - 마이그레이션 007: `search_vector`(컬럼·GIN·트리거·함수) + `similar_groups`(테이블·FK·인덱스·컬럼) 제거
  - **커서 버그 수정** — `search_cards` 커서를 `(code, id)` 튜플로. 게임 필터 없이 훑을 때 같은 코드의 카드가 사라지던 문제
  - `CardImage` 신설 — 이미지 렌더 4곳 통합. `no-img-element` 예외 5곳 → 2곳
  - `fetchCardDetail`·`fetchPostBySlug`를 React `cache()`로 — 상세 렌더당 DB 왕복 2회 → 1회
  - `requireAdminInput()` — 관리자 라우트 6곳의 인증+파싱 4줄을 2줄로. `request.json()`의 `.catch` 누락 위험 제거
  - `revalidateNews()` — 뉴스 캐시 무효화 경로를 한곳에
  - `/api/cards`·`/api/cards/facets`를 익명 클라이언트로 (공개 읽기 = anon 규칙 일치)
  - `npm run db:clean` / `db:sample` 등록, eslint에 `supabase/.temp/**` 무시 추가
  - `CLAUDE.md`의 `similar_group_id` 지정을 `base_code`로 갱신
  - 검증: `test` 66건 ✅ / `test:e2e` **42건** ✅(커서 3건 신규) / `build`에서 `/cards/[cardId]`·`/news/[slug]` `●` 유지
  - **42건은 T1.12 착수 전 `CI=1`(프로덕션 빌드)로 처음 전수 검증했다** — 그전 수치는 serial describe의 미실행분(§7)이 섞여 실측된 적이 없었다. 그 과정에서 관리자 로그인 프리페치(제품 버그)와 콜드 라우트 타임아웃(하네스) 두 건을 고쳤다 (§2.7)

- [ ] **T1.12** 관리자 운영 최소 완결 + 404/로딩 (§4.5, §5.1) — 아래 백로그 **A-1~3 · B-1~2 · D**를 묶었다
  - 브랜치 `feat/t1-12-admin-ops` (T1.11을 `main`에 `--no-ff` 머지한 뒤 신설). **마이그레이션 0건 → `db:types` 재생성 없음**
  - **착수 근거:** 관리자 화면에서 개별 카드에 도달하는 경로가 **0개**다. `src/app/admin/page.tsx`의 대시보드 표에는 행 링크가 없고 `/admin/cards` 라우트 자체가 없다. 게다가 `cards.name_ja`는 §4.4 기준 **일본 매물 검색의 유일한 키**이고 `code`는 §4.6의 `base_code`를 좌우하는데, 오타를 고칠 화면이 없다. 지금 병목은 코드가 아니라 **비어 있는 카탈로그**이므로(§9.1) 입력 도구를 고치는 것이 이후 전 작업의 처리량을 올린다
  - [ ] **T1.12-1** `/admin/cards` 등록 카드 목록 — 검색 · 페이지네이션 · M
    - 신설 `src/app/admin/cards/page.tsx` (RSC · `dynamic = "force-dynamic"`) / `src/lib/admin/queries.ts`에 `fetchAdminCards({ q, page })` 추가
    - `src/app/admin/layout.tsx` nav에 "카드 목록"을 "카드 등록" 왼쪽에 추가 · `src/app/admin/page.tsx` 표의 각 행을 `/admin/cards/[cardId]`로 링크
    - **`search_cards` RPC를 쓰지 않는다** — ⓐ `code`가 검색 대상에서 빠져 있고 ⓑ `security invoker`라 anon RLS 기준이며 ⓒ total을 주지 않는다. admin 클라이언트로 `code`·`name_ja`·`name_ko`를 `.or(...ilike...)` + `count: "exact"`로 직접 조회한다 (⚠ 입력 새니타이즈는 §2.7 "PostgREST `.or()` 문자열 필터")
    - 재사용: 표 마크업은 `src/app/admin/news/page.tsx`를 따라간다. **공용 `AdminTable`을 만들지 않는다**(사용처 2곳, 추상화가 이르다) · `EmptyState` · `fetchCounts`의 `count: "exact"` 패턴
    - 라우팅 확인 완료: `cards/new/`와 `cards/[cardId]/`는 충돌하지 않는다 — 정적 세그먼트가 먼저 매칭되고 카드 id는 uuid다
    - **완료 기준:** 카드가 100장을 넘어도 코드·일본어명·한국어명으로 찾히고, 총 건수가 보이고, 2페이지로 넘어간다. E2E 1건(검색 + 페이지 이동)
  - [ ] **T1.12-2** `/admin/cards/[cardId]` 수정 · 삭제 화면 · M
    - 신설 `src/app/admin/cards/[cardId]/page.tsx` / `src/lib/admin/queries.ts`에 `fetchAdminCard(cardId)` 추가(`card_keywords(keyword_id)` 임베드 — §3.3 모듈 규칙 6)
    - `src/components/features/admin/card-form.tsx`에 `cardId?` · `initial?` · `initialKeywordIds?`를 추가해 **등록·수정 겸용**으로 만든다. `CardEditForm`을 새로 만들지 않는다 — `use-admin-form.ts`가 이미 `method`·`resetOnSuccess`를 지원하고 `news-form.tsx`의 `postId?` 분기가 그대로 옮겨진다. `resetOnSuccess: !isEdit`(수정 폼을 비우면 방금 고친 내용이 사라진다), 키워드 초기값은 `initialKeywordIds ?? []`
    - `news-delete-button.tsx` → `admin-delete-button.tsx`로 일반화(`endpoint` · `redirectTo` · `label`). 두 번째 사용처가 생긴 지금이 정확한 시점이다(T1.11의 `CardImage` 통합과 같은 판단). 확인 → 삭제 2단계 동작은 그대로 둔다. 기존 호출처는 `src/app/admin/news/[postId]/page.tsx` 1곳
    - **완료 기준:** 목록 → 카드 클릭 → `name_ja` 수정 → 저장 → 도감에 반영. 삭제 → 목록에서 사라지고 `/cards/{id}`가 404. E2E 1건(등록 → 수정 → 삭제 왕복)이며 **이 스펙은 마지막에 자기 데이터를 지운다**(§9.9를 이 경로에서 해소)
  - [ ] **T1.12-3** 키워드 재태깅 — `PATCH`의 400 제거 · S~M
    - `src/app/api/admin/cards/[cardId]/route.ts` — 앱 레벨 보상 트랜잭션(이전 목록 확보 → delete → insert → 실패 시 재삽입). 계약은 §5.1 참조
    - **T1.12-2와 묶이는 이유는 순서가 아니라 의존이다.** `CardForm`을 재사용하는 순간 수정 화면에 키워드 칩이 뜨고, 저장하면 400이 난다. 미루면 반쯤 깨진 화면이 남는다
    - 권한 확인 완료 — 마이그레이션 001에서 `service_role`이 `card_keywords`에 `delete`를 이미 갖고 있다. **권한 마이그레이션 불필요**
    - **완료 기준:** 키워드를 빼고 더한 뒤 저장 → 카드 상세의 칩과 `/cards?keywords=` 필터에 즉시 반영. T1.12-2의 E2E 왕복에 키워드 토글 1개 추가
  - [ ] **T1.12-4** `not-found.tsx` + 상세 `loading.tsx` · S
    - 신설 `src/app/not-found.tsx` · `src/app/(app)/cards/[cardId]/loading.tsx` · `src/app/(content)/news/[slug]/loading.tsx`
    - `src/app/error.tsx`의 export 함수명 `GlobalError` → `RouteError` (1줄). 이 이름 때문에 `global-error.tsx`가 이미 있는 것으로 오인된다 — 현재 `src/app` 전체에 상태 파일은 `error.tsx` 하나뿐이다
    - **루트 하나면 충분하다** — `src/app/layout.tsx`가 `Header`/`Footer`를 렌더하고 루트 `not-found.tsx`는 그 안에서 렌더되므로, 카드·뉴스 상세의 `notFound()`와 미매칭 URL을 한 파일이 모두 덮는다
    - 재사용: `EmptyState` · `Skeleton` + `.aspect-card`. **새 스켈레톤 컴포넌트 파일을 만들지 않는다**(상세 로딩은 12줄이면 끝나고 `CardGridSkeleton`은 그리드용이라 맞지 않는다)
    - **완료 기준:** `/cards/00000000-0000-0000-0000-000000000000` 방문 시 헤더·푸터가 있는 404 + "도감으로" 링크. E2E 1건(`page.goto()` 응답 status 404 + 헤더 표시)
  - [ ] **T1.12-5** (스트레치) 관리자 인증 단위 테스트 · S
    - `src/lib/admin/session.test.ts` · `src/lib/admin/responses.test.ts` · `vitest.config.mts`
    - **선행 장애물:** `vitest.config.mts`에 `server-only` alias가 없으면 import 즉시 터진다 (§2.7). **T1.12-5를 못 끝내더라도 alias는 남긴다** — 다음 사람이 안 밟는다
    - 케이스: `ADMIN_TOKEN` 미설정/15자 → throw · 길이가 다른 입력에 예외 없이 `false`(`safeEqual`의 길이 가드 회귀 방지 — 지우면 401이 500이 된다) · 해시 쿠키 통과/1글자 차이 거부 · `23505`·`23503`·`23502` 매핑과 **DB 원문이 응답 본문에 새지 않는지**
    - `adminToken()`은 `process.env`를 모듈 로드 시가 아니라 **호출 시** 읽으므로 `vi.stubEnv`로 케이스마다 갈아끼울 수 있다(모듈 리셋 불필요)
    - **왜 지금:** `session.ts`는 인터넷과 `service_role` 쓰기 사이의 유일한 방벽인데 지금은 E2E 401 1건으로만 간접 검증된다. T1.12-1~3이 그 쓰기 표면을 **넓힌다**(목록·수정·삭제·재태깅)
  - [ ] **T1.12-6** 문서 갱신 — 본 문서 §3.2 · §4.5 · §5.1 · §8 · §9 (이 커밋에 포함)
  - **주의**: `data-testid="form-error"`를 `field.tsx`(StatusMessage) · `admin-delete-button.tsx` · `admin-login-form.tsx` 세 곳이 공유하고 E2E 3곳이 **전역으로** 잡는다. 카드 수정 화면은 **폼과 삭제 버튼이 한 페이지에 공존**하므로 둘이 동시에 에러를 내면 Playwright strict mode가 "resolved to 2 elements"로 실패한다. 새 스펙은 `form` 또는 삭제 영역으로 범위를 좁혀 잡는다 — 위 T1.10 주의사항의 `listitem` 사고와 **같은 유형**(전역 셀렉터가 두 번째 사용처를 만나는 순간 깨진다)이다
  - 검증 목표: `test` 66건 + T1.12-5 신규 / `test:e2e` **`CI=1`(프로덕션 빌드) 기준** 42건 + 신규 3건 (§7) / `build`에서 `/cards/[cardId]`·`/news/[slug]` `●` 유지(`/admin/**`은 `force-dynamic`이라 `ƒ`가 정상) / 마무리에 `npm run db:clean`

**T1.11 리팩토링에서 확인한 백로그**

우선순위 순. A는 **실사용을 막고 있다** — 카드를 등록할 수는 있는데 다시 찾거나 고칠 수단이 없다.

> **A-1~3 · B-1~2 · D는 T1.12로 묶어 처리 중이다.** 나머지는 아래에 그대로 남으며, 각 항목에 T1.12에서 뺀 이유를 적었다.

**A. 관리자 운영** (T1.6-A 미포함분)

- [ ] **A-1** 등록 카드 목록 — 검색 · 페이지네이션. 대시보드가 최근 20건만 보이고 그 표에조차 링크가 없어 **등록한 카드를 다시 찾을 방법이 없다** → **T1.12-1**
- [ ] **A-2** 카드 수정 · 삭제 UI — `PATCH`/`DELETE /api/admin/cards/[cardId]`는 이미 있고 화면만 없다 → **T1.12-2**
- [ ] **A-3** 키워드 재태깅 — `PATCH`가 `keyword_ids`를 400으로 명시 거부한다. 지금은 태그를 고치려면 카드를 지우고 다시 만들어야 한다 → **T1.12-3**
- [ ] **A-4** 세트 수정 · 삭제, 키워드 수정 · 삭제 (등록만 가능) — **T1.12 범위 밖.** 개수가 적고 "다시 못 찾는" 문제가 아니다. T1.12-2에서 `AdminDeleteButton`을 일반화해두면 각각 S로 줄어든다
- [ ] **A-5** CSV 일괄 등록 — 수백 장을 폼 하나씩은 비현실적. **T1.12 범위 밖(L).** 중복 처리 · 부분 실패 · 드라이런 · 게임/세트 매핑 설계가 먼저다. 잘못 만들면 카탈로그를 덮어쓴다 — §4.4가 시드 스크립트를 삭제한 것과 같은 위험이라 **별도 설계 태스크로 분리**한다

**B. 사용자 화면 — 없어서 티가 나는 것**

- [ ] **B-1** `not-found.tsx` — 지금은 `notFound()`가 헤더·푸터 없는 Next 기본 404를 낸다. 카드·뉴스 상세에서 실제로 발생하고, T1.10의 "상업 서비스로 보이게" 와 정면으로 어긋난다 → **T1.12-4**
- [ ] **B-2** `loading.tsx` — 확실한 이득은 **도감 그리드 → 카드 상세로 넘어가는 클라이언트 내비게이션** 구간이고, 실사용 경로도 그쪽이다 → **T1.12-4**
  - ~~"첫 요청에 생성되는 on-demand ISR이라 그 동안 빈 화면"~~ → **사유를 교정한다.** 콜드 **문서** 요청은 blocking fallback이라 `loading.tsx`가 그 구간을 덮지 못할 가능성이 크다. **추정이며 실측으로 확정해야 한다** — 이 사유만 믿고 범위를 넓히지 말 것
- [ ] **B-3** `global-error.tsx` — 루트 `error.tsx`만 있다. **T1.12 범위 밖.** 루트 레이아웃 자체가 터진 경우만 잡아 빈도가 낮고 `<html>`/`<body>`를 직접 렌더해야 해 검증이 번거롭다. 함수명 오인(`GlobalError`)만 T1.12-4에서 1줄 정리한다
- [ ] **B-4** 도감 결과 건수 표시 — `search_cards`가 total을 주지 않는다. count를 따로 받을지 커서 방식을 유지할지 판단 필요. **T1.12 범위 밖**
- [ ] **B-5** 도감 정렬 옵션 (지금은 코드순 고정). **T1.12 범위 밖** — 정렬 키를 바꾸면 커서 튜플도 바꿔야 하는데(§2.7 "커서 키 ≠ 유니크 키") 007에서 **방금 고친 곳**이다. 하루에 끼워 넣을 일이 아니다

**C. 검색·데이터** — 전부 **T1.12 범위 밖.** `search_cards` 재작성은 마이그레이션 008 + `db:types` 재생성을 부르는데, 카탈로그가 거의 비어 있어 지금 체감 이득이 0에 가깝다

- [ ] **C-1** `name_en`이 검색에서 빠져 있다 — `search_cards`는 `name_ja`/`name_ko`만 본다
- [ ] **C-2** `effect_text` 검색 — "카드를 뽑는다"로 찾고 싶은 수요가 크고, 키워드 태깅 수작업도 줄여준다

**D. 테스트 공백** → **T1.12-5**(스트레치). 선행으로 `vitest.config.mts`의 `server-only` alias가 필요하다 (§2.7)

- [ ] **D-1** `src/lib/admin/session.ts` 무테스트 — `timingSafeEqual` 비교와 해시 쿠키 생성은 **인증의 핵심**인데 E2E의 401 확인으로만 간접 검증된다
- [ ] **D-2** `src/lib/admin/responses.ts` 무테스트 — PG 오류코드 매핑(23505/23503/23502)

**E. 운영**

- [ ] `db:types`가 **로컬 Docker DB**를 가리킨다. 원격에만 적용하고 타입을 뽑으면 스키마와 조용히 어긋난다 — `db:reset` → `db:migrate` → `db:types` 순서를 지킬 것 (T1.12는 마이그레이션을 만들지 **않으므로** 이번엔 발생하지 않는다)
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

---

## 9. 미해결 — 결정이 필요한 사항

1. **애드센스 심사 제출 전 준비물** — ①실제 기사 5~10편 발행(코드가 아니라 콘텐츠 문제) ②`NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 교체 ③`ads.txt` 배치와 퍼블리셔 ID 입력 ④EEA 트래픽이 있으면 인증 CMP 도입. ~~플레이스홀더 페이지가 "제작 중"으로 보이는 것~~ → T1.10에서 `ComingSoon`으로 해소.
2. **관리자 토큰의 수명** — 지금은 토큰 1개가 곧 전체 쓰기 권한이다. 유출되면 카탈로그 전체를 조작할 수 있다. T3.1까지 이 상태를 유지할지, 더 일찍 계정 기반으로 옮길지. **재검토 시점이 앞당겨졌다:** T1.12에서 `/admin/cards/[cardId]`에 삭제 버튼이 생겨 토큰 1개로 **카탈로그 삭제**까지 가능해졌다. 등록·수정만 되던 때는 잘못된 데이터가 남는 것이 최악이었지만, 이제는 하드 삭제(§9.10)라 **되돌릴 수 없다.** T3.1을 기다리지 말고 결정한다. **덧붙여, 이 토큰 로그인 흐름은 프로덕션 빌드에서만 깨져 있었고(§2.7 프리페치) 배포 환경에서는 로그인 자체가 되지 않았다.** 임시 인증이라 검증도 얇다는 뜻이므로 교체 판단에 함께 넣는다.
3. **일본 중고 매물 사이트 약관** (T2.7 선행) — 메르카리 · 라쿠마 · 야후옥션의 이용약관 검토 결과를 `docs/crawler-compliance.md`에 기록해야 한다. 차단 시 대체 전략(공식 API · 제휴)이 필요하다.
4. **카드 이미지 저장 방식** — 현재는 관리자가 외부 URL을 직접 입력한다. 핫링크 대신 자체 호스팅(Supabase Storage / R2)으로 갈지, 그 경우 저작권 처리를 어떻게 할지.
5. **비로그인 매물 검색 허용 여부** — 허용 시 IP 해시 쿼터만으로 방어해야 해 우회 여지가 커진다. 로그인 필수면 방어력은 오르나 초기 유입이 준다.
6. **환율 갱신 주기** — 기준가 KRW 환산 스냅샷 주기(일 1회 권장).
7. **Node 버전** — 현재 20.15.1로 테스트 툴체인 4개를 하향 고정한 상태다(§2.5). 22 LTS로 올리면 해소된다.
8. **원격 DB의 임시 데이터** — T1.10 디자인 확인용 샘플(세트 2 · 카드 8 · 키워드 3 · 기사 3)과 E2E가 매 실행마다 남기는 카드·세트·기사가 쌓여 있다. 샘플은 **카드명과 일러스트가 서로 맞지 않는 가짜 데이터**라 공개 전에 반드시 지워야 한다. `npm run db:clean` — 접두사 + 6자리 타임스탬프 정규식으로만 골라내므로 손으로 등록한 카드는 건드리지 않는다. **T1.12 착수 전 정리 후 실측: `cards` · `card_sets` · `keywords` · `news_posts` 모두 0행이다.** 손으로 등록한 데이터는 애초에 없었으므로 유실은 없고, T1.12의 착수 근거인 "지금 병목은 비어 있는 카탈로그"가 수치로 확인됐다.
9. **E2E가 데이터를 남긴다** — 각 spec이 `beforeAll`에서 만든 카드·세트·키워드를 지우지 않아 실행할수록 원격 DB에 누적된다. **T1.12 착수 전 관측: 누적량은 두 차례 정리에서 각각 24행 · 7행 수준으로 작았고, 성능 저하는 아직 나타나지 않았다.** 즉 지금 문제는 성능이 아니라 **`db:clean`을 매번 잊지 않고 돌려야 하는 상태 그 자체**다. `afterAll`에서 스스로 지우게 하거나 테스트 전용 프로젝트를 분리하는 편이 낫다. T1.12-2의 등록 → 수정 → **삭제** 왕복 스펙은 자기 데이터를 지우므로 이 경로에서는 해소된다 — 나머지 스펙에 적용할 선례로 삼는다.
10. **카드 삭제는 하드 삭제로 유지한다 (T1.12 결정)** — 참조하는 테이블이 아직 `card_keywords`뿐이고 여기에는 `on delete cascade`가 걸려 있어, soft-delete를 지금 도입하면 전 조회 경로에 `deleted_at is null` 조건을 다는 비용만 남는다. **전환 시점은 `deck_cards`(T2.3)와 `collection_items`(T3.2)가 들어올 때다.** 그때부터는 카드 1장을 지우는 것이 남의 덱과 컬렉션을 조용히 무너뜨리므로 하드 삭제를 유지할 수 없다. 두 마이그레이션 중 먼저 오는 쪽에서 재검토한다.
