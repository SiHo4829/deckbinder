# DeckBinder — 아키텍처 설계서 (plan.md)

> 작성: Architect Agent · 상위 기준 문서: `CLAUDE.md` > `AGENT.md` > `README.md`
> 본 문서는 Developer 에이전트가 구현 시 따르는 **디렉토리 구조 / 프레임워크 구성 / 데이터 모델 / API 계약**의 단일 기준(SSOT)이다.
> `CLAUDE.md`와 충돌하는 내용이 발견되면 `CLAUDE.md`가 우선하며, 본 문서를 갱신한다.

---

## 0. 개정 이력

| 버전 | 변경 |
|------|------|
| v12 | T1.7 완료 — 도감 검색·무한스크롤. §4.4에 T1.7 실측 메모 신설: 일본어는 tsvector가 아닌 ilike+trgm으로 검색해야 하고, Supabase 클라이언트는 Next 런타임에서만 동작하며, nuqs는 Suspense 경계가 필요하다. 레어도·속성·팩·키워드 필터는 facets 선행이 필요해 T1.7b로 분리. |
| v11 | T1.6a 완료 — ptcg 일본어 12,619장 적재. 003(card_sets nullability, 002에서 누락분) 추가 적용. §4.4에 실측 메모 신설: TCGdex 일본어 카드에 **이미지가 없고**, `energyType`은 `"Normal"`=기본이며, GraphQL은 언어 인자가 없다. |
| v10 | T1.5b 완료 — 마이그레이션 002 적용. cards 이름 컬럼 nullability를 §4.4 실측에 맞게 교정하고 일본어명 trigram 인덱스 추가. §4.1 데이터 모델 · 인덱스 설명을 실제 스키마와 일치시킴. |
| v9 | **카드 데이터 원천 확정 (§4.4 신설, 실측 기반)** — ptcg 일본어는 TCGdex(12,619장), opcg는 공식 사이트 스크래핑. 한국어는 두 게임 모두 부분 커버리지. **`name_ko not null` / `name_ja` nullable이 정반대임을 발견** → T1.5b(마이그레이션 002)로 교정. T1.6을 5개 하위 태스크로 분해. §9.2 해소. |
| v8 | T1.5 결과 반영 — 마이그레이션 001 적용 완료. **§4.1-1 신설: RLS 정책만으로는 접근이 성립하지 않는다(GRANT 선행 검사)** — 로컬 리허설에서 anon SELECT와 service_role INSERT가 모두 막히고 TRUNCATE가 열려 있던 것을 발견해 revoke/grant 3단 규칙을 표준화. |
| v7 | T1.4 결과 반영 — 환경변수를 `env.ts`(클라이언트) / `env.server.ts`(서버 시크릿, `server-only`) 2개로 분리. 단일 `env.ts`로 두면 서버 시크릿 스키마가 클라이언트 번들 경로에 노출된다. Supabase 클라이언트 3종 추가. |
| v6 | T1.3 결과 반영 — 앱 셸 구성 완료, `next-themes` 도입으로 다크 모드 해소, `src/lib/navigation.ts` · `common/*` 목록 갱신, 플레이스홀더 페이지 4종의 대체 시점 명시, TanStack Query 프로바이더를 T1.7로 이관. |
| v5 | T1.2 결과 반영 — §2.6 shadcn 설정 신설(base=radix / preset=nova, alias 2건 수정 사유), 프로젝트 토큰 분리 원칙, 루트 트리에서 `tailwind.config.ts` 제거(Tailwind v4 CSS-first) 후 `components.json` 추가, T1.3에 다크 모드 활성화 과제 명시. |
| v4 | 초기 지원 TCG를 **포켓몬 + 원피스** 2종으로 확정(유희왕 제외). §4.0 게임별 룰 신설, `games` 테이블에 룰 컬럼 추가, `deck_cards.zone`을 `main\|leader\|don`으로 변경, 첫 손패 매수를 게임별로 분기. |
| v3 | T1.1 실착수 결과 반영 — Next.js **16.3.2** 설치 확정(15.x 표기 정정), Next 16 파괴적 변경 §2.4 신설, 실제 npm scripts와 툴체인 버전 고정 사유 기록, Node 버전 제약 명시. |
| v2 | `CLAUDE.md` 확정에 따라 전면 정렬 — pnpm 모노레포 안 폐기, `npm` + `src/` 4구획 단일 앱 구조 채택. 대체 카드 그룹화를 M:N 조인 테이블에서 `similar_group_id` FK로 변경. 매물 필터를 3종으로 고정. |
| v1 | 초안 |

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

### 2.3 npm scripts (package.json)

**T1.1에서 등록 완료 (현재 상태)**

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",                          // Next 16에서 `next lint` 제거됨
    "typecheck": "next typegen && tsc --noEmit", // typegen 산출물이 .next/(gitignore)라 선행 필요
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:reset": "supabase db reset",     // 로컬 리허설 (Docker 필요)
    "db:migrate": "supabase db push"     // 원격 적용
  }
}
```

**해당 태스크에서 추가할 스크립트** — 대상이 아직 없어 지금 등록하면 실패하는 스크립트가 되므로 미등록 상태다.

| 스크립트 | 추가 시점 |
|----------|-----------|
| `db:seed`: `tsx scripts/seed.ts` | T1.6 (시드 스크립트) |
| `worker:dev` / `worker:deploy`: `npm --prefix workers/crawler run …` | T2.6 (워커 스캐폴딩) |

> ⚠️ `CLAUDE.md`의 Commands 목록에는 `test`가 없으나 `AGENT.md`의 Verification 단계가 `npm run test`를 요구한다. 스크립트는 등록했으므로, `CLAUDE.md`의 Commands 절에도 `npm run test` · `npm run typecheck` 추가를 권장한다.

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
├── scripts/
│   └── seed.ts                     # 카드 · 키워드 · 그룹 시드 투입
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
│   └── types/                      # TypeScript 인터페이스 정의
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
├── auth/
│   ├── login/page.tsx
│   └── callback/route.ts                 # OAuth 콜백
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
│   │   ├── card-grid.tsx
│   │   ├── card-filter-panel.tsx         # 속성 · 레어도 · 팩 · 효과 키워드
│   │   ├── card-detail.tsx
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
    ├── cn.ts  format.ts  currency.ts  hash.ts
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
news_posts         (id, slug UNIQUE, title, summary, content_md,
                    thumbnail_url, author_id, published_at)

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


### 4.4 카드 데이터 원천 (T1.6 확정 · 2026-08-23 실측)

각 후보를 직접 호출해 측정한 결과다. 문서가 아니라 응답 기준이다.

#### 포켓몬 (`ptcg`)

| 원천 | 측정값 | 판정 |
|------|--------|------|
| **TCGdex** `api.tcgdex.net/v2/ja` | 카드 **12,619**장 / 세트 183개, 최신 M5(메가) 시대까지 | ✅ **일본어 주 원천** |
| TCGdex `/v2/ko` | 카드 **239**장 / 세트 95개 — 세트 메타데이터만 있고 카드가 비어 있는 세트가 대부분(SV3a·SV1a·SV2P 모두 0장) | ❌ 한국어 원천으로 사용 불가 |
| TCGdex `/v2/en` | 카드 23,546장 (참고용) | — |
| `pokemoncard.co.kr` (공식 한국) | HTTP 200, 서버 렌더링 HTML | ⚠️ 한국어 보완 원천 (스크래핑 필요) |

* TCGdex는 **API 키 불필요 · 명시적 rate limit 없음**. 다만 "과하게 호출하지 말고 로컬에 캐시하라"는 방침이므로 수집은 1회 벌크 후 DB 적재로 끝낸다.
* 이미지는 `assets.tcgdex.net`에 별도 호스팅되며 화질/포맷을 URL로 지정한다(`high.webp` 등).

#### 원피스 (`opcg`)

| 원천 | 측정값 | 판정 |
|------|--------|------|
| `onepiece-cardgame.com` (공식 일본) | HTTP 200, 8개 언어 제공(한국어 포함). 필터·페이지네이션은 클라이언트 JS | ✅ **일본어 주 원천** (스크래핑) |
| **`onepiece-cardgame.kr`** (공식 한국) | HTTP 200, 서버 렌더링 HTML. 반다이남코코리아 한글판 **2024-03-22 발매** | ✅ **한국어 원천** (스크래핑) |
| `apitcg.com` | One Piece 지원하나 **API 키 등록 필수** | 🔄 스크래핑 실패 시 대안 |
| `optcgapi.com` | 엔드포인트 404 | ❌ |

* 두 공식 사이트 모두 `robots.txt`가 없다(404). 크롤 금지 명시는 없으나 **이용약관 검토는 별도로 필요**하며 결과를 `docs/crawler-compliance.md`에 기록한다.
* 한글판이 2024-03 시작이므로 **그 이전 세트에는 한국어 이름이 존재하지 않는다.**

#### ★ 스키마에 미치는 결정적 영향

마이그레이션 001은 `name_ko`를 `not null`, `name_ja`를 nullable로 정의했다. **실측 결과 이는 정반대다.**

| 컬럼 | 001 정의 | 실제 필요 | 근거 |
|------|----------|-----------|------|
| `name_ja` | nullable | **`not null`** | 크롤러가 메르카리·라쿠마·야후옥션 검색어로 쓰는 유일한 키. 없으면 §5.3 매물 조회가 성립하지 않는다 |
| `name_ko` | `not null` | **nullable** | 포켓몬은 API 커버리지 2%, 원피스는 2024-03 이전 세트에 한국어판 자체가 없다 |

`name_ko not null`을 유지하면 **포켓몬 카드의 98%를 적재할 수 없다.** 마이그레이션 002로 교정한다(T1.5b).

**표기 규칙:** UI는 `name_ko ?? name_ja`로 표시하고, 한국어명이 없으면 일본어명을 그대로 노출한다. 별도 번역을 생성하지 않는다.

#### T1.7 실측 메모

| 항목 | 실측 | 대응 |
|------|------|------|
| **일본어 전문검색** | `simple` 사전은 공백으로 토큰을 나눈다. 일본어는 공백이 없어 카드명 전체가 토큰 1개가 되고, 부분일치가 안 된다 | 검색은 `search_vector`가 아니라 **`ilike` + pg_trgm 인덱스**로 처리한다. `name_ja`/`name_ko`를 `or`로 묶는다 |
| **Supabase 클라이언트 런타임** | 순수 Node 20.15에서는 `createServerClient`가 WebSocket 부재로 실패하지만, **Next 런타임(dev·build)에서는 정상 동작**한다(undici 번들) | 앱 코드는 `@/lib/supabase/*`를 그대로 쓴다. **독립 실행 스크립트만** PostgREST 직접 호출이 필요하다 |
| **nuqs + 정적 프리렌더** | `useSearchParams`를 쓰는 컴포넌트는 Suspense 경계가 없으면 `next build`의 프리렌더에서 실패한다(dev에서는 드러나지 않음) | 도감 페이지에서 `<Suspense>`로 감싼다 |

#### T1.6a 실측 메모 (수집 중 확인)

| 항목 | 실측 | 대응 |
|------|------|------|
| **카드 이미지** | TCGdex 일본어 카드에 `image` 필드가 없고 `assets.tcgdex.net`의 ja 경로도 404 | **이미지 없이 동작하는 UI가 필수**다(§9.3). 이미지는 별도 원천 확보 전까지 미제공 |
| **`energyType` 어휘** | 기본 에너지는 `"Basic"`이 아니라 **`"Normal"`**, 특수는 `"Special"`, 구세트(PMCG 등)는 값 없음 | `"Normal"`/`"Basic"` → `basic_energy`, 값이 없으면 이름 「基本◯エネルギー」로 판별. 기본 에너지 119장 확보 |
| **GraphQL 언어** | TCGdex GraphQL은 언어 인자가 없어 영어 전용 | 일본어는 REST `/v2/ja/`만 사용. 카드 상세는 카드당 1요청이라 동시성 8로 제한 |
| **`supabase-js`** | 생성 시 realtime이 네이티브 WebSocket(Node 22+)을 요구해 Node 20.15에서 즉시 실패 | 시드는 PostgREST를 직접 호출한다 (§2.5 Node 제약의 세 번째 사례) |

#### T1.6 수집 전략

| 단계 | 대상 | 방식 |
|------|------|------|
| T1.6a | ptcg 일본어 | TCGdex 벌크 수집 → `cards`(name_ja, effect_text, rarity, image_url) |
| T1.6b | ptcg 한국어 | `pokemoncard.co.kr` 스크래핑 → 카드 코드로 매칭해 `name_ko` 갱신 |
| T1.6c | opcg 일본어 | `onepiece-cardgame.com` 스크래핑 |
| T1.6d | opcg 한국어 | `onepiece-cardgame.kr` 스크래핑 → `name_ko` 갱신 (2024-03 이후 세트만) |
| T1.6e | 키워드 태깅 | `effect_text` 정규식 규칙으로 `card_keywords` 1차 자동 부여 후 수동 보정 |

> **이미지 저작권(§9.3 연계):** 카드 이미지는 각 유통사 저작물이다. 핫링크 대신 자체 캐싱을 하더라도 저작권 문제는 남는다. `docs/crawler-compliance.md`에 이미지 사용 방침을 명시하고, 최악의 경우 이미지 없이 텍스트 정보만 제공하는 폴백을 유지한다.


---

## 5. API 명세

### 5.1 Route Handlers (`src/app/api`)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/cards` | 도감 검색. `q, game, set, rarity, attribute, keywords[], cursor, limit` | — |
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
SUPABASE_SERVICE_ROLE_KEY=        # 서버 전용, NEXT_PUBLIC_ 접두사 금지
CRAWLER_WORKER_URL=
CRAWLER_SHARED_SECRET=            # HMAC 서명 키 (워커와 동일 값)
IP_HASH_SALT=
NEXT_PUBLIC_SITE_URL=

# workers/crawler (wrangler secret put)
CRAWLER_SHARED_SECRET=
```

`src/lib/env.ts`에서 zod로 부팅 시 검증하고, 누락 시 즉시 실패시킨다.

---

## 7. 테스트 전략 (TDD)

단위 테스트는 소스 옆에 `*.test.ts`로 배치하고, E2E만 `tests/e2e`에 둔다.

| 레벨 | 도구 | 대상 | 필수 케이스 |
|------|------|------|-------------|
| 단위 | Vitest | `src/lib/domain` | 시드 셔플 재현성, 멀리건 후 덱 상태 불변, 하이퍼기하 확률값, 기준가 이상치 제거, `sample_size<3` 시 산출 불가, 컬렉션 총액 |
| 단위 | Vitest | `workers/crawler/src/adapters` | 픽스처 HTML → `Listing` 정규화(가격 · 통화 · 상태 · 등급 파싱), 파싱 실패 시 graceful skip |
| 통합 | Vitest + MSW | Route Handlers | 쿼터 초과 429, `cardId` 배열 요청 400, 비소유자 스트림 접근 403, 미인증 쓰기 401 |
| 통합 | vitest-pool-workers | 워커 | 토큰 재사용 거부, 만료 토큰 거부, 잘못된 서명 거부 |
| E2E | Playwright | 핵심 흐름 | ① 카드 검색 → 상세 → 매물 조회 연출 완주(8초 이상 소요 확인) ② 덱 빌더 → 첫 손패 드로우(게임별 매수) → 멀리건 ③ 로그인 → 컬렉션 추가 → 공유 링크 |

**Developer 규칙:** 각 태스크는 `실패하는 테스트 커밋` → `구현 커밋` 순서를 지킨다 (AGENT.md).

---

## 8. 구현 로드맵

### Phase 1 — 기반 구축

- [x] **T1.1** 저장소 초기화 — 완료
  - `git init`(main) + origin `https://github.com/SiHo4829/deckbinder.git` + `.gitignore`
  - Next.js 16.3.2 스캐폴딩 (App Router · TS strict · Tailwind v4 · src-dir · `@/*` 별칭)
  - §2.3 npm scripts 등록, §2.5 툴체인 버전 고정
  - Vitest(jsdom + Testing Library) · Playwright 설정 및 하네스 검증
  - 검증: `lint` ✅ / `typecheck` ✅ / `test` ✅ 3건 / `build` ✅ / `test:e2e` ✅ 1건
  - **E2E는 전용 포트 3100 사용** — 3000번은 다른 프로젝트와 충돌하며, `reuseExistingServer: false`로 외부 서버 오접속을 차단한다
  - 부수 산출물: `src/components/common/empty-state.tsx`(+테스트) — 하네스 검증 겸 §3.2 정의 컴포넌트
- [x] **T1.2** shadcn/ui 초기화 + 디자인 토큰 정의 — 완료
  - `components.json`(base=radix / preset=nova / baseColor=neutral), alias 2건 수정 (§2.6)
  - `src/lib/utils/cn.ts` + 테스트 4건
  - 기본 컴포넌트 5종 설치: `button` · `dialog` · `sheet` · `select` · `skeleton`
  - `globals.css` 토큰 계층 + 프로젝트 토큰(게임 아이덴티티 2종) 별도 블록
  - 수정: shadcn이 생성한 `--font-sans: var(--font-sans)` 자기참조를 `var(--font-geist-sans)`로 교정 (미교정 시 `@apply font-sans`가 무효)
  - 검증: `lint` ✅ / `typecheck` ✅ / `test` ✅ 7건 / `build` ✅ + 빌드 CSS에 게임 토큰 반영 확인
- [x] **T1.3** 루트 레이아웃 · 라우트 그룹 · 앱 셸 — 완료
  - 루트 레이아웃: `ThemeProvider` + `Header` + `main` + `Footer`, 타이틀 템플릿(`%s | 덱바인더`)
  - **다크 모드 해소** — `next-themes`(`attribute="class"`, `defaultTheme="system"`) 도입으로 T1.2에서 끊겼던 `.dark` 토큰이 동작. `<html suppressHydrationWarning>` 필요
  - 라우트 그룹: `(content)` 좁은 단일 컬럼(max-w-3xl) / `(app)` 넓은 컨테이너(max-w-6xl)
  - `common/`: header · main-nav · mobile-nav · footer · theme-provider · theme-toggle · error-boundary
  - `src/lib/navigation.ts` — 데스크톱 · 모바일 내비가 공유하는 단일 정의
  - `app/error.tsx`(라우트 에러) + `common/error-boundary.tsx`(기능 단위 경계, 테스트 5건)
  - **플레이스홀더 페이지 4종** — `/cards` `/decks` `/binder` `/news`. 내비 목적지를 만들어 셸을 실제로 검증하기 위한 것으로, 각각 T1.7 · T2.4 · T3.3 · T1.9에서 대체된다
  - 검증: `lint` ✅ / `typecheck` ✅ / `test` ✅ 12건 / `build` ✅ 6라우트 정적 생성 / `test:e2e` ✅ 4건(내비 이동 · 타이틀 템플릿 · 다크 모드 토글 포함)
  - 미포함: **TanStack Query 프로바이더는 T1.7로 미룸** — 실제 사용처가 생길 때 도입해야 미사용 의존성이 남지 않는다
- [x] **T1.4** Supabase 연결 + 환경변수 검증 — 완료
  - `env.ts`(`parseEnv` 헬퍼 + 클라이언트 변수, 테스트 5건) / **`env.server.ts` 신설** — 시크릿을 `server-only`로 분리해 클라이언트 번들 유입을 빌드 단계에서 차단
  - `supabase/client.ts`(브라우저) · `server.ts`(RSC·핸들러, **`await cookies()`** §2.4) · `admin.ts`(service_role, RLS 우회 경고 주석)
  - `.env.example`(템플릿) + `.env.local`(gitignore 확인 완료) — 크롤러 변수는 T2.9에 주석 처리
  - Vitest에 더미 환경변수 주입 — `env.ts`가 모듈 로드 시 검증하므로 테스트에도 유효 값이 필요
  - 검증: `lint` ✅ / `typecheck` ✅ / `test` ✅ 18건 / `build` ✅ / `test:e2e` ✅ 4건
  - ⚠️ **실제 Supabase 자격증명 미입력 상태** — `.env.local`을 채우기 전까지 실제 연결은 검증되지 않았다. 첫 실연결 검증은 T1.5 마이그레이션에서 이뤄진다
- [x] **T1.5** 마이그레이션 001 — 완료 (로컬 리허설 후 원격 적용 · 검증)
  - `supabase/migrations/20260823000001_card_master.sql` — 테이블 6개 · 인덱스 9개 · RLS 정책 6개 · 트리거 2개 · 게임 룰 2행
  - `supabase init` + 원격 link(`rqduciqmfvkpvtezzfwu`, PG 17.6, ap-northeast-2), `db:reset` / `db:migrate` 스크립트 등록
  - 로컬 검증: search_vector 트리거(한국어 토큰화) · updated_at 트리거 · 복합 FK 게임 혼입 차단 · anon 읽기 허용 / 쓰기 거부 · service_role 쓰기 허용
  - 원격 검증: `games` 2행 조회 200 / `cards` 조회 200 / anon INSERT 42501 거부
  - ⚠️ **GRANT 누락 버그를 로컬 리허설에서 발견** — 아래 §4.1-1 참조
- [ ] **T1.5a** (권장) 로컬 스택 상시 사용 — Docker Desktop 설치 완료. 이후 모든 마이그레이션은 `npm run db:reset`으로 리허설한 뒤 `db:migrate`한다
- [x] **T1.5b** 마이그레이션 002 — 완료 (로컬 리허설 → 원격 적용 · 검증)
  - `20260823000002_fix_card_name_nullability.sql` — `name_ja` → `not null`, `name_ko` → nullable, `cards_name_ja_trgm_idx` 추가
  - 로컬 검증: `name_ko` 없이 INSERT 성공 / `name_ja` 없이 INSERT는 not-null 위반 / `name_ko`가 NULL이어도 search_vector 트리거 정상(`'ストライク':1A`)
  - 원격 검증: 동일 2건 (201 / `23502`), 마이그레이션 이력 local↔remote 동기화 확인
- [ ] **T1.6** `scripts/seed.ts` + 초기 카드 데이터 투입 — 원천은 §4.4에서 확정
  - [x] **T1.6a ptcg 일본어: 완료** — 세트 183개 · 카드 **12,619장** 적재 (실패 0건)
    - `scripts/seed.ts` + `src/lib/domain/ingest/tcgdex.ts`(순수 매퍼, 테스트 14건)
    - `--enrich-only [--card-type=X]` 모드 — 매핑 수정 시 전체 재수집 없이 대상만 재보강
    - 재실행 멱등성 확인 (2회 실행 후 총계 불변)
  - T1.6b ptcg 한국어: `pokemoncard.co.kr` 스크래핑 → 코드 매칭으로 `name_ko` 갱신
  - T1.6c opcg 일본어: `onepiece-cardgame.com` 스크래핑
  - T1.6d opcg 한국어: `onepiece-cardgame.kr` 스크래핑 (2024-03 이후 세트만 존재)
  - T1.6e 효과 키워드 자동 태깅 + 수동 보정
- [x] **T1.7** `GET /api/cards` + 도감 페이지 — 완료
  - `src/lib/validation/card.ts`(검색 파라미터 zod, 테스트 8건) · `app/api/cards/route.ts`(커서 페이지네이션, limit 상한 100)
  - TanStack Query 프로바이더 + nuqs 어댑터를 루트 레이아웃에 연결 (T1.3에서 이관한 항목)
  - `features/cards/`: card-browser · card-filter-panel · card-grid · use-card-search(무한스크롤)
  - 검증: `lint` `typecheck` `build` ✅ / `test` 40건 ✅ / `test:e2e` 9건 ✅ (도감 5건 신규 — 목록·검색·URL 복원·빈 결과·무한스크롤)
  - **미포함(후속)**: 레어도 · 속성 · 발매 팩 · 효과 키워드 필터 → **T1.7b**. PostgREST가 DISTINCT를 지원하지 않아 facets용 RPC/뷰가 선행 필요하다. 효과 키워드는 T1.6e 태깅 이후에나 의미가 있다
- [ ] **T1.7b** 필터 확장 — facets RPC(또는 뷰) + 레어도 · 속성 · 발매 팩 · 키워드 필터
- [ ] **T1.8** 카드 상세 + `base-price-badge` + `similar-cards`(대체 카드 그룹)
- [ ] **T1.9** 뉴스 모듈: 마이그레이션 + 목록 / 상세(ISR) + `sitemap.ts` / `robots.ts` + 개인정보처리방침 · 면책 페이지 (애드센스 심사 요건)

### Phase 2 — 핵심 유틸리티

- [ ] **T2.1** `src/lib/domain/simulator` TDD 구현 (shuffle / draw / mulligan / probability) — 손패 매수를 게임 룰로 주입받아 ptcg 7장 · opcg 5장을 모두 커버
- [ ] **T2.2** `src/lib/domain/deck` 검증 · 통계 TDD 구현 — ptcg 60장 / opcg 50장, 4장 제한(기본 에너지 예외), opcg 리더 색상 일치 검증
- [ ] **T2.3** 마이그레이션 002 — decks / deck_cards + RLS
- [ ] **T2.4** 덱 레시피 목록 · 티어표 · 상세 페이지
- [ ] **T2.5** 덱 빌더 UI (`deck-builder-store.ts`) + 첫 손패 드로우 · 멀리건 UI
- [ ] **T2.6** `workers/crawler` 스캐폴딩 (Hono + wrangler + vitest-pool-workers)
- [ ] **T2.7** 어댑터 3종 TDD 구현 (메르카리 · 라쿠마 · 야후옥션, 픽스처 기반)
- [ ] **T2.8** 마이그레이션 003 — market_sessions / card_prices
- [ ] **T2.9** `POST /api/market/session` (쿼터 + HMAC 토큰) + Durable Object 카운터
- [ ] **T2.10** `GET /api/market/stream/:id` SSE + 서버 페이싱 연출
- [ ] **T2.11** 매물 결과 UI (`progressive-loader` · `condition-filter` 3종 · `listing-list`) + 덱 상세에서 매물 검색 진입
- [ ] **T2.12** 기준가 파이프라인 (`src/lib/domain/pricing` + 수집 배치)

### Phase 3 — 개인화 및 고도화

- [ ] **T3.1** Google / Kakao OAuth + `auth/callback` + `profiles` 생성 트리거
- [ ] **T3.2** 마이그레이션 004 — collection_items / binder_shares + RLS + `v_public_binder` 뷰
- [ ] **T3.3** 가상 3공 바인더 UI (페이지 넘김 애니메이션) + 위시리스트
- [ ] **T3.4** 컬렉션 총 가치 계산 · 표시
- [ ] **T3.5** 공유 바인더 페이지 + 동적 OG 이미지 (`opengraph-image.tsx`)
- [ ] **T3.6** 제휴 링크 캐러셀 (`common/affiliate-carousel.tsx`)
- [ ] **T3.7** Playwright E2E 3종 시나리오 + GitHub Actions CI 연동

---

## 9. 결정이 필요한 사항 (Architect → 사용자)

1. ~~**초기 지원 TCG 범위**~~ → **확정: 포켓몬(`ptcg`) + 원피스(`opcg`) 2종, 유희왕 제외.** 상세 룰과 스키마 영향은 §4.0 참조.
2. ~~**카드 데이터 원천**~~ → **확정 (§4.4 실측)**: ptcg 일본어는 TCGdex(12,619장, 키 불필요), opcg 일본어는 공식 JP 사이트 스크래핑. **한국어는 두 게임 모두 공식 한국 사이트 스크래핑**으로만 확보 가능하며 커버리지가 부분적이다 → `name_ko` nullable 전환 필요(T1.5b).
3. **카드 이미지 호스팅** — 외부 핫링크 대신 Supabase Storage 또는 Cloudflare R2 캐싱 권장. ptcg는 `assets.tcgdex.net`에서 화질 지정 가능. **저작권 방침 확정 전까지 이미지 없이 동작하는 폴백을 유지한다** (§4.4).
4. **스크래핑 준수 범위** — 대상 3개 사이트의 이용약관 / `robots.txt` 검토 결과를 `docs/crawler-compliance.md`에 기록해야 한다. 차단 시 대체 전략(공식 API · 제휴)이 필요하다.
5. **비로그인 매물 검색 허용 여부** — 허용 시 IP 해시 쿼터만으로 방어해야 하며 우회 여지가 커진다. 로그인 필수면 방어력은 오르나 초기 유입이 줄어든다.
6. **환율 갱신 주기** — 기준가 KRW 환산 스냅샷 주기(일 1회 권장) 확정 필요.

---

## 10. 다음 단계

본 문서 승인 후 Developer 에이전트가 **Phase 1 / T1.1 ~ T1.4**부터 착수한다.
§9의 1번(초기 TCG 범위)은 T1.5 스키마 확정 전에 답이 필요하다.
