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
| 대체 카드는 M:N이 아니라 `similar_group_id` FK | CLAUDE.md 지정 |
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
│   └── e2e/                        # Playwright 스펙 (단위 테스트는 소스 옆 *.test.ts)
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
│   │   ├── card-filter-panel.tsx         # 검색어 · 게임 · 종류 (나머지는 T1.7b)
│   │   ├── card-detail.tsx               # (T1.8)
│   │   ├── base-price-badge.tsx          # 기준가 1개만 표기 (차트 금지)
│   │   ├── similar-cards.tsx             # 대체 카드 그룹
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
│   └── news/
│       ├── news-list.tsx
│       └── news-article.tsx
├── admin/
│   ├── field.tsx                         # Field · TextInput · TextArea · NativeSelect · StatusMessage
│   ├── use-admin-form.ts                 # 등록 폼 공통 제출·에러 처리
│   ├── admin-login-form.tsx
│   ├── set-form.tsx
│   └── card-form.tsx
└── common/
    ├── header.tsx                        # 서버 컴포넌트. 내비 · 테마 토글 조립
    ├── main-nav.tsx                      # 데스크톱 내비 (client — usePathname)
    ├── mobile-nav.tsx                    # 모바일 시트 내비 (client)
    ├── footer.tsx                        # 면책 조항 · 저작권
    ├── theme-provider.tsx                # next-themes 래퍼 (client)
    ├── theme-toggle.tsx                  # 라이트 / 다크 전환 (client)
    ├── affiliate-carousel.tsx            # 하단 제휴 마케팅 캐러셀 (T3.6)
    ├── error-boundary.tsx                # 기능 단위 클라이언트 에러 경계
    └── empty-state.tsx
```

### 3.3 src/lib — 로직

```
src/lib/
├── admin/
│   ├── session.ts                        # ADMIN_TOKEN 검증 · 쿠키 값 (server-only)
│   ├── guard.ts                          # requireAdmin() — 인증의 실제 판단 지점
│   ├── responses.ts                      # zod/Postgres 오류 → 응답 매핑
│   └── queries.ts                        # 관리자 화면 조회
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
similar_groups     (id, game_id, name, role_note)   -- 대체 카드 그룹
cards              (id, game_id, set_id→card_sets, code,
                    name_ja NOT NULL,      -- 크롤러 검색 키 (§4.4, 002에서 교정)
                    name_ko NULL,          -- 커버리지 부분적. 표기는 coalesce(name_ko, name_ja)
                    name_en NULL,
                    rarity, attribute, card_type, sub_type, image_url,
                    effect_text,
                    similar_group_id→similar_groups NULL,   -- ★ CLAUDE.md 지정 FK
                    search_vector tsvector)
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

> **`similar_group_id` FK 채택 (CLAUDE.md 지정)** — 카드 1장은 그룹 1개에만 속한다. "드로우 계열이면서 서치 계열"처럼 한 카드가 복수 그룹에 걸치는 경우는 표현할 수 없으므로, 그런 요구가 생기면 효과 키워드 태그(`card_keywords`)로 대신 커버한다. 구조 변경이 필요해지면 코드보다 본 문서를 먼저 갱신한다.

**인덱스 / 검색**

- `cards.search_vector` — GIN. `name_ko/ja/en + effect_text` 대상 `tsvector`, 트리거로 갱신.
- 부분일치 보강: `pg_trgm` GIN 인덱스를 `cards.name_ko`와 **`cards.name_ja`** 양쪽에 둔다. 실데이터 대부분이 일본어명에 쌓이므로 일본어 인덱스가 실질적으로 더 중요하다 (002).
- `cards(similar_group_id)` — 대체 카드 조회용.
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
| `games`, `card_sets`, `cards`, `keywords`, `card_keywords`, `similar_groups`, `card_prices`, `news_posts` | 익명 `SELECT` 허용, 쓰기는 `service_role`만 |
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

> **`similar_group_id`는 현재 쓰이지 않는다.** `CLAUDE.md`가 "interchangeable 카드는 `similar_group_id` FK로 묶는다"고 지정하고 있으나, 실제 판정은 `base_code`로 한다. 컬럼은 남겨 두었다 — 효과가 비슷한 **다른 이름의 카드**를 수동으로 묶어야 할 때 쓸 수 있다. `CLAUDE.md` 갱신 필요.

### 4.5 관리자 화면 (T1.6-A)

| 항목 | 내용 |
|------|------|
| 인증 | `ADMIN_TOKEN` 환경변수 + httpOnly 쿠키(해시 저장, 12시간). **T3.1 계정 권한 전까지 임시** |
| 경로 보호 | `src/proxy.ts`가 `/admin/*`에서 쿠키 존재를 확인해 로그인으로 보낸다 |
| 값 검증 | 각 API가 `requireAdmin()`으로 쿠키 값을 직접 검증한다. proxy만 믿지 않는다 |
| 쓰기 권한 | `service_role`(RLS 우회)이므로 인증 뒤에서만 호출한다 |
| 화면 | `/admin`(대시보드) · `/admin/sets` · `/admin/keywords` · `/admin/cards/new` |
| API | `POST /api/admin/session` · `POST /api/admin/sets` · `POST /api/admin/cards` · `PATCH·DELETE /api/admin/cards/[cardId]` |

> ⚠️ **토큰 1개 = 전체 쓰기 권한**이다. 유출되면 카탈로그 전체를 조작할 수 있다. T3.1에서 계정 기반 권한으로 교체한다.


---

## 5. API 명세

### 5.1 Route Handlers (`src/app/api`)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/cards` | 도감 검색. `q, game, set, rarity, attribute, cardType, keywords[], cursor, limit`. **키워드는 AND(모두 보유)** | — |
| GET | `/api/cards/facets` | 필터 선택지(레어도 · 속성 · 종류 · 세트 · 키워드). `game`으로 좁힌다 | — |
| GET | `/api/cards/:cardId` | 상세 + 최신 기준가 1건 | — |
| GET | `/api/cards/:cardId/alternatives` | 동일 `similar_group_id` 카드 목록 | — |
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
| POST | `/api/admin/cards` | 카드 등록 |
| PATCH / DELETE | `/api/admin/cards/:cardId` | 카드 수정 · 삭제 |

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

**관리자 화면 후속** (T1.6-A에서 미포함)

- [ ] 카드 수정 · 삭제 UI (API는 있음)
- [ ] 등록 카드 목록 — 검색 · 페이지네이션 (대시보드는 최근 20건만)
- [ ] CSV 일괄 등록 — 수백 장 입력 시 폼 하나씩은 부담
- [ ] 세트 수정 · 삭제
- [ ] `similar_groups`(대체 카드) 등록 화면
- [ ] 키워드 수정 · 삭제, 기존 카드의 키워드 재태깅

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

1. **애드센스 심사 제출 전 준비물** — ①실제 기사 5~10편 발행(코드가 아니라 콘텐츠 문제) ②`NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 교체 ③`ads.txt` 배치와 퍼블리셔 ID 입력 ④EEA 트래픽이 있으면 인증 CMP 도입. 플레이스홀더 페이지(`/decks` `/binder`)가 "제작 중"으로 보이는 것도 반려 사유가 된다.
2. **`CLAUDE.md`의 `similar_group_id` 지정** — 대체 카드 판정을 `base_code`로 바꿨으므로 `CLAUDE.md` 문구를 갱신할지, 아니면 `similar_group_id`를 별도 용도(다른 이름의 유사 효과 카드 수동 그룹)로 살릴지 정해야 한다 (§4.6).
3. **관리자 토큰의 수명** — 지금은 토큰 1개가 곧 전체 쓰기 권한이다. 유출되면 카탈로그 전체를 조작할 수 있다. T3.1까지 이 상태를 유지할지, 더 일찍 계정 기반으로 옮길지.
4. **일본 중고 매물 사이트 약관** (T2.7 선행) — 메르카리 · 라쿠마 · 야후옥션의 이용약관 검토 결과를 `docs/crawler-compliance.md`에 기록해야 한다. 차단 시 대체 전략(공식 API · 제휴)이 필요하다.
5. **카드 이미지 저장 방식** — 현재는 관리자가 외부 URL을 직접 입력한다. 핫링크 대신 자체 호스팅(Supabase Storage / R2)으로 갈지, 그 경우 저작권 처리를 어떻게 할지.
6. **비로그인 매물 검색 허용 여부** — 허용 시 IP 해시 쿼터만으로 방어해야 해 우회 여지가 커진다. 로그인 필수면 방어력은 오르나 초기 유입이 준다.
7. **환율 갱신 주기** — 기준가 KRW 환산 스냅샷 주기(일 1회 권장).
8. **Node 버전** — 현재 20.15.1로 테스트 툴체인 4개를 하향 고정한 상태다(§2.5). 22 LTS로 올리면 해소된다.
