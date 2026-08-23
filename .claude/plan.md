# DeckBinder — 아키텍처 설계서 (plan.md)

> 작성: Architect Agent · 상위 기준 문서: `CLAUDE.md` > `AGENT.md` > `README.md`
> 본 문서는 Developer 에이전트가 구현 시 따르는 **디렉토리 구조 / 프레임워크 구성 / 데이터 모델 / API 계약**의 단일 기준(SSOT)이다.
> `CLAUDE.md`와 충돌하는 내용이 발견되면 `CLAUDE.md`가 우선하며, 본 문서를 갱신한다.

---

## 0. 개정 이력

| 버전 | 변경 |
|------|------|
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
| 프레임워크 | **Next.js 14+ (App Router)** — 신규 설치는 최신 안정판(15.x) 사용, App Router 전제 |
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

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "worker:dev": "npm --prefix workers/crawler run dev",
    "worker:deploy": "npm --prefix workers/crawler run deploy",
    "db:migrate": "supabase db push",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

> ⚠️ `CLAUDE.md`의 Commands 목록에는 `test`가 없으나 `AGENT.md`의 Verification 단계가 `npm run test`를 요구한다. **T1.1에서 `test` 스크립트를 반드시 추가**하고, 이후 `CLAUDE.md`의 Commands 절에도 반영을 권장한다.

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
├── tailwind.config.ts
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
│   │   ├── opening-hand.tsx              # 5장 드로우 표시
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
    ├── header.tsx  footer.tsx
    ├── affiliate-carousel.tsx            # 하단 제휴 마케팅 캐러셀
    ├── error-boundary.tsx
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
│   │   ├── draw.ts                       # 5장 드로우 · 멀리건
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
├── env.ts                                # zod 부팅 시 검증, 누락 시 즉시 실패
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

### 4.1 데이터 모델 (Supabase / PostgreSQL)

```
── 마스터 데이터 ─────────────────────────────
games              (id, code'ptcg|ygo|opcg', name_ko, name_ja)
card_sets          (id, game_id→games, code, name_ko, name_ja, released_at)
similar_groups     (id, game_id, name, role_note)   -- 대체 카드 그룹
cards              (id, game_id, set_id→card_sets, code,
                    name_ko, name_ja, name_en,
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
deck_cards         (deck_id→decks, card_id→cards, zone'main|extra|side', count)

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
- 한글 부분일치 보강: `pg_trgm` GIN 인덱스를 `cards.name_ko`에 추가.
- `cards(similar_group_id)` — 대체 카드 조회용.
- `card_keywords(keyword_id, card_id)` — 키워드 교차 필터용 역방향 인덱스.
- `market_sessions(ip_hash, requested_at DESC)`, `market_sessions(user_id, requested_at DESC)` — 쿼터 조회용.

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
| E2E | Playwright | 핵심 흐름 | ① 카드 검색 → 상세 → 매물 조회 연출 완주(8초 이상 소요 확인) ② 덱 빌더 → 5장 드로우 → 멀리건 ③ 로그인 → 컬렉션 추가 → 공유 링크 |

**Developer 규칙:** 각 태스크는 `실패하는 테스트 커밋` → `구현 커밋` 순서를 지킨다 (AGENT.md).

---

## 8. 구현 로드맵

### Phase 1 — 기반 구축

- [ ] **T1.1** 저장소 초기화: `git init`, `.gitignore`, `create-next-app`(App Router · TS strict · Tailwind), §2.3 npm scripts 등록, Vitest · Playwright 설정
- [ ] **T1.2** shadcn/ui 초기화 + 디자인 토큰 정의 (`src/components/ui`)
- [ ] **T1.3** 루트 레이아웃 · 라우트 그룹 `(content)` / `(app)` · `common/header.tsx` · `common/footer.tsx` · `error-boundary.tsx`
- [ ] **T1.4** Supabase 연결: `src/lib/supabase/{client,server,admin}.ts`, `src/lib/env.ts`(zod 검증), `.env.example`
- [ ] **T1.5** 마이그레이션 001 — games / card_sets / similar_groups / cards / keywords / card_keywords + 인덱스 + RLS
- [ ] **T1.6** `scripts/seed.ts` + 초기 카드 데이터 투입 (1개 게임 우선 — §9 결정 필요)
- [ ] **T1.7** `GET /api/cards` + 도감 페이지 (필터 패널 · nuqs URL 동기화 · 무한스크롤)
- [ ] **T1.8** 카드 상세 + `base-price-badge` + `similar-cards`(대체 카드 그룹)
- [ ] **T1.9** 뉴스 모듈: 마이그레이션 + 목록 / 상세(ISR) + `sitemap.ts` / `robots.ts` + 개인정보처리방침 · 면책 페이지 (애드센스 심사 요건)

### Phase 2 — 핵심 유틸리티

- [ ] **T2.1** `src/lib/domain/simulator` TDD 구현 (shuffle / draw / mulligan / probability)
- [ ] **T2.2** `src/lib/domain/deck` 검증 · 통계 TDD 구현
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

1. **초기 지원 TCG 범위** — 포켓몬 / 유희왕 / 원피스를 동시에 열면 카드 DB 구축 비용이 3배가 되고, 게임별 덱 룰(매수 제한 · 엑스트라 / 사이드 존)이 달라 `deck_cards.zone`과 검증 로직이 복잡해진다. **Phase 1은 1개 게임 우선을 권장.** T1.5 스키마 확정 전에 답이 필요하다.
2. **카드 데이터 원천** — 공개 API 활용 가능 여부에 따라 T1.6의 난이도가 크게 달라진다. 수동 구축 시 이미지 저작권 처리 방침이 필요하다.
3. **카드 이미지 호스팅** — 외부 핫링크 대신 Supabase Storage 또는 Cloudflare R2 캐싱 권장.
4. **스크래핑 준수 범위** — 대상 3개 사이트의 이용약관 / `robots.txt` 검토 결과를 `docs/crawler-compliance.md`에 기록해야 한다. 차단 시 대체 전략(공식 API · 제휴)이 필요하다.
5. **비로그인 매물 검색 허용 여부** — 허용 시 IP 해시 쿼터만으로 방어해야 하며 우회 여지가 커진다. 로그인 필수면 방어력은 오르나 초기 유입이 줄어든다.
6. **환율 갱신 주기** — 기준가 KRW 환산 스냅샷 주기(일 1회 권장) 확정 필요.

---

## 10. 다음 단계

본 문서 승인 후 Developer 에이전트가 **Phase 1 / T1.1 ~ T1.4**부터 착수한다.
§9의 1번(초기 TCG 범위)은 T1.5 스키마 확정 전에 답이 필요하다.
