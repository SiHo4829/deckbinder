# DeckBinder — 아키텍처 설계서 (plan.md)

> 상위 기준: `CLAUDE.md` > `AGENT.md` > `README.md`. 충돌하면 `CLAUDE.md`가 이기고 본 문서를 갱신한다.
> 본 문서는 **디렉토리 구조 / 프레임워크 구성 / 데이터 모델 / API 계약**의 단일 기준(SSOT)이다.
>
> 🚨 **§ 번호는 목차가 아니라 주소다.** 코드 · 마이그레이션 · 설정 **506곳**이 `plan §4.8 ⓔ` 형태로 이 번호를 인용한다. **번호를 다시 매기지 않는다.** 하위 앵커도 같다 — `§0.1 ⓐ~ⓗ` · `§1 P1~P6` · `§2.8-1~6` · `§4.1-1`.
> 🚨 **완료 항목은 한 줄로 적는다. 이력은 `.claude/plan-archive.md`와 git log에 있다.** 2026-09-03 이전 전문(폐기된 시세 축 설계 포함)이 archive에 그대로 있다.

**목차** — ① Project Context ② Current Goal ③ Pending Tasks ④ Completed ⑤ Notes / Known Issues

---

# 1. Project Context

## 1.1 설계 원칙 (§1)

| # | 원칙 | 근거 |
|---|------|------|
| P1 | **읽기 중심, 쓰기 최소. RSC 기본.** SEO를 확보하는 것은 **서버 렌더**이지 ISR이 아니다. 렌더 모드는 라우트마다 **"관리자 쓰기 직후 정확해야 하는가"** 하나로 가른다: 그렇다면 **동적(SSR)**, 아니라면 ISR | CLAUDE.md · §2.7 · T1.12-7 |
| P2 | **스크래핑은 앱 서버에서 분리** — 외부 사이트 접근은 Cloudflare Workers에서만. Next.js는 대상 사이트에 직접 접근하지 않는다. ★ **주어는 앱 런타임이다. 개발자 머신에서 손으로 돌리는 일회성 적재 스크립트는 대상이 아니다**(§4.8 ⓑ) | CLAUDE.md: Proxy/Scraper |
| P3 | **외부 원천에 대한 부하 규율은 서버 계약으로 강제한다** — 직렬 · 동시성 1 · 요청 상한 · N회 실패 중단은 프론트 제약이 아니라 스크립트와 워커가 코드로 지킨다 | CLAUDE.md: Crawler Restrictions |
| P4 | **도메인 로직은 프레임워크에서 분리** — 시뮬레이터 · 확률 · 희귀도 점수는 `src/lib/domain`의 순수 함수로 두어 TDD가 쉬운 형태로 만든다 | AGENT.md: TDD 우선 |
| P5 | **웹 ↔ 워커 계약은 zod 스키마 공유** — 두 런타임이 `src/lib/validation`의 동일 스키마를 import 하여 계약 드리프트를 차단한다 | CLAUDE.md: strict typing |
| P6 | **컬렉션의 가치는 자체 수집 점수로만 표현한다.** 🚨 **화폐 단위 표기와 시계열 그래프를 만들지 않는다.** 앞은 폐기된 시세 축을 화면이 몰래 되살리는 것이고, 뒤는 없는 히스토리가 있는 것처럼 보이게 하는 것이다 | CLAUDE.md: Collection Score · §4.13 ⓖ |

> **P1의 "동적이면 SSR"이 SEO를 깎지 않는다.** 봇은 어느 쪽이든 완성된 HTML을 받는다. 동적으로 돌려 잃는 것은 **캐시 히트와 DB 왕복 비용**뿐이고, 트래픽이 0에 가까운 지금 그 값은 0이다. 얻는 것은 **정확성**이다.
>
> **되돌릴 조건 — 트래픽이 생겨 DB 왕복 비용이 실제로 측정되는 시점.** ISR로 되돌리려면 셋 중 하나가 성립해야 한다: ⓐ `revalidateTag`가 fetch Data Cache에 닿는지 재실측(§2.7 — 현 버전에서는 닿지 않는다) ⓑ 관리자 쓰기를 Server Actions로 옮긴다 ⓒ Supabase 조회를 `fetch` 직호출로 바꾼다. **셋 다 확인하지 않은 채 세그먼트 `revalidate`를 다시 붙이지 않는다** — 그것이 T1.12-7 사고의 재발 경로다.

## 1.2 기술 스택 (§2.1 · §2.2)

**§2.1 — CLAUDE.md 확정 (변경 불가)**

| 영역 | 선택 |
|------|------|
| 패키지 매니저 | **npm** |
| 프레임워크 | **Next.js 16.3.2 (App Router)** + React 19.2.8 — 파괴적 변경은 §2.4 |
| 언어 | **TypeScript (strict 필수)** |
| 스타일 | **Tailwind CSS + shadcn/ui** |
| 클라이언트 상태 | **Zustand** |
| 서버 상태 | **TanStack Query** |
| DB/인증 | **Supabase (PostgreSQL, RLS 활성화)** |
| 프록시/스크래퍼 | **Cloudflare Workers** |

**§2.2 — 본 설계서 추가 확정**

| 영역 | 선택 | 사유 |
|------|------|------|
| 검증 스키마 | **zod** | 웹 ↔ 워커 계약 공유, react-hook-form 연동 |
| 폼 | **react-hook-form** | zod resolver 연계 |
| 단위/통합 테스트 | **Vitest + Testing Library + MSW** | AGENT.md TDD 파이프라인 필수 |
| E2E | **Playwright** | |
| 애니메이션 | **Framer Motion** | 3공 바인더 페이지 넘김 |
| 워커 라우팅 | **Hono** | Workers 네이티브 경량 라우터 |
| 워커 파싱 | **HTMLRewriter** (1순위) / `node-html-parser` (폴백) | 스트리밍 파싱이 CPU 예산에 유리 |
| 워커 쿼터 | **Durable Object** | 레이트리밋 카운터의 강한 일관성 (§3.5) |
| URL 상태 | **nuqs** | 카드 필터의 URL 동기화(공유 · SEO) |

## 1.3 npm scripts (§2.3)

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",                             // Next 16에서 `next lint` 제거됨
    "typecheck": "next typegen && tsc --noEmit",  // typegen 산출물이 .next/(gitignore)라 선행 필요
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:reset": "supabase db reset",              // 로컬 리허설 (Docker 필요)
    "db:migrate": "supabase db push",             // 원격 적용
    "db:types": "supabase gen types typescript …",// 스키마 변경 후 필수

    // 카탈로그 적재 파이프라인 (§4.8 ⓒ). db: 접두사를 쓰지 않는다 — db:*는 스키마·백업 유틸이고 이쪽은 적재다.
    "catalog:collect": "tsx --env-file=.env.local scripts/collect-catalog.ts",
    "catalog:import":  "tsx --env-file=.env.local scripts/import-catalog.ts",

    // 이미지 파이프라인. 자체 호스팅(§9.4 ⓕ)이 폐기되고 리버스 프록시(ⓖ)로 갔다.
    "images:collect": "tsx --env-file=.env.local scripts/collect-images.ts",
    // ↑ ✅ 살아 있다. 되돌릴 갈래(§9.4 ⓖ-9)와 나머지 39세트 수집이 그대로 쓴다.
    // "images:upload" — ❌ 만들지 않는다. T1.22 폐기(§9.4 ⓖ-1).
    // 🚨 images:purge — ⏸ 자체 호스팅 갈래 전용 · 현재 미사용. 프록시의 회수는 **킬 스위치**다(§9.4 ⓖ-4 · §3.5).
    //    코드와 테스트 30건을 지우지 않는 근거는 §9.4 ⓖ-9.
    "images:purge":   "tsx --env-file=.env.local scripts/purge-images.ts"
  }
}
```

- ★ **워커는 이 표에 없다.** `workers/image-proxy/`는 **별도 `package.json`**을 갖고(§3.5) 배포는 `wrangler`가 한다 — 루트 스크립트에 섞지 않는다.
- 마이그레이션은 **항상 `db:reset`으로 로컬 리허설 후 `db:migrate`** 한다. §4.1-1의 GRANT 누락은 이 리허설에서 잡혔다.

## 1.4 Next.js 16 파괴적 변경 (§2.4 — Developer 필독)

설치된 Next 16은 학습 데이터의 App Router 관례와 다르다. **Next 관련 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 가이드를 확인한다.**

| 변경 | 대응 |
|------|------|
| **`params` / `searchParams` 비동기화** — 동기 접근 완전 제거 | `const { cardId } = await props.params` |
| **`cookies()` / `headers()` / `draftMode()` 비동기화** | `const cookieStore = await cookies()` |
| **타입 헬퍼 생성** — `PageProps<'/cards/[cardId]'>` 등 | `next typegen`. `npm run typecheck`에 포함됨 |
| **`middleware.ts` → `proxy.ts`** — 함수명도 `proxy`, edge 런타임 미지원(nodejs 고정) | 파일명 · export명 모두 `proxy` |
| **`next lint` 제거** | `eslint` 직접 실행 |
| **`images.domains` 폐기** → `remotePatterns` | `next.config.ts` |
| **Turbopack 기본 활성** | 조치 없음 |

- `next dev`가 `CLAUDE.md` 하단에 `<!-- BEGIN:nextjs-agent-rules -->` 블록을 자동 추가한다. 제거해도 재생성되므로 커밋에 포함한다.
- **dev 서버는 디렉토리당 1개다.** 좀비 프로세스가 남으면 `test:e2e`가 `webServer was not able to start`로 실패한다. PID는 `.next/dev/logs/next-development.log`에 있고 `taskkill /PID <pid> /F`로 정리한다.

## 1.5 툴체인 (§2.5)

**현재 환경 — Node `v24.19.0` · npm `11.17.0` · `wrangler 4.127.1`** (2026-09-01 v20.15.1에서 올렸다. 깨진 것 0건).

⚠️ **`winget` 패키지 ID는 `OpenJS.NodeJS.LTS` 하나뿐이고 그것은 LTS 라인을 따라간다** — 26이 LTS가 되면 이 ID로 26에 간다. 버전을 고정하려면 이 ID를 쓰지 않는다.

⏸ **하향 고정 4개를 아직 되돌리지 않았다 — 일부러다.** 툴체인 업그레이드와 워커 배포를 한 커밋에 섞지 않기 위해서다. **별도 태스크로 §3.6에 있다.**

| 패키지 | 고정 | 원래 하향 사유 (Node 20 시절) |
|--------|------|-----------|
| `vitest` | `^3.2.7` | v4는 rolldown → Node 20.19+ 필요 |
| `@vitejs/plugin-react` | `^4` | v6는 vite@8(rolldown)을 끌어옴 |
| `vite-tsconfig-paths` | `^5` | 동일 |
| `jsdom` | `^26` | v30은 `require(esm)` 사용 |

## 1.6 shadcn/ui 설정 (§2.6)

| 항목 | 값 | 사유 |
|------|-----|------|
| base (primitive) | **`radix`** | CLI 기본값은 `base`(Base UI)로 바뀌었으나 Radix가 성숙도·레퍼런스 우위 |
| preset | **`nova`** (Lucide + Geist) | 스캐폴드가 이미 Geist를 쓴다 |
| baseColor | `neutral` | 카드 이미지가 주인공이므로 채도 낮은 중립 배경 |
| cssVariables | `true` | 토큰 기반 테마 |

**alias 2개를 CLI 기본값에서 수정했다** — 기본값이면 `src/` 4구획 규칙과 §3.3을 위반한다.

| alias | CLI 기본 | 수정값 | 사유 |
|-------|---------|--------|------|
| `hooks` | `@/hooks` | **`@/lib/hooks`** | `src/hooks`는 4구획 밖 |
| `utils` | `@/lib/utils` | **`@/lib/utils/cn`** | §3.3이 `utils/`를 디렉토리로 정의. 파일과 디렉토리 공존 시 import 해석이 모호 |

**프로젝트 토큰은 `globals.css` 최하단의 별도 블록에 둔다** — shadcn 생성 영역과 분리해야 재초기화 시 유실되지 않는다. 현재: `--color-game-ptcg` / `--color-game-opcg` (+ `-foreground`).

> **수집 점수 전용 의미색을 만들지 않는다.** 점수에 의미색(높으면 녹색 등)을 부여하면 P6의 「가치를 등락으로 표현하지 않는다」와 충돌한다. 점수는 `foreground` / `primary`로 표기한다.

## 1.7 실행 환경에서 확인된 제약 (§2.7 — Developer 필독)

문서만 봐서는 알 수 없고 실제로 부딪혀 알아낸 것들이다. **모두 「조용히 잘못 동작」하는 유형이라 다시 밟기 쉽다.**

| # | 제약 | 대응 |
|---|------|------|
| 1 | **PostgREST 행 상한** — `limit=100000`을 보내도 서버 설정(기본 **1000**)에서 **에러 없이** 잘린다. 대조·집계가 조용히 틀린다 | 1000행을 넘길 수 있는 조회는 `Range` 헤더로 페이지네이션 |
| 2 | **Supabase 클라이언트 런타임** — 순수 Node에서 `createClient`가 네이티브 WebSocket 부재로 즉시 실패. Next 런타임은 undici를 번들해 정상 | 앱은 `@/lib/supabase/*` 그대로. **독립 실행 스크립트는 PostgREST를 직접 호출**한다 |
| 3 | **일본어 전문검색** — `simple` 사전은 공백으로 토큰을 나눈다. 일본어는 공백이 없어 카드명 전체가 토큰 1개가 되고 부분일치가 전혀 안 된다 | 검색은 `search_vector`가 아니라 **`ilike` + `pg_trgm`**. `name_ja`/`name_ko`를 `or`로 묶는다 |
| 4 | **`cookies()` → 강제 동적 렌더링** — 이를 쓰는 세그먼트는 정적 생성·ISR이 성립하지 않고 `revalidate`가 무시된다 | 공개 읽기(뉴스·카드 상세·sitemap)는 쿠키를 안 읽는 `createSupabaseAnonClient()`(`src/lib/supabase/public.ts`). anon 키라 RLS는 그대로 적용 |
| 5 | **동적 라우트의 기본은 Dynamic** — `generateStaticParams`가 없으면 요청마다 렌더된다(빌드 출력의 `ƒ`) | 전부 생성하고 싶지 않으면 **빈 배열을 반환**한다 |
| 6 | **DB 타입 미생성** — Supabase가 임베드 관계를 배열로 추론하지만 런타임은 객체다. 컬럼 아닌 필드를 insert/update에 넘겨도 안 잡힌다 | `npm run db:types`. **스키마를 바꾸면 다시 생성한다** |
| 7 | **nuqs 배열 직렬화** — 쉼표로 직렬화한다(`keywords=a,b`). 반복 키로 보내면 첫 값만 읽어 **필터가 조용히 일부만 적용**된다 | 키워드 코드를 `^[a-z0-9_]+$`로 제한해 쉼표가 값에 못 들어가게 막았다. 서버 파서는 두 형식 다 받는다 |
| 8 | **`useSearchParams` + 정적 프리렌더** — Suspense 경계가 없으면 `next build`가 실패한다. **dev와 E2E는 통과**해서 빌드까지 안 돌리면 놓친다 | nuqs를 쓰는 컴포넌트를 `<Suspense>`로 감싼다 |
| 9 | ★ **커서 키 ≠ 유니크 키** — `cards`의 유니크는 `(game_id, code)`인데 커서를 `code` 하나로 잡으면 두 게임에 같은 코드가 있을 때 **카드 한 장이 조용히 사라진다** | 커서는 **유니크 제약과 같은 폭**이어야 한다. `(code, id)` 튜플로 정렬·비교 (007) |
| 10 | **`generateMetadata` + 본문의 중복 조회** — 둘이 같은 조회를 각각 한 번씩. `fetch` 기본이 캐시 안 함이라 **DB 왕복이 2배**인데 화면은 멀쩡하다 | 조회 함수를 React `cache()`로 감싼다 |
| 11 | **eslint flat config는 `.gitignore`를 안 본다** — `supabase/.temp/`를 스캔해 남의 번들에서 오류 수백 개 | `eslint.config.mjs`의 `globalIgnores`에 명시 |
| 12 | **PostgREST `.or()` 문자열 필터** — 조건을 문자열로 이어 붙이는 API다. 사용자 입력의 **쉼표·괄호**가 그대로 들어가면 필터 문법이 깨지고, 운이 나쁘면 **조용히 다른 뜻으로 파싱된다** | 조립 전에 `q`에서 `[,()]`를 제거하거나 이스케이프 |
| 13 | **`server-only` + jsdom 단위 테스트** — vitest는 `environment: "jsdom"`이라 `react-server` 조건이 안 걸려 `src/lib/admin/**` import 순간 터진다 | `vitest.config.mts`의 `resolve.alias`로 `server-only`를 빈 모듈에 매핑. **이 alias가 없으면 `src/lib/admin/**`은 단위 테스트 자체가 불가능** |
| 14 | **로그인 화면에서 시작되는 비로그인 프리페치** — 프로덕션 빌드가 `<Link href="/admin">`을 비로그인 상태로 프리페치해 리다이렉트 결과가 라우터 캐시에 남고, 로그인 성공 후 `router.push`가 **다시 로그인 화면으로 튕긴다.** dev는 프리페치를 안 해 안 드러난다 | 인증 성공 후 `router.refresh()`로 캐시를 **먼저 버린 뒤** 이동. **인증 상태로 결과가 갈리는 흐름은 프로덕션 빌드로 확인한다** |
| 15 | **E2E 단언 타임아웃 < 콜드 라우트** — 클릭 후 이동 단언은 내비게이션 30초가 아니라 **expect 타임아웃(기본 5초)**을 쓴다. 실행마다 "그때 처음 열린 라우트"가 깨져 증상이 산발적이다 | `tests/e2e/global-setup.ts`가 상세 라우트까지 워밍업하고 `expect.timeout`을 15초로 올렸다 |
| 16 | ★ **ISR 상세 라우트에 `loading.tsx`를 두면 `notFound()`가 소프트 404가 된다** — Suspense 경계가 스트리밍을 만들고 스트리밍은 200으로 시작하므로 상태 코드를 못 바꾼다 | **`/cards/[cardId]` · `/news/[slug]`에 `loading.tsx`를 두지 않는다.** A/B/A로 실측 확인. ⚠️ **`proxy.ts`에서 존재 여부를 미리 조회해 우회하지 말 것** — T1.12에서 한 번 갔다가 되돌렸다 |
| 17 | ★★ **세그먼트 `revalidate`가 supabase-js의 fetch까지 Data Cache에 넣고, `revalidatePath`는 그것을 못 지운다** — 무효화가 정상이고 라우트 캐시도 비워지는데 **화면만 낡는다** | **정확성이 필요한 라우트는 세그먼트를 동적으로 선언한다**(T1.12-7). 진단: ⓐ `x-nextjs-cache`가 `MISS`인데 내용이 낡았다면 범인은 데이터 캐시다 ⓑ `.next/cache/fetch-cache` 항목이 `tags: []`인가 |
| 18 | ★★ **`revalidateTag`는 이 Next 버전에서 fetch Data Cache에 닿지 않는다 — 문서 안내대로 해도 안 된다** | 🚨 **태그 기반 무효화를 이 스택에서 다시 설계하지 않는다.** 문서를 읽고 그대로 구현한 뒤 실측해야 알 수 있는 유형이라 **다음 사람이 같은 문서를 읽고 같은 설계를 다시 한다.** 우회로도 전부 대가가 있다(`no-store`는 라우트를 동적으로 떨어뜨리고, `next.revalidate:1`은 세그먼트 수명을 1초로 덮는다) |
| 19 | **data-only 덤프 복원은 마이그레이션이 심은 참조 데이터와 반드시 충돌한다** — 001이 `games` 행을 심는데 `--data-only` 덤프에도 같은 행이 있다. 즉 **구조상 반드시 겹친다** | 🚨 **`ON_ERROR_STOP=1`을 쓰지 않는다.** psql 기본값은 그 문만 건너뛰어 결과가 옳지만, 이 옵션이면 첫 문에서 전체 복원이 중단된다. **모르면 「백업이 복원되지 않는다」고 오판한다** — 백업은 멀쩡하다 |
| 20 | ★ **RLS의 `now()`는 DB 시계, 앱이 찍는 `published_at`은 앱 서버 시계다** — 그 차이만큼 「안 보이는 창」이 생긴다(실측 0.4~0.9초). **사람 손으로는 재현되지 않고 E2E만 걸린다.** ⚠️ 증상이 캐시 문제와 구별되지 않는다 | ⭐ **일반 규칙 — 시간 조건 RLS(`<= now()`)를 쓰는 곳은 앱이 찍는 시각에 반드시 마진을 준다**(`now - 5초`, `src/lib/news/publish.ts`). 진단 2단: ⓐ 캐시가 없는 동적 라우트에서도 재현되면 캐시가 아니다 ⓑ `published_at`과 `created_at`을 나란히 찍는다. **「정확히 앱 시계를 찍는다」를 단언하는 테스트를 쓰지 않는다** — 그 테스트가 이 버그를 다시 불러들인다 |

## 1.8 비주얼 언어 (§2.8)

목표는 **"돈 내고 쓰는 서비스처럼 보이는 것"**이 아니라 **믿고 볼 수 있어 보이는 것**이다. 카드 일러스트가 화면에서 유일하게 채도가 높은 요소이고 UI는 무채색으로 물러선다.

**토큰 3** — `--surface`(한 단계 눌린 바탕) · `--surface-raised`(카드 타일 바탕 — 로드 전 깜빡임 방지) · `--hairline`(구분선, `border`보다 옅게)

**유틸 3** — `.aspect-card`(**`63 / 88` 실물 TCG 비율**. 이미지 유무와 무관하게 그리드 높이가 흔들리지 않는다) · `.card-placeholder`(격자 패턴 + `code`) · `.eyebrow`(제목 위 소형 라벨)

**규칙** — 🚨 번호를 바꾸지 않는다. `§2.8-2` · `§2.8-3` · `§2.8-6`이 인용된다.

1. **차트 금지** (CLAUDE.md · P6). 값은 배지 하나. **산출 불가일 때도 배지 자리를 비우지 않고 "산출 불가"로 채워** *값이 없는 것*과 *기능이 없는 것*을 구분한다
2. **레어도 배지는 `bg-foreground/85` + `text-background`.** 반투명 배경은 밝은 일러스트 위에서 안 읽힌다
3. **미완성 화면에 "준비 중"만 두지 않는다.** `ComingSoon`으로 무엇을 만드는지 3개 항목으로 보이고 지금 쓸 수 있는 곳(도감)으로 보낸다. **근거는 사용자 이탈이다**
4. **호버는 그림자와 1.03 스케일까지.** 카드가 튀어오르면 목록을 훑기 어렵다
5. **대체 카드는 텍스트 목록이 아니라 썸네일이다** — 어느 일러스트인지가 선택 기준이다
6. ★★ **이미지가 없거나 로드에 실패한 카드는 "빈 상태"가 아니라 카드로 보인다.** 폴백은 **카드명 · 속성 · `code`**가 든 프레임이고 `.aspect-card`를 그대로 쓴다. 🚨 **이 규칙은 시각 품질이 아니라 「방어 코드」다**(§9.4 ⓑ) — 한 장이 깨졌을 때가 아니라 **전부 깨졌을 때 서비스가 성립해야 한다**. **URL 부재와 로드 실패는 같은 화면이다.**
   - **원본 일러스트를 흉내 내는 요소를 넣지 않는다.** 틀·색은 우리 토큰으로만
   - **게임 색 토큰(`--color-game-*`)을 쓰지 않는다** — `CardListItem`에 `game_id`가 없어 조회 폭을 넓혀야 한다
   - **속성은 자유 텍스트다. 매핑에 없는 값과 null은 아이콘 없이 이름만 보인다** — 물음표 아이콘을 만들지 않는다

## 1.9 디렉토리 구조 (§3)

`CLAUDE.md`가 `src/` 하위를 `app` / `components` / `lib` / `types` **4구획으로 고정**했다 — 이 4개 외의 최상위 구획을 `src/` 안에 만들지 않는다. Zustand 스토어와 순수 도메인 로직은 `src/lib` 하위에 둔다. Cloudflare Worker는 Next 빌드 대상이 아니므로 `src/` 밖의 `workers/`에 둔다.

> ⚠️ **아래 트리는 "목표 구조"이고 아직 없는 파일이 섞여 있다.** 없는 것에는 `(T2.x)`로 만드는 태스크를 달았다. **트리에 있다는 이유로 "이미 있다"고 읽지 않는다** — 확인은 파일을 여는 것이 가장 싸다.

```
deckbinder/
├── .claude/
│   ├── agents/{architect,designer,developer,reviewer}.md
│   ├── plan.md                     # 본 문서
│   └── plan-archive.md             # 2026-09-03 이전 전문 (이력)
├── docs/
│   ├── adr/                        # 아키텍처 결정 기록
│   └── crawler-compliance.md       # 스크래핑 대상별 준수 사항
├── src/{app,components,lib,types}/ · proxy.ts
├── supabase/{migrations,seed}/ · config.toml
├── tests/e2e/                      # Playwright + global-setup.ts (§7). 단위는 소스 옆 *.test.ts
├── workers/
│   └── image-proxy/                # (T1.30) 카드 이미지 리버스 프록시 — §3.5
│                                   # 🚨 별도 프로젝트다. 자체 package.json · wrangler가 배포한다
├── AGENT.md · CLAUDE.md · README.md
├── next.config.ts · components.json · tsconfig.json · package.json
```

### §3.1 `src/app` — 라우팅

라우트 그룹으로 **콘텐츠(SEO) 영역**과 **앱(유틸리티) 영역**의 레이아웃을 분리한다.

```
src/app/
├── layout.tsx · page.tsx · error.tsx
├── (content)/                            # ── SEO 대상
│   ├── news/page.tsx · news/[slug]/page.tsx
│   ├── privacy/page.tsx                  # 유지 — 근거는 로그인·개인정보
│   └── disclaimer/page.tsx
├── (app)/                                # ── 유틸리티 (사이드바/필터)
│   ├── cards/page.tsx                    # 도감 · 스마트 검색
│   ├── cards/[cardId]/page.tsx           # 상세 · 희귀도 점수 · 대체 카드
│   ├── sets/[setId]/page.tsx             # ★ (T2.13 — 아직 없다) 60장/페이지 오프셋. **uuid다**(§4.9 ⓑ)
│   ├── decks/page.tsx · [deckId]/page.tsx · builder/page.tsx   # (T2.4 · T2.5)
│   └── binder/page.tsx · [slug]/page.tsx                       # (T3.3 · T3.5)
├── admin/                                # ── 색인 제외, proxy.ts가 보호
│   ├── login/page.tsx · page.tsx
│   ├── sets/ · keywords/ · cards/ · news/   # 각각 목록 · new · [id] 3종
├── auth/login/page.tsx · callback/route.ts  # (T3.1)
├── api/                                  # Route Handlers (§5.1)
│   ├── cards/route.ts · [cardId]/route.ts · [cardId]/alternatives/route.ts
│   ├── decks/ · collection/ · binder/    # (T2.3 · T3.2 · T3.5)
│   └── admin/                            # 전 라우트 requireAdmin() 통과 후 service_role
│       ├── session/ · sets/ · keywords/ · news/ · cards/
├── opengraph-image.tsx · sitemap.ts · robots.ts
```

### §3.2 `src/components` — UI

```
src/components/
├── ui/                                   # shadcn 원시 (수정 최소, 소스 복사)
├── features/
│   ├── cards/
│   │   ├── card-browser.tsx · card-grid.tsx · card-filter-panel.tsx · keyword-filter.tsx
│   │   ├── card-image.tsx                # 카드 1장 이미지 — 4곳 공용 (T1.11 통합)
│   │   │                                 #   ★ T1.23: referrerPolicy 제거 — 브라우저가 원천에 안 닿는다
│   │   │                                 #   URL 부재 · onError → 폴백 프레임 = 방어 코드 (같은 화면, §2.8-6)
│   │   │                                 #   🚨 폴백은 킬 스위치의 착지점이다 (§9.4 ⓖ-4)
│   │   │                                 #   next/image를 쓰지 않는다 (§9.4 ⓖ-6)
│   │   ├── similar-cards.tsx             # 대체 카드 썸네일 그리드. ★ T2.13이 건드리지 않는다 (§4.9 ⓐ)
│   │   ├── set-cards-preview.tsx         # ★ (T2.13) 같은 세트 앞 12장 + 전체 보기 (§4.9 ⓓ)
│   │   ├── set-card-page.tsx             # ★ (T2.13) /sets/[setId] 본문 — Pagination 재사용
│   │   └── use-card-search.ts
│   ├── achievement/                      # ★ (T2.15 · T2.16-B — 아직 없다) 계약은 §4.13 ⓖ
│   │                                     #   🚨 화폐 단위 0건 · 그래프 0개 · 정렬 옵션 0개
│   ├── decks/ · simulator/               # (T2.4 · T2.5) 로직은 §4.7의 도메인에 있다
│   ├── collection/                       # (T3.3~T3.5) binder-view · wishlist-panel · share-binder-dialog
│   ├── news/                             # news-list · news-article · markdown(raw HTML 미허용)
│   └── admin/                            # field · use-admin-form · *-form · admin-delete-button
└── common/
    ├── header.tsx · main-nav.tsx · mobile-nav.tsx · footer.tsx
    ├── theme-provider.tsx · theme-toggle.tsx
    ├── pagination.tsx · error-boundary.tsx · coming-soon.tsx · empty-state.tsx
    └── ad-slot.tsx                       # 미사용. 제거 예정: 백로그 E-2 (§9.1)
```

### §3.3 `src/lib` — 로직

```
src/lib/
├── admin/                                # session · guard(requireAdmin) · responses · queries (service_role)
├── supabase/                             # client(anon) · server(쿠키) · admin(service_role, server-only) · public(anon)
├── cards/
│   ├── queries.ts                        # 공개 화면용. 🚨 관리자 조회와 합치지 않는다 (규칙 6)
│   ├── image-src.ts                      # ★ (T1.31) source_image_url → 프록시 URL. 순수 · I/O 0건
│   │                                     #   🚨 catalog/에 두지 않는다 — 그쪽은 jsdom·sharp가 사는 자리다
│   │                                     #   ⚠️ eslint 차단 글롭은 src/app/** 하나라 여기는 안 잡힌다 → 사람이 지킨다
│   └── revalidate.ts
├── news/                                 # queries · revalidate · publish.ts(published_at = now-5초, §2.7-20)
├── home/queries.ts · seo/{queries,sitemap}.ts
├── domain/                               # ★ React·Next·Supabase·카드 DB 타입 import 금지 (§4.7 ⓓ)
│   ├── rules.ts                          # 구조 룰 표 + composeGameRules — §4.7 ⓑ
│   ├── simulator/{shuffle,draw,probability}.ts
│   ├── deck/{validate,stats}.ts
│   └── achievement/                      # ★ 성취 3축 (T2.14 · T2.16) — 계약은 §4.13
│       ├── rarity-score.ts               #   순수 · 우리 DB 컬럼만 · 모르면 null
│       └── completion.ts                 #   🚨 localStorage를 모른다
├── collection/                           # ★ (T2.16) 🚨 domain/과 다른 자리다
│   └── owned-store.ts                    #   OwnedCardStore 어댑터. **여기만 localStorage를 안다** (§4.13 ⓒ)
├── catalog/                              # 수집·임포트 판단 (§4.8 ⓒ · §4.11 ⓑ)
│   ├── parse · pace · manifest · series · images · types
│   └── normalize · plan · report · gate   # 임포터 순수 함수 넷 (§4.11 ⓒ)
├── validation/                           # ★ 워커와 공유 — next/* import 금지
│   ├── card.ts · admin.ts · catalog.ts
│   └── card-image.ts                     # ★ (T1.29) downname 3형식 · decideHost · checkFinalHost
│                                         #   · hostOf · sniffImageFormat
│                                         #   🚨 워커와 앱이 **같은 규칙**을 쓰는 자리 (§3.5)
├── query/{provider,keys}.ts · stores/ · hooks/ · navigation.ts
├── env.ts (NEXT_PUBLIC_*) · env.server.ts (server-only 시크릿)
└── utils/{cn,form,date}.ts
```

**모듈 규칙 (Reviewer 검증 항목)**

1. `src/app/**`은 얇게 — 라우팅 · 데이터 페칭 · 조립만. UI 구현은 `src/components/features/**`에
2. `src/lib/domain/**`과 `src/lib/validation/**`은 React · Next · Supabase를 import 하지 않는다(워커에서도 import되므로). **도메인은 하나 더 — 카드 DB 타입(`@/types/database` · `@/types/card`)도 금지**(§4.7 ⓓ). `no-restricted-imports`가 `npm run lint`로 잡는다. ⚠️ **차단 목록은 손으로 유지된다** — 새 프레임워크 패키지를 도입하면 함께 넣어야 하고, 안 넣으면 규칙이 조용히 비어 간다
3. `src/components/features/*` 간 직접 import 금지. 교차가 필요하면 `src/lib/domain` 또는 상위 라우트에서 조립
4. `src/lib/supabase/admin.ts`는 `import 'server-only'`를 선언하며, 이 파일 외에서 `service_role` 키를 참조하지 않는다
5. `NEXT_PUBLIC_` 접두사는 공개해도 무방한 값에만
6. **관리자 조회는 `src/lib/admin/queries.ts`에만 둔다.** `src/lib/cards/queries.ts`는 anon이고 키워드를 표시용(`{code,label}`)으로 되돌리므로 `keyword_id`가 필요한 관리자 폼에 **재사용할 수 없다.** 형태가 비슷해 보여도 두 계층을 합치지 않는다

### §3.5 `workers/image-proxy` — 카드 이미지 리버스 프록시

> **이 절은 계약이다.** *왜*는 §9.4 ⓖ에 있고 여기는 *무엇을*이다. 어긋나면 §9.4 ⓖ가 우선한다.
> **별도 프로젝트다** — 자체 `package.json`, 배포는 `wrangler`. 공유는 `tsconfig` 루트 확장 + `@/lib/validation/*` 별칭으로 한다.
> ⚠️ **공유하는 것은 있다 — 판단 모듈이다.** 두 워커와 앱이 **같은 규칙**을 써야 하는 것은 **호스트 화이트리스트와 ID 형식**이고, 그것은 §3.4가 이미 세운 방식(`tsconfig`가 루트를 확장해 `@/lib/validation/*` 별칭을 공유)으로 받는다 → 아래 「공유 판정 모듈」.

```
workers/image-proxy/
├── src/
│   ├── index.ts                  # Hono 앱 엔트리 · 요청 처리 순서(아래)를 이 파일이 고정한다
│   ├── routes/
│   │   ├── image.ts              # GET /img/:source/:id — 유일한 공개 라우트
│   │   └── health.ts             # GET /health
│   ├── lib/
│   │   ├── sources.ts            # 🚨 원천 상수. 호스트·경로·쿼리 이름이 전부 여기 있다
│   │   ├── kill-switch.ts        # 킬 스위치 읽기 (KV) + 자동 발동 기록
│   │   ├── cache.ts              # Workers Cache API 래퍼 (TTL 30일)
│   │   ├── upstream.ts           # 원천 fetch — redirect:"manual" · 타임아웃 · 크기 상한
│   │   └── rate-limit.ts         # 겹 3 클라이언트 (기전은 아래 표에서 고른다)
│   └── durable/image-rate-counter.ts   # ⚠️ DO를 고르면. §3.4의 quota-counter.ts와 **다른 객체다**
├── test/
│   └── *.test.ts                 # 합성 바이트 픽스처. 🚨 실제 카드 이미지를 넣지 않는다(§9.4 ⓕ-3)
├── tsconfig.json                 # 루트 확장 · `@/lib/validation/*` 별칭 공유 (§3.4와 같은 방식)
├── wrangler.toml
└── package.json
```

**라우트 — 하나뿐이다.**

```
GET /img/:source/:id
     └ source: "opcg-kr" 하나. 🚨 §4.4.1이 고정한 원천 목록을 넘지 않는다
     └ id:     downname. 아래 세 형식만 통과한다

예) GET /img/opcg-kr/202404240732471520
    → https://onepiece-cardgame.kr/fileDownload?downname=202404240732471520
```

| 규칙 | 근거 |
|---|---|
| **`:source`를 경로에 둔다 — 원천이 하나뿐인데도** | ⓐ **경로가 곧 원천 목록이 된다.** 두 번째 원천을 붙이려면 §4.4.1을 고쳐야 하는데 **그 순서를 사람의 기억에 맡기지 않는다**(§4.8 ⓔ의 화이트리스트와 같은 자세) ⓑ 나중에 넣으면 **모든 이미지 URL이 바뀐다** |
| **값은 `opcg-kr`** — 로컬 디렉토리의 `opcg`가 아니다 | 🚨 **T1.22 판정 3이 얻은 교훈 그대로.** 010이 `games.code`를 `opcg-kr`로 재명명했고 **버킷·DB의 권위 있는 식별자가 그것이다.** 로컬 라벨을 URL에 노출하면 두 이름 체계가 또 갈린다 |
| 🚨 **클라이언트가 URL을 주는 형태(`?url=`·`?host=`)를 만들지 않는다** | **이 한 줄이 오픈 릴레이 방어의 겹 0이다**(§9.4 ⓖ-3). **호스트·경로·쿼리 이름은 전부 `sources.ts`의 상수**이고 클라이언트가 주는 것은 `:id` 하나다 |
| **확장자를 경로에 넣지 않는다** | 🚨 **원천이 이미지마다 다른 포맷을 준다**(webp 1500×2044 / PNG 600×814 — §9.4 ⓖ-2 실측). **경로에 `.webp`를 박으면 그것이 pavilion이 낸 것과 같은 거짓 라벨이 된다** |

**요청 처리 순서 — 🚨 순서가 곧 설계다. 바꾸면 무엇이 깨지는지 각 줄에 적는다.**

| # | 단계 | 어기면 |
|---|------|--------|
| **1** | **킬 스위치를 읽는다** | 🚨 **캐시보다 뒤에 두면 회수가 무력해진다.** §9.4 ⓖ-4 전체가 **「킬 스위치가 캐시 조회보다 앞에 있다」** 하나 위에 서 있다 |
| **2** | **`:source` 화이트리스트 · `:id` 형식 검증** | 형식이 어긋난 것이 캐시 키가 되면 **캐시가 오염된다** |
| **3** | **레이트리밋** | 🚨 **캐시 조회보다 앞이다.** 뒤에 두면 캐시 히트가 무제한이 되어 **우리 워커 한도를 남이 태울 수 있다** |
| **4** | **캐시 조회** — 히트면 즉시 응답(원천 요청 0회) | — |
| **5** | **서킷 브레이커 확인** — 최근 원천 실패가 임계를 넘었으면 원천에 가지 않고 거부 | 없으면 원천이 아플 때 **우리가 더 때린다** |
| **6** | **원천 fetch** — `redirect: "manual"` · 타임아웃 · 크기 상한 | §9.4 ⓖ-7 |
| **7** | **`checkFinalHost()`** | **승인한 것은 출발지이지 도착지가 아니다**(T1.20 ⓑ-3의 문장 그대로) |
| **8** | 🚨 **`sniffImageFormat()`으로 `Content-Type`을 정한다** | **하드코딩하면 pavilion이 낸 것과 정확히 같은 실수다** — 아래 |
| **9** | **캐시에 넣는다**(TTL 30일) → **응답**(`max-age=3600`) | §9.4 ⓖ-4 |

**🚨 헤더 계약 — 이 표가 pavilion의 두 실수를 우리 쪽에서 막는 자리다.**

| 헤더 | 값 | 🚨 |
|---|---|---|
| **`Content-Type`** | **`sniffImageFormat(첫 12바이트)`가 돌려준 것.** `webp`/`png`/`jpg`/`gif` → 해당 MIME | 🚨 **하드코딩 금지.** 원천은 `Content-Type`을 **아예 보내지 않고**, pavilion은 `image/webp`로 박았는데 **실제 바이트는 PNG였다.** 우리는 T1.20 결함 2에서 같은 함정을 이미 한 번 밟았고 그때 만든 함수가 이것이다 — **「헤더는 의견이고 매직 바이트는 관측이다」** |
| **`sniffImageFormat()`이 `null`이면** | **502.** 캐시에 넣지 않고 기록한다 | **이미지가 아닌 것을 이미지라고 라벨해 내보내지 않는다.** 원천이 에러 HTML을 200으로 줄 수 있다(그 사이트는 404 본문이 20,615바이트짜리 HTML이다 — §4.8 ⓔ) |
| **`Cache-Control`** | **`public, max-age=3600`** | **`immutable` 없음 · `s-maxage` 없음 · `stale-while-revalidate` 없음.** 근거 셋 다 §9.4 ⓖ-4 |
| **`Content-Length`** | 실제 바이트 수 | |
| **원천으로 보내는 `Referer`** | ❌ **보내지 않는다** | 🚨 **pavilion이 쓰는 `Referer: https://pavilion-tcg.com/`을 흉내 내지 않는다.** §9.4 ⓒ가 그은 선 — **헤더를 만들어 상대의 판단을 흐리지 않는다** |
| **원천으로 보내는 `User-Agent`** | **`DeckBinder-ImageProxy/0.1 (<연락처 · 사용자가 정한다>)`** | §4.8 ⓔ의 UA 규칙 그대로 — **브라우저를 흉내 내지 않는다.** ⚠️ **연락처를 넣을지는 사용자 몫이고 근거도 그 절에 있다**(상대가 멈추라고 말할 수 있는 유일한 경로) |
| **원천으로 보내는 그 밖** | `Accept-Language: ko` 하나 | 같은 절 |
| **원천 응답 헤더** | 🚨 **그대로 전달하지 않는다. 위 넷만 우리가 만들어 붙인다** | 원천의 `Cache-Control: private, max-age=31536000, immutable`을 그대로 흘리면 **`private`이 캐시를 깨거나 `immutable`이 회수를 막는다.** ⚠️ **`public`으로 바꾸는 것 자체는 프록시의 당연한 일이지만, 「바꾼다」가 아니라 「우리가 새로 만든다」로 둔다 — 그래야 원천이 헤더를 바꿔도 우리 계약이 안 흔들린다** |

**공유 판정 모듈 — 🚨 규칙을 두 벌로 두지 않는다.**

| 무엇 | 어디에 | 누가 쓰나 |
|---|---|---|
| **`downname` 형식 정규식 3종** | ★ **신설 `src/lib/validation/card-image.ts`** | 워커(겹 2) · 앱의 `proxiedImageUrl()`(§9.4 ⓖ-5) · 필요하면 수집기 |
| **호스트 화이트리스트 · `decideHost()` · `checkFinalHost()` · `hostOf()`** | **지금은 `src/lib/catalog/images.ts`에 있다** | **판정: 넷을 `src/lib/validation/card-image.ts`로 옮기고 `images.ts`는 re-export한다.** ⚠️ **`images.test.ts` 70건의 기대값이 한 줄도 바뀌지 않아야 한다** — 그것이 이 이동이 안전하다는 증거이고, T1.29의 완료 기준이다. 🚨 **이동의 근거는 아래 「번들 오염」이고, 「jsdom이 딸려 온다」가 아니다 — 그 문장은 틀렸다** |
| **`sniffImageFormat()`** | 같음 | 워커(8단계) · 수집기 |
| ❌ **`isValidPathSegment()` / `IMAGE_SEGMENT_PATTERN`** | **옮기지 않는다. 프록시가 쓰지 않는다** | `^[A-Za-z0-9_-]+$`는 **`code`용**이고 `downname`은 형식이 다르다. **같아 보인다고 재사용하면 형식 1(`_` 포함)은 통과하고 형식 2와 섞인다** |

> 4. 🚨 **규칙이 실제로 무는지 확인한다** — 위반 **값** import를 **일부러 한 줄 넣어 `npm run lint`가 빨간불이 되는 것을 보고 되돌린다.** 그리고 **type-only import는 초록인 것도 함께 본다** — 두 방향을 다 보지 않으면 `allowTypeImports`가 실제로 켜졌는지 모른다. **규칙을 추가한 것과 규칙이 무는 것은 다르다**(011이 원격에 적용됐는지를 따로 확인한 것과 같은 자세).

**🚨 ID 형식 — ~~두 형식~~ → ★★★ 세 형식이다. 실측했다 (2026-08-31 · `data/catalog/opcg/` 40파일 3,146행 전수 · 요청 0회).**

```
형식 A  <18자리 숫자>                        1,058건 (33.6%)  예) 202404240732471520
형식 B  <YYYYMMDD>_<HHMMSS>_<10자 hex>      1,503건 (47.8%)  예) 20250619_183626_9012333d90
형식 C  <YYYYMMDD>_<HHMMSS>_<32자 hex>        585건 (18.6%)  예) 20260720_133222_f6f63859f7e04962a60da06c95a397f1
```

- 🚨 **가장 최근 교체가 `20260424`, 즉 4개월 전이다. 네 번째 형식이 올 것으로 보고 설계한다.**

| 판정 | 내용 |
|---|---|
| **왜 셋 다 받는가** | 위 분포. **하나라도 빼면 그 시대의 카드가 통째로 폴백이 된다** |
| **릴레이 표면이 늘지 않는가** | ✅ **늘지 않는다.** 셋 다 **고정 길이**(18 · 26 · 48) **· 고정 문자집합**이고 경로 문자·쿼리 문자·`.`이 들어갈 자리가 없다. **길이 밖은 전부 거부다** |
| ⚠️ **hex 대소문자** | **미실측**(실측한 3,146건은 전부 소문자). `[0-9a-fA-F]`로 받는다 — **관대하게 받아도 위험이 늘지 않고**(여전히 고정 길이 hex), 좁게 받았다가 틀리면 그 카드가 조용히 깨진다 |
| 🚨 **네 번째 형식을 「조용히」 만나지 않는다** | **워커는 형식 불일치를 400으로 거부하되 *세어서 드러낸다*.** ⚠️ **거부만 하고 세지 않으면 다음 교체가 「이미지 몇 장이 안 뜬다」로만 보이고 원인에 닿는 데 오래 걸린다.** → **T1.30 완료 기준에 「형식 불일치 카운터 + 임계 초과 시 기록」을 넣는다.** 🚨 **자동으로 형식을 넓히지 않는다** — 그것은 릴레이 표면을 코드가 스스로 넓히는 일이다. **사람이 §3.5를 고친다** |
| ⚠️ **이 수는 카탈로그 기준이지 화면 기준이 아니다** | 3,146행은 중간 파일이고 `cards`는 **3,139행**이다(7행 차이는 임포터의 `skip`/`invalid`). **분포의 결론은 바뀌지 않는다** |

**캐시 계층 — 🚨 KV를 쓰지 않는다. Workers Cache API 하나다.**

| 안 | 판정 |
|---|---|
| **Workers Cache API (`caches.default`)** | ✅ **채택.** TTL 30일. 콜로 로컬이라 **전역 삭제가 안 되지만 그것이 문제가 아니다** — 킬 스위치가 조회보다 앞이라(1단계) **지울 수 있는지가 회수의 조건이 아니다**(§9.4 ⓖ-4) |
| **Workers KV** | ❌ **기각.** ⓐ 🚨 **무료 저장 1GB에 3,146장 × 평균 300KB ≈ 0.94GB — 여유가 없다.** ⓕ-2의 144MB와 다른 이유는 **무변환이라 6배**이기 때문이다(§9.4 ⓖ-7) ⓑ **무료 읽기 한도가 이미지 조회 빈도에 맞지 않는다** ⓒ **KV가 주는 유일한 이점(전역 삭제)이 위 근거로 필요 없다** |
| **엣지 자동 캐시(`s-maxage`)** | ❌ **기각.** 🚨 **우리 코드 앞에 캐시가 서면 「모든 요청이 우리 코드를 지난다」가 거짓이 된다** |
| ⚠️ **대가 — 콜로마다 따로 채워진다** | **원천 요청이 콜로 수만큼 곱해진다.** 한국 사용자면 사실상 한 곳이라 작지만 **0이 아니다.** 인정하고 적는다 |
| 🚨 **중단 조건** | **첫 배포 뒤 실측한다 — 킬 스위치를 켰는데도 이미지가 계속 뜨면 앞단이 워커를 건너뛰고 있는 것이다.** 그러면 **즉시 `CDN-Cache-Control: no-store`를 붙이거나 라우트 구성을 고친다.** 고치기 전에는 공개하지 않는다 |

**★★★ 확정 — Durable Object. 사다리 첫 칸에서 섰다 (2026-09-01 · 사용자가 무료 요금제를 골랐다).**

| 물음 | 답 (출처: Cloudflare 공식 문서 · 요청 3회) |
|---|---|
| **무료에서 DO가 되는가** | ✅ **된다. 🚨 단 SQLite 백엔드 클래스만** — key-value 백엔드는 유료다. `wrangler.toml`에 **`new_sqlite_classes`**로 적는다. ⚠️ `new_classes`로 적으면 **무료 계정에서 배포가 거부된다** — 값이 아니라 가용성의 문제라 파일에도 주석으로 남겼다 |
| ⚠️ **DO 무료 한도가 상한을 낮추지 않는가** | ❌ **낮추지 않는다. 이것이 이 판정의 핵심 검산이다.** 레이트리밋은 **3단계**라 캐시 히트까지 포함해 **모든 요청이 DO를 지난다.** 그런데 **Workers 무료가 100k 요청/일이고 DO 무료도 100k 요청/일**이라 **두 한도가 정확히 같이 닿는다** — DO를 골라도 유효 상한이 그대로다. 🚨 **"DO는 요청을 두 배로 태운다"가 참이 아닌 이유가 여기 있고, 확인하지 않았으면 사다리 2번 칸으로 잘못 내려갈 뻔했다** |
| **DO 계산 시간은** | 13,000 GB-s/일. 카운터 하나는 요청당 수 ms라 **자릿수로 남는다**(대략 100k × 5ms × 0.125GB ≈ 62 GB-s) |
| 🚨 **저장하지 않는다** | **카운터를 메모리에만 둔다.** 매 요청 저장하면 **무료 SQLite 쓰기 한도(10만 행/일)를 요청 수와 1:1로 태운다** — 레이트리밋이 스스로 한도를 잡아먹는 꼴이 된다. ⚠️ **대가: 인스턴스가 evict되면 카운터가 0으로 돌아간다(관대한 방향).** 남용 차단이 목적이고 정확한 회계가 아니라 받아들이되, **"정확한 카운터"로 읽히지 않게 코드에 적었다** |

**★★ 무료 요금제의 값 — 🚨 문서에서 읽은 것이지 콘솔에서 읽은 것이 아니다.**

| 항목 | 값 |
|---|---|
| Workers 요청 | **100,000 / 일** |
| ★ **CPU 시간** | **요청당 10 ms** |
| 서브요청 | 50 / 요청 |
| 메모리 | 128 MB / 아이솔레이트 |

> ★★★ **CPU 10ms가 이 워커에 거는 제약을 적어 둔다 — 계약에 없던 항목이다.**
>
> ✅ **프록시는 대부분 원천 응답을 *기다리는* 시간이고 그것은 CPU 시간에 잡히지 않는다.** 바이트를 그대로 흘려보내는 한 10ms 안에 든다.
> 🚨 **그러나 워커가 이미지를 *만지는* 순간 이 값이 위험해진다.** 리사이즈·재인코딩·해시 계산 같은 것을 여기 넣으면 **5MB짜리에서 10ms를 넘긴다.** ⚠️ **§9.4 ⓖ-2가 "무변환"으로 정한 것이 성능 판정이 아니라 *비용* 판정이었는데, 여기서 **한도 판정이기도 하다**는 것이 하나 더 붙는다.
> **→ 규칙으로 적는다: 이 워커는 바이트를 변환하지 않는다.** 매직 바이트 12개를 읽는 것(`sniffImageFormat`)이 유일한 예외이고 그것은 상수 시간이다.
- **값(초안 · 🚨 관습값이지 실측이 아니다):** **IP 해시 기준 분당 240 · 시간당 2,000.** 근거: **세트 상세 한 화면이 60장**이므로 정상 사용자는 분당 240에 닿기 어렵고(연속 4화면), 남용은 걸린다. ⚠️ **첫 실측 뒤 이 줄을 고친다.**
- **IP는 솔트 해시로만 다룬다. 원문 IP를 저장하지 않는다.** 시크릿 이름은 `IMAGE_PROXY_IP_SALT`

**킬 스위치 — 회수의 본체다.**

| 항목 | 값 |
|---|---|
| **저장** | **KV 키 하나**(값 캐시가 아니라 플래그다 — 위 KV 기각과 충돌하지 않는다). 🚨 **환경변수로만 두면 끄는 데 배포가 필요해 「초 단위」가 깨진다** |
| **읽는 시점** | **요청 처리 1단계.** 캐시보다 앞 |
| **켜졌을 때의 응답** | **404** (본문 없음). ⚠️ **503이 아니다** — 503은 「곧 돌아온다」는 뜻이고, 회수는 그런 상태가 아니다 |
| ★ **자동 발동** | 🚨 **원천이 403/429를 주면 킬 스위치가 자동으로 켜진다.** §4.8 ⓔ의 「403·429는 즉시 전체 중단」을 프록시로 옮긴 것이고, **§4.4.1 되돌릴 조건 5의 감지기가 실제로 동작하는 자리다**(§9.4 ⓖ-8) |
| **자동 발동 뒤** | **사람이 읽을 때까지 자동으로 꺼지지 않는다.** §4.8 ⓔ의 「사람이 읽을 때까지 다시 돌리지 않는다」 그대로 |
| **리허설** | **배포 직후 1회 필수** — 켜고 · 표본 20건이 거부되고 · 화면이 폴백으로 떨어지는 것을 본다. 🚨 **리허설하지 않은 회수 절차는 회수 절차가 아니다**(T1.13 · §9.4 ⓕ-9가 세운 문장) |

**서킷 브레이커 · 원천 실패 처리**

| 원천 응답 | 프록시 | 근거 |
|---|---|---|
| **403 · 429** | 🚨 **킬 스위치 자동 발동 + 사람에게 보고.** 그 요청은 404 | §4.8 ⓔ — 「403은 상대가 처음으로 말을 한 것이다」 |
| **5xx** | **502로 응답. 캐시에 넣지 않는다.** 연속 N회(초안 **N=5**)면 서킷을 열어 **T분(초안 5분)** 원천에 가지 않는다 | ⚠️ **§4.8 ⓔ의 N=3보다 크게 잡는다 — 08-31 실측에서 4회 중 500이 한 번 났고, 배치와 달리 여기서는 「중단」이 서비스 중단이다.** 🚨 **값을 크게 잡는 대신 「끝없이 재시도하지 않는다」를 서킷이 보증한다** |
| **3xx** | ❌ **따라가지 않는다**(`redirect: "manual"`) → 502 + 기록 | 🚨 **배치와 다르다.** 프록시는 요청마다 도는데 리다이렉트를 따라가면 **매 요청이 화이트리스트 밖으로 나갈 기회를 갖는다.** `checkFinalHost()`는 그래도 부른다(방어 2겹) |
| **본문이 상한 초과** | 502. 상한 **5MB** | **마이그레이션 011의 `file_size_limit`과 같은 값을 쓴다** — 숫자를 두 벌로 만들지 않는다 |
| **타임아웃** | 502. 상한 **10초** | |
| **재시도** | ❌ **하지 않는다** | 🚨 **배치와 결정적으로 다른 자리다.** 사용자가 화면 앞에 있고 **브라우저가 이미 재시도 주체다**(`<img>` 재요청 · 새로고침). **워커가 또 재시도하면 원천이 받는 부하가 곱해진다** |

**환경변수 · 시크릿** — §6에 추가된다.

| 이름 | 어디 | 값 |
|---|---|---|
| `NEXT_PUBLIC_IMAGE_PROXY_BASE` | **Next 앱** | 프록시 base URL. `proxiedImageUrl()`이 **인자로** 받는다(§9.4 ⓖ-5) |
| `IMAGE_PROXY_ALLOWED_HOSTS` | 워커 | `onepiece-cardgame.kr`. 🚨 **비우면 `decideHost()`가 전부 거부한다 — 배포 단위 킬 스위치** |
| `IMAGE_PROXY_IP_SALT` | 워커 시크릿 | 겹 3 |
| (KV 바인딩) | 워커 | 킬 스위치 플래그 |

**번들 오염** — 워커 번들에 앱 의존성이 새지 않게 `@typescript-eslint/no-restricted-imports` + **`allowTypeImports: true`**로 막는다. ⏸ **미완: `workers/**`에도 같은 규칙을 건다.**
**테스트 전략 — §7을 그대로 적용하지 않는다(§4.8 ⓘ와 같은 자리).**

- **판단은 전부 순수 함수로 뽑고 그쪽에 단위 테스트를 붙인다** — ID 검증 · 헤더 조립 · 캐시 키 · 서킷 상태 전이 · 킬 스위치 판정.
- 🚨 **테스트에 실제 카드 이미지를 넣지 않는다.** T1.20이 만든 **94바이트 합성 PNG** 같은 것을 쓴다(§9.4 ⓕ-3).
- **네트워크를 타는 부분은 `fetch`를 주입으로 받는다.** 테스트가 원천에 나가지 않는다 — **테스트 실행이 원천 부하가 되는 상태를 만들지 않는다.**

## 1.10 도메인 계약

> 🚨 **§ 번호를 다시 매기지 않는다.** 코드가 하위 항목(ⓐ~ⓚ)까지 인용한다. **§4.5가 §4.6 뒤에 오는 것도 그대로 둔다** — 참조가 코드와 `docs/`에 퍼져 있다.

### §4.0 지원 TCG 범위 (확정)

**포켓몬 카드 게임(`ptcg`) · 원피스 카드 게임(`opcg`) 2종.** 유희왕은 제외.

| 항목 | 포켓몬 (`ptcg`) | 원피스 (`opcg`) |
|------|-----------------|-----------------|
| 메인 덱 매수 | 정확히 **60장** | 정확히 **50장** |
| 동일 카드 매수 제한 | **4장** (기본 에너지는 무제한) | **4장** (카드 넘버 기준) |
| 별도 존 | 없음 | **리더 1장**, **DON!! 덱 10장** |
| 첫 손패 | **7장** | **5장** |
| 멀리건 | 기본 포켓몬 0장이면 공개 후 재드로우 (상대 1장 추가 드로우) | 1회 한정, 5장 되돌리고 재드로우 |
| 추가 제약 | — | 덱 카드 색상이 리더 색상에 포함돼야 함 |

- 🚨 **수치는 코드에 하드코딩하지 않고 `games` 행에서 읽는다**(§4.7 ⓑ). 마이그레이션 001이 심는 참조 데이터다
- `deck_cards.zone` enum은 `main | leader | don` (유희왕 구조인 `extra`/`side`는 폐기)
- 기본 에너지 무제한 예외는 `cards.sub_type = 'basic_energy'`로 식별해 `validate.ts`에서 면제
- ⚠️ **README의 "첫 손패 5장"은 원피스 기준이다.** 포켓몬은 7장이라 `draw.ts`는 게임별로 분기한다

### §4.1 데이터 모델 (Supabase / PostgreSQL)

> 🚨 **이 트리는 「스키마 현황」이 아니라 「확정된 설계」다.** 실재 여부를 각 줄에 표시한다 — **트리에 있다고 존재하는 것이 아니다.**

```
── 마스터 데이터 ─────────────────────────  ✅ 전부 실재 (001 · 005 · 007 · 008 · 009 · 010)
games              (id, code'ptcg|opcg-kr|opcg-jp', base_game GENERATED, name_ko, name_ja,
                    deck_size, hand_size, copy_limit)   -- 게임별 룰 (§4.0). 컨벤션은 §4.12 ⓒ
card_sets          (id, game_id→games, code, name_ko NULL, name_ja NULL, released_at)
                    -- check(name_ko is not null or name_ja is not null)  [009]
cards              (id, game_id, set_id→card_sets, code,
                    name_ja NULL, name_ko NULL, name_en NULL,
                    -- check(name_ko is not null or name_ja is not null)  [008]
                    -- 🚨 name_ja를 한국어명으로 채우지 않는다 (§4.8 ⓕ)
                    rarity, attribute, card_type, sub_type,
                    colors text[], life int, cost int, power int, counter int,
                    traits text[], trigger_text, illustration_type, block_number,  [008]
                    image_url NULL,        -- 계속 null. 🚨 컬럼을 지우지 않는다 (§9.4 ⓖ-5)
                    source_image_url,      -- 원천 절대 URL. 화면이 렌더 시점에 프록시 경로로 재작성
                    effect_text,
                    base_code GENERATED)   -- split_part(code, '_', 1). 대체 카드 판정 (§4.6)
keywords           (id, game_id, code'draw|energy_accel|search|...', label_ko, label_ja)
card_keywords      (card_id→cards, keyword_id→keywords)   -- 태그 검색 M:N, PK(card_id, keyword_id)

── 콘텐츠 ──────────────────────────────  ✅ 실재 (006)
news_posts         (id, slug UNIQUE check '^[a-z0-9][a-z0-9-]*$',
                    title, summary, content_md, thumbnail_url, author_name,
                    published_at,         -- null=초안, 과거=공개, 미래=예약
                    created_at, updated_at)
                    -- 초안 차단은 RLS가 한다. 앱 쿼리에서 조건을 빠뜨려도 새지 않는다.
                    -- ★ 앱은 now가 아니라 now-5초를 찍는다 (§2.7-20 · publish.ts)

── 덱 ──────────────────────────────────  ❌ 미착수 (T2.3 · 마이그레이션 002)
decks              (id, game_id, owner_id→profiles NULL, name, description,
                    source_type'tournament|meta|user', tier'S|A|B|C' NULL,
                    tournament_name, placed_at, is_public, created_at)
deck_cards         (deck_id→decks, card_id→cards, zone'main|leader|don', count)

── 사용자 ──────────────────────────────  ❌ 미착수 (T3.1 · T3.2 · 마이그레이션 004)
profiles           (id→auth.users, nickname, avatar_url, created_at)
collection_items   (id, user_id→profiles, card_id→cards, quantity,
                    condition'all|a_grade_unopened|psa_bgs_graded',
                    -- 🚨 이 3값은 계약이다. 폐기된 매물 필터에서 온 것이지만
                    --    collection_items가 그대로 재사용한다 — 새로 만들지 않는다.
                    --    ⚠️ 도감 완성도(T2.16)는 이 칸을 건드리지 않는다 (§4.13 ⓔ)
                    grade_label'PSA10|BGS9.5|...' NULL,
                    is_wishlist)
binder_shares      (id, user_id→profiles, slug UNIQUE, title, is_active, view_count)
                    -- 공개 바인더는 뷰 v_public_binder로만 노출
```

**저장소 (011)** — `storage.buckets`의 `card-images`(public, `allowed_mime_types={image/webp}`, `file_size_limit` 5MB). ⏸ **완료 · 미사용** — 프록시 전환으로 쓰지 않지만 되돌릴 갈래(§9.4 ⓖ-9)를 위해 **롤백 마이그레이션을 내지 않았다.**

**인덱스 / 검색**

- 부분일치는 `pg_trgm` GIN 인덱스를 `cards.name_ko`와 **`cards.name_ja`** 양쪽에 (002). **실데이터 대부분이 일본어명에 쌓이므로 일본어 쪽이 실질적으로 더 중요하다**
- `card_keywords(keyword_id, card_id)` — 키워드 교차 필터용 역방향 인덱스
- `(game_id, base_code)` — 대체 카드 조회 (§4.6)
- **`similar_groups` / `search_vector`는 007에서 제거했다** — 둘 다 001에서 만들었지만 앱이 한 번도 조회하지 않았다. 🚨 **읽는 곳이 없는 구조를 미리 만들지 않는다**

### §4.1-1 ★ RLS 정책만으로는 접근 제어가 성립하지 않는다 (T1.5 실측)

PostgreSQL은 **테이블 레벨 권한(GRANT)을 먼저 검사하고, 통과한 뒤에야 RLS로 행을 거른다.** 기본 상태의 신규 테이블은:

| 역할 | 마이그레이션 직후 기본 권한 | 결과 |
|------|------------------------------|------|
| `anon` / `authenticated` | `REFERENCES, TRIGGER, TRUNCATE` | SELECT 없음 → 정책이 허용해도 `42501 permission denied` |
| `service_role` | 같음 | INSERT 없음 → 시드 · 배치 적재 불가 |

즉 정책만 쓰면 **도감 읽기가 전부 막히고 적재도 실패한다.** 게다가 세 역할에 붙은 `TRUNCATE`는 **RLS를 우회**하므로 회수해야 한다.

**따라서 모든 마이그레이션은 RLS 정책과 함께 다음 3종을 반드시 포함한다.**

```sql
revoke all on <테이블…> from anon, authenticated, service_role;
grant select on <테이블…> to anon, authenticated;                   -- 읽기 대상만
grant select, insert, update, delete on <테이블…> to service_role;  -- TRUNCATE 제외
```

**Reviewer는 신규 테이블마다 `revoke all` → 최소 권한 `grant` → RLS 정책 3단이 모두 있는지 확인한다.**

**RLS 정책 (전 테이블 필수 — CLAUDE.md)**

| 테이블 | 정책 |
|--------|------|
| `games` · `card_sets` · `cards` · `keywords` · `card_keywords` · `news_posts` | 익명 `SELECT` 허용, 쓰기는 `service_role`만 |
| `decks` | `SELECT`: `is_public OR owner_id = auth.uid()` / 쓰기: 소유자만 |
| `deck_cards` | 상위 `decks`의 가시성을 따름 |
| `collection_items` | 전 작업 `user_id = auth.uid()` |
| `binder_shares` | `SELECT`: `is_active` / 쓰기: 소유자만 |
| `profiles` | `SELECT`: 전체(닉네임·아바타) / 쓰기: 본인만 |

### §4.2 상태 관리 분리 규칙

| 상태 종류 | 도구 | 위치 | 예시 |
|-----------|------|------|------|
| 서버 데이터 | TanStack Query | `src/lib/query` | 카드 검색 결과, 덱 목록, 컬렉션 |
| 클라이언트 편집 상태 | Zustand | `src/lib/stores` | 덱 빌더 구성 카드, 시뮬레이터 손패, 바인더 페이지 인덱스 |
| URL 상태 | nuqs / `searchParams` | `src/app` | 카드 필터(속성 · 레어도 · 키워드), 정렬, 페이지 |

> 필터 조건은 **반드시 URL에 반영**한다 — 링크 공유와 도감 SEO 색인이 목적이다.

### §4.4 카드 데이터 원천 — 자체 구축 (외부 연동 없음)

**2026-08-23 방침.** 외부 사이트 연동을 중단하고 카드 데이터를 자체 DB로 직접 관리한다. 이전에 수집했던 데이터는 전량 삭제했고 수집 스크립트·파서도 제거했다 — **남겨두면 누군가 실행해 자체 데이터를 덮어쓴다.** 등록 경로는 **관리자 화면(§4.5)과 카탈로그 임포터(§4.11)** 둘이다.

**유지되는 컬럼 제약**

| 컬럼 | 제약 | 사유 |
|------|------|------|
| `cards` 이름 | **`check (name_ko is not null or name_ja is not null)`** (008) | `not null`이 지키던 「표기가 항상 있다」를 약한 제약으로 옮긴 것이다. 화면 표기가 `coalesce(name_ko, name_ja)`이므로 **둘 다 null이면 빈칸이 된다** |
| `cards.name_ja` | nullable | 원천이 일본어명을 주지 않는 것이 실측됐다. 🚨 **그렇다고 한국어명으로 채우지 않는다 — 그 경로를 코드에 만들지 않는다**(§4.8 ⓕ). 오염이 조용하고 늦게 발견되며 화면에는 정상으로 보인다 |
| `cards.name_ko` | nullable | 한국 미발매 카드가 존재한다 |
| `card_sets` 이름 | 같은 형태의 `check` (009) | 세트는 떨어질 자리가 빈 문자열이 아니라 `code`라 `setDisplayName`이 따로 있다 |
| `cards.sub_type` | `basic_energy`면 매수 제한 면제 | §4.0 |

> ⚠️ **손입력이라고 해서 다 같지 않다.** §9.3의 약관 검토 결과 **재사용 금지 조항은 수집 방법을 조건으로 달지 않는다.** 자동 수집을 그만두어 벗어난 것은 **접근 규율 하나뿐**이고 데이터 재사용 축은 그대로 남는다.

### §4.4.1 원천 판정 — 🚨 이 절의 문장을 한 글자도 가볍게 고치지 않는다

| # | 결정 |
|---|------|
| 1 | **참조 원천은 `onepiece-cardgame.kr`(원피스 한국 공식) 하나다** |
| 2 | **일본 사이트 2곳(`onepiece-cardgame.com` · `pokemon-card.com`)의 게재물은 사용하지 않는다** — 기준선이 영리성이 아니라 **사용 목적 그 자체**(「私的使用」 · 「個人的に楽しむ場合に限って」)라 공개 서비스면 광고가 없어도 벗어난다 |
| 3 | **포켓몬코리아(`pokemoncard.co.kr`)는 당장 원천이 아니다.** 포켓몬을 넣을 때 다시 판단한다 |
| 4 | **이미지는 리버스 프록시로 전달한다**(§9.4 ⓖ · §3.5). 원천 절대 URL은 `cards.source_image_url`에 그대로 둔다 |
| 5 | **수익화 — 광고만 열린 선택지다.** 제휴 · 후원 · 유료 기능은 닫혀 있다(§9.1) |
| 6 | **권리자 문의 메일을 보내지 않는다.** 초안 4통은 `docs/permission-inquiry-drafts.md`에 **보관용**으로 남는다. 🚨 **묻지 않는 것이 이 절의 근거를 바꾸지 않는다 — 오히려 공백을 메울 유일한 방법이 없어져 공백이 영구화된다** |
| 7 | **⑤축(공식 창구) 조사 결과 어느 원천도 공식 창구로 열리지 않았다.** 결정 1~3을 바꾸지 않고, 바뀐 것은 **근거의 성격**이다 |

> 🚨 **이 절의 근거는 「허용 확인」이 아니라 「금지 근거를 찾지 못함」이다.** `onepiece-cardgame.kr`은 `robots.txt`가 **404**이고 이용약관·저작권 안내 문서를 찾지 못했다. **404는 「해도 된다」가 아니라 「아무 말도 하지 않았다」다.**
>
> ⚠️ **「못 찾음」을 빈칸으로도 허용으로도 세지 않는다. 「못 찾음」과 「닫힘」도 다르다.**
> 🚨 **어떤 문서·화면·커밋 메시지에도 「팬 사이트라서 허용된다」는 취지를 쓰지 않는다** — 근거가 없다. **「비영리」는 사실 서술로는 써도 되고 정당화 근거로는 쓸 수 없다.** 쓸 수 있는 것은 사실뿐이다: 「광고를 게재하지 않는다」 · 「제휴 링크를 두지 않는다」. **이 검토는 법률 자문이 아니다.**

**되돌려야 하는 조건**

| # | 조건 | 상태 |
|---|------|------|
| 1 | `onepiece-cardgame.kr`에 이용약관·저작권 안내가 새로 게시된다 | **살아 있다.** §9.3 ⓓ 재확인 절차가 잡는다 — **문의를 안 보내기로 한 뒤 이것이 유일하게 남은 「새 재료가 들어오는 경로」다** |
| 2 | ~~문의에 거절 회신이 온다~~ → **「발송을 다시 결정한다」** | 보내지 않으므로 회신이 없다. 다시 보내기로 하면 즉시 유효해진다 |
| 3 | **권리자로부터 중지 요청을 받는다** | **살아 있고 비중이 커졌다** — 우리가 먼저 묻지 않으므로 **접촉이 상대 쪽에서 시작될 가능성만 남는다** |
| 4 | 영리 요소를 붙이려는 시점 | 광고가 열린 선택지로 돌아와 살아 있다(§9.1) |
| ★ 5 | **이미지 전달을 시작한 뒤 원천이 이미지 접근을 막거나(`Referer`·UA 차단 · 403·429) 이미지 경로를 바꾼다** | **감지기가 프록시의 킬 스위치 자동 발동이다**(§3.5). ⚠️ **캐시 TTL 30일이 감지를 늦춘다** |
| ★ 6 | **프록시(②축)와 광고(④축)가 동시에 켜진 상태에서 조건 1 또는 3이 발생한다** | **기술 조건이 아니라 판단 조건이다.** 광고 수익이 걸려 있으면 **중지 요청에 대한 판단이 무뎌진다** |

### §4.6 대체 카드 판정 — 기본 코드(`base_code`)

> ⚠️ **이 절이 §4.5보다 *앞*에 있다. 번호를 고치지 않는다** — `CLAUDE.md`와 코드가 이미 그 번호로 참조한다.

**같은 카드의 다른 인쇄본**을 대체 카드로 본다. 게임상 동일하므로 플레이어는 그중 가장 싼 것을 사면 된다.

```
OP17-001      루피 (일반)
OP17-001_p1   루피 (패러렐)
OP17-001_p2   루피 (SEC)
```

`cards.base_code`는 코드에서 밑줄 뒤 접미사를 뗀 **생성 컬럼**이다 — `split_part(code, '_', 1)` (005).

- 앱 로직에 판정이 흩어지지 않는다. 코드를 고치면 자동으로 따라간다
- `(game_id, base_code)` 인덱스를 타므로 대체 카드 조회가 인덱스 스캔이다
- 관리자가 따로 묶는 작업이 없다

> ⚠️ **코드 규칙: 밑줄(`_`)은 다른 인쇄본을 구분하는 용도로만 쓴다.** 일반 카드 코드에 밑줄을 넣으면 의도치 않게 묶인다.
> 🚨 **이 절의 「대체 카드」와 §4.9의 「같은 세트」를 한 목록이나 탭으로 합치지 않는다.** 뜻이 전혀 다르다 — 여기는 「덱에서 바꿔 쓸 수 있다」이고 저쪽은 「같이 나왔다」다.
> **`similar_group_id`는 007에서 제거했다.** 행이 하나도 없었고 등록 화면도 없었다. 효과가 비슷한 **다른 이름의 카드**는 효과 키워드 태그(`card_keywords`)로 커버한다.

### §4.5 관리자 화면 (T1.6-A)

> **절 번호가 §4.6 뒤에 온다 — 번호를 바꾸지 않는다.** 참조가 코드(`tests/e2e/admin-cards.spec.ts`)와 `docs/`에까지 퍼져 있다.

| 항목 | 내용 |
|------|------|
| 인증 | `ADMIN_TOKEN` 환경변수 + httpOnly 쿠키(해시 저장, 12시간). **T3.1 계정 권한 전까지 임시.** 토큰 규격·보관·회전은 §9.2 ⓐ |
| 회전 = 즉시 무효화 | 쿠키 값이 `sha256(ADMIN_TOKEN)`이고 매 요청 **현재 토큰의 해시**와 비교한다. 토큰을 바꾸는 순간 발급된 쿠키가 전부 불일치 |
| 경로 보호 | `src/proxy.ts`가 `/admin/*`에서 쿠키 존재를 확인해 로그인으로 보낸다 |
| 값 검증 | 각 API가 `requireAdmin()`으로 쿠키 값을 직접 검증한다. **proxy만 믿지 않는다** |
| 쓰기 권한 | `service_role`(RLS 우회)이므로 인증 뒤에서만 호출한다 |
| 화면 | `/admin` · `/admin/sets` · `/admin/keywords` · `/admin/cards`(목록 — 검색·페이지네이션) · `/admin/cards/new` · `/admin/cards/[cardId]` |
| API | `POST /api/admin/session` · `sets` · `cards` · `PATCH·DELETE /api/admin/cards/[cardId]` |

> **카드 도달 경로는 목록(`/admin/cards`) 하나로 모은다.** 등록만 되고 다시 찾을 수 없는 상태가 T1.12 이전의 실제 문제였다.
> ⚠️ **토큰 1개 = 전체 쓰기 권한이다.** 유출되면 카탈로그 전체를 조작할 수 있고, 범위가 하드 삭제(§9.10)까지 넓다. 전제 3가지는 §9.2 ⓒ.

### §4.7 덱 · 시뮬레이터 도메인 계약 (T2.1 · T2.2 — ✅ 구현 완료)

#### ⓑ 게임 룰을 어디에 두는가 — **수치는 DB, 구조는 코드. 섞지 않는다**

| 룰 | 어디에 | 근거 |
|----|--------|------|
| 메인 덱 매수(ptcg 60 · opcg 50) · 첫 손패(7 · 5) · 동일 카드 매수 제한(4) | **DB `games` 행**(`deck_size` · `hand_size` · `copy_limit` — 마이그레이션 001) | §4.0이 하드코딩을 금지했고 **컬럼이 이미 있다.** 코드에 같은 숫자를 다시 쓰면 출처가 둘이 되어 **조용히 어긋난다** — §2.7이 모아 둔 사고 유형 그대로다 |
| 존 구성(`main`/`leader`/`don`) · 리더 색상 일치 · 기본 에너지 예외 · 멀리건 방식 · DON!! 덱 10장 | **`src/lib/domain/rules.ts`의 구조 룰 표** | **DB에 컬럼이 없다. 지금 만들지 않는다** — §9.4의 코스트·파워와 **같은 판단**이다. 게임 2종으로 스키마를 정하면 추측이 된다. 컬럼이 필요해지는 시점은 **3번째 게임이 들어올 때**이고 `CLAUDE.md`가 2종으로 못박고 있다 |

> 🚨 **재하드코딩을 막는 장치는 테스트 하나다.** `composeGameRules({ deckSize: 99, handSize: 3, copyLimit: 1 }, "ptcg")`가 **99 · 3 · 1을 그대로 돌려주는지** 단언한다. 이 단언이 없으면 다음 사람이 "어차피 60이니까"라며 상수를 도메인에 다시 심고, **그때부터 DB의 `deck_size`는 아무도 읽지 않는 컬럼이 된다** — 007이 지운 `search_vector`가 정확히 그렇게 됐다(§4.1).

#### ⓒ 타입 — `src/types/game.ts`

```ts
export type GameCode = "ptcg" | "opcg";

/** T2.3의 deck_cards.zone enum과 값이 일치해야 한다 (§4.1) */
export type DeckZone = "main" | "leader" | "don";

/** DB games 행에서 오는 수치. 이 세 값을 코드에 다시 쓰지 않는다 (ⓑ) */
export interface GameRuleNumbers {
  readonly deckSize: number;
  readonly handSize: number;
  readonly copyLimit: number;
}

export interface ExtraZoneRule {
  readonly zone: Exclude<DeckZone, "main">;
  readonly size: number;                    // leader 1 · don 10
  readonly countsTowardCopyLimit: boolean;
}

export type MulliganRule =
  | { readonly kind: "redraw_while_missing_role"; readonly role: string; readonly maxRedraws: number }  // ptcg
  | { readonly kind: "redraw_once" };                                                                   // opcg

export interface GameRules extends GameRuleNumbers {
  readonly code: GameCode;
  readonly extraZones: readonly ExtraZoneRule[];
  readonly leaderColorMatch: boolean;
  readonly mulligan: MulliganRule;
}

/**
 * 덱 한 칸. **도메인이 카드에 대해 아는 전부다.**
 * cards 테이블의 컬럼명을 하나도 쓰지 않는다 — 채우는 것은 호출부의 몫이다 (ⓓ).
 */
export interface DeckSlot {
  readonly cardKey: string;               // 동일성 식별자. UUID일 필요가 없다
  readonly count: number;
  readonly zone: DeckZone;
  readonly copyLimitExempt?: boolean;     // ptcg 기본 에너지 (§4.0)
  readonly colors?: readonly string[];    // opcg 리더 색상 일치용
  readonly roles?: readonly string[];     // ptcg 멀리건 판정용 (예: "basic_pokemon")
}
```

#### ⓓ 카드 DB에 의존하지 않는다는 것을 **어떻게 강제하는가** — 네 겹

**말로만 두면 지켜지지 않는다.** §3.3 규칙 2(도메인은 React·Next·Supabase를 import 하지 않는다)는 지금까지 **Reviewer의 눈**으로만 지켜졌고, 도메인 코드가 아직 0줄이라 한 번도 시험된 적이 없다.

| # | 장치 | 무엇을 막는가 |
|---|------|---------------|
| 1 | **공개 API의 카드 표현은 `DeckSlot` 하나이고 필드가 전부 원시값이다** | `CardDetail` · `CardListItem` · `Database`(생성 타입)가 도메인 시그니처에 **나타날 자리가 없다.** `cardKey`가 `string`이라 우리 UUID도, 사용자가 직접 친 카드명도 똑같이 들어간다 — **§9.11 ⓓ-2 갈래에서 그대로 산다** |
| 2 | **eslint `no-restricted-imports`를 `src/lib/domain/**`에 건다** | 대상: `@/types/database` · `@/types/card` · `@/lib/supabase/*` · `next/*` · `react` · `@supabase/*`. **§3.3 규칙 2를 사람 눈에서 `npm run lint`로 옮긴다.** 이 규칙 추가가 T2.1의 완료 기준에 들어간다 |
| 3 | **컬럼 이름을 도메인이 모른다** — `sub_type` → `copyLimitExempt`, `attribute` → `colors`로 **호출부가 번역해서 넣는다** | 스키마가 바뀌어도 도메인은 컴파일이 깨지지 않고, 반대로 **도메인을 고치려고 마이그레이션을 부르는 일도 없다.** ⚠️ 대가는 번역이 틀려도 도메인은 모른다는 것이다 — 어댑터(T2.5)에 테스트를 붙인다 |
| 4 | **집계 축도 주입받는다** — `stats.ts`는 `groupBy` 콜백을 받고 "카드 종류"라는 개념을 갖지 않는다 | `card_type`을 도메인이 알게 되는 순간 3번이 무너진다 |

> ⚠️ **1번이 넓은 타입을 일부러 고른 것임을 기억한다.** `cardKey: string`은 브랜디드 타입으로 좁히면 더 안전해 보이지만, **좁히는 순간 "우리 DB의 id"라는 뜻이 붙어 이 절의 목적이 사라진다.** 좁히지 않는다.

#### ⓔ T2.1 — 공개 함수 시그니처

```ts
// rules.ts
export function composeGameRules(numbers: GameRuleNumbers, code: GameCode): GameRules;

// simulator/shuffle.ts
export type Rng = () => number;                                  // [0, 1)
export function createRng(seed: number): Rng;                    // 순수 · 재현 가능
export function shuffle<T>(items: readonly T[], rng: Rng): T[];  // 입력 불변, 새 배열

// simulator/draw.ts
export function buildLibrary(slots: readonly DeckSlot[], zone: DeckZone): string[];  // count만큼 cardKey를 펼친다

export interface HandState {
  readonly hand: readonly string[];
  readonly library: readonly string[];
  readonly mulliganCount: number;
}
export function drawOpeningHand(
  slots: readonly DeckSlot[], rules: GameRules, rng: Rng
): HandState;

export type MulliganResult =
  | { readonly kind: "redrawn"; readonly state: HandState }
  | { readonly kind: "not_allowed"; readonly reason: "limit_reached" | "condition_not_met" }
  | { readonly kind: "undecidable"; readonly reason: "role_unknown" };
export function mulligan(
  state: HandState, slots: readonly DeckSlot[], rules: GameRules, rng: Rng
): MulliganResult;

// simulator/probability.ts
export interface HypergeometricInput {
  readonly populationSize: number;   // 덱 매수
  readonly successCount: number;     // 원하는 카드 매수
  readonly sampleSize: number;       // 뽑는 매수
  readonly minHits?: number;         // 기본 1
}
export function atLeast(input: HypergeometricInput): number | null;
export function exactly(input: HypergeometricInput & { hits: number }): number | null;
```

**결정 셋에 근거를 붙인다.**

1. **확률이 `number`가 아니라 `number | null`이다.** 덱 빌더는 **덱이 완성되기 전에도 열려 있다** — 30장짜리 덱에 손패 7장을 묻는 것은 정상이지만, 5장짜리 덱은 `sampleSize > populationSize`가 된다. **호출부의 버그가 아니라 사용자의 중간 상태이므로 던지지 않는다.** `null`은 화면에서 **"산출 불가"**로 표시한다 — §4.3의 `sample_size < 3`, §2.8 규칙 1과 **같은 규칙**이다. *값이 없는 것*과 *기능이 없는 것*을 구분한다.

#### ⓕ T2.2 — 공개 함수 시그니처

```ts
// deck/validate.ts
export type DeckViolation =
  | { readonly code: "deck_size"; readonly zone: DeckZone; readonly expected: number; readonly actual: number }
  | { readonly code: "copy_limit"; readonly cardKey: string; readonly limit: number; readonly actual: number }
  | { readonly code: "invalid_count"; readonly cardKey: string; readonly actual: number }
  | { readonly code: "zone_not_allowed"; readonly zone: DeckZone }
  | { readonly code: "leader_color_mismatch"; readonly cardKey: string;
      readonly cardColors: readonly string[]; readonly leaderColors: readonly string[] }
  | { readonly code: "color_unknown"; readonly cardKey: string };

export interface DeckValidation {
  readonly ok: boolean;
  readonly violations: readonly DeckViolation[];
}
export function validateDeck(slots: readonly DeckSlot[], rules: GameRules): DeckValidation;

// deck/stats.ts
export interface DeckStats {
  readonly byZone: Readonly<Record<DeckZone, number>>;   // 매수 합
  readonly distinctCards: number;
  readonly groups: readonly { readonly key: string | null; readonly count: number }[];
}
export function summarizeDeck(
  slots: readonly DeckSlot[], groupBy?: (slot: DeckSlot) => string | null
): DeckStats;
```

**결정 넷.**


**설계에 없던 결정 넷 — 구현이 정했고 기록으로 남긴다.**

1. **확률이 `number | null`이다.** 덱 빌더는 덱이 완성되기 전에도 열려 있으므로 **산출 불가를 값으로 표현한다**
2. **ptcg `maxRedraws`는 `Number.POSITIVE_INFINITY`다** — 실제 룰에 재시도 상한이 없어 유한한 수를 적으면 **그것이 근거 없는 룰이 된다**
3. 🚨 **확률은 로그 공간에서 계산한다** — `C(300,60)`이 배정밀도 밖이라 비율로 직접 계산하면 `Infinity/Infinity` → `NaN`이 된다. **작은 값 테스트만으로는 안 잡힌다**
4. **모르면 통과가 아니다** — `colors`를 주지 않으면 `color_unknown` 위반이 뜬다. ⚠️ **테스트 픽스처의 함정: opcg 덱에 `colors`를 안 주면 존·매수만 보려던 케이스가 색상 위반으로 실패하고 그때 구현이 틀린 것처럼 보인다.** 버그가 아니라 의도대로 동작한 것이다

#### ⓗ 스키마 공백 — **ptcg 기본 포켓몬 판정은 열린 채다**

멀리건의 `role: "basic_pokemon"`을 채울 재료가 `cards`에 없다. 🚨 **재료가 생기지 않아 T1.17에서 닫지 않았다** — 포켓몬 카탈로그를 넣는 날 다시 본다. 그때까지 `mulligan()`은 `undecidable / role_unknown`을 돌려준다.

### §4.8 카탈로그 자동 수집 · 임포트 계약 (A-5 → T1.16~T1.19 — ✅ 전량 실행됨)

> 🚨 **폐기하지 않는다 — 이미지 묶음이 같은 모양의 파이프라인이고 ⓑ·ⓒ·ⓓ·ⓔ·ⓖ를 그대로 물려받는다.** ⚠️ **다만 값 하나는 물려받지 않는다 — 3초는 이미지 수집기에서 1.5초다.**
> ⚠️ **「확인하지 못한 것」을 「없는 것」이나 「허용된 것」으로 읽지 않는다.**

#### ⓐ 4단 분해 — 🚨 **역순이 불가능하다**

**T1.16**(수집 → 중간 파일) → **T1.17**(마이그레이션 008) → **T1.18**(임포터) → **T1.19**(첫 실적재). 중간 파일을 **사람이 눈으로 확인**하는 것이 T1.17의 선행이다.

#### ⓑ 어디서 도는가 — **로컬 `scripts/` tsx 스크립트. §1 P2의 대상이 아니다**

P2가 막으려던 것은 **앱 런타임 격리와 쿼터 관문**이지 IP 은닉이 아니다. 개발자 머신에서 손으로 돌리는 일회성 적재는 그 주어가 아니다.

#### ⓒ 모듈 경계 — **판단은 `src/lib/catalog/`, `scripts/`는 배선**

`parse` · `pace` · `manifest` · `series` · `images` · `types`가 판단을 지고, `scripts/collect-catalog.ts`는 CLI 인자 해석과 파일 쓰기만 한다. 🚨 **`scripts/`에서 세지 않는다** — 집계도 순수 모듈에 둔다.

#### ⓓ 중간 파일 — **JSONL. `data/`에 두고 커밋하지 않는다**

- 형식 **JSONL** + 실행마다 **매니페스트 1건**. **완주든 중단이든 항상 쓴다**
- 위치 `data/catalog/<game>/<set>.jsonl`. 🚨 **커밋하지 않는다** — DB는 `UPDATE` 한 번으로 내려가지만 **git 히스토리는 그렇지 않다**
- `--refetch`는 기존 파일을 지우지 않고 **`.bak-<stamp>`로 옮긴다**
- 파일명에 `:`를 쓰지 않는다 (Windows)

#### ⓔ 부하 규율 — **확정값. 🚨 값이 없으면 돌리지 않는다**

`CLAUDE.md`가 「Serial requests, concurrency 1, an explicit request cap, and an abort-after-N-failures rule are **required before any run**」을 걸었다. **상대가 정해 주지 않았으므로 우리가 정한다** — `robots.txt`가 404라는 것은 **아무 말도 하지 않았다**는 뜻이다.

| 항목 | 확정값 | 근거 |
|------|--------|------|
| **동시성** | **1. 직렬.** 다음 요청은 이전 **응답이 끝난 뒤** 시작한다 | `CLAUDE.md` 명시 |
| **요청 간격** | **3초 + 0~1초 지터** | 사람이 목록 한 페이지(20장)를 훑고 다음을 누르는 데 3초보다 짧게 걸리기 어렵다 |
| **전체 요청 상한** | **인자로 반드시 준다. 기본값을 두지 않는다** — `--max-requests`가 없으면 **시작을 거부한다** | 🚨 **기본값을 주면 그 값이 「승인된 값」으로 굳는다.** 요청 범위는 사람이 승인한다 |
| 첫 실행 권장값 | 1세트 · 상한 **12** | |
| ★ **페이지 수를 인자로 받지 않는다** | `--pages` 같은 인자를 두지 않는다 | **page 0 응답의 `a.pagi_last`가 마지막 인덱스를 준다** |
| **재시도** | 같은 URL **최대 2회**, 백오프 **10초 → 30초**. **5xx·타임아웃만** | 4xx는 다시 받아도 같다. 재시도로 부하만 는다 |
| 🚨 **403은 재시도하지 않고 즉시 전체 중단** | 사람이 읽을 때까지 다시 돌리지 않는다 | **403은 상대가 처음으로 말을 한 것이다.** §4.4.1의 상태가 「근거 없음」에서 **「명시된 거부」**로 바뀐다 |
| 🚨 **429도 즉시 전체 중단** | 403과 같은 취급. 백오프 후 재개하지 않는다 | 응답 헤더에 rate limit 신호가 **하나도 없는 것을 확인했다** |
| **연속 실패 중단** | **N = 3.** 재시도까지 소진한 URL이 3개 연속이면 중단 | 2는 우발적 흔들림에도 걸리고, 5면 그 사이 15회를 더 때린다 |
| **재실행** | 중간 파일에 이미 있는 **(세트, 페이지)** 조합은 건너뛴다. 다시 받으려면 `--refetch`를 **명시** | 「한 번 받은 것을 다시 받지 않는다」 |
| **`robots.txt` 사전 확인** | 매 실행 시작에 **1회**. **404가 아니면 즉시 중단**하고 사람이 읽는다. 이 1회는 상한에 세지 않는다 | ★ **부하 규율보다 중요할 수 있는 장치다** |
| 🚨 **그 판정은 「상태 코드로만」 한다** | `res.status !== 404` → 중단. **본문을 보지 않는다** | 본문 기반 판정(길이 · 문자열 포함)을 넣지 않는다 |
| **호스트 화이트리스트** | `onepiece-cardgame.kr` 외의 호스트로는 **요청 자체가 나가지 않는다** | 「Source scope is fixed」를 **문서가 아니라 코드로** 강제한다 |
| ⚠️ **`size`는 20 고정. `--size` 인자를 두지 않는다** | 상대가 자기 UI에서 내보내지 않는 크기를 요구하지 않는다 | ★ **상한 탐색 자체가 「평소보다 큰 요청을 일부러 던지는」 행위다 — 일부러 하지 않았다** |

**User-Agent — 속이지 않는다.** 값은 `DeckBinder-CatalogBot/0.1 (<연락 가능한 주소>)`. **브라우저 UA를 흉내 내지 않는다** — 우리는 브라우저가 아니고, 아닌 것을 맞다고 보내는 것이 속이는 것이다. `Accept-Language: ko` 하나를 더한다.

★ **연락처를 넣는 것은 「묻는 것」이 아니다 — 방향이 반대다.** §0.1 ⓒ가 폐기한 것은 **허락을 구하는 행위**이고, UA의 연락처는 **상대가 원하면 멈추라고 말할 수 있게 하는 것**이다.

#### ⓕ 임포트 단의 실패 모드 · **§9.2 ⓒ 전제 3 유지**

- **기본은 insert-only.** `--update`를 줘야 갱신하고, **갱신 가능 컬럼은 화이트리스트**다
- 🚨 **`/api/admin/*`에 엔드포인트를 0개 만들고 DELETE 경로가 없다** — §9.2 ⓒ 전제 3(관리자 API 파괴 표면 동결)이 깨지지 않는다
- **다른 세트에 이미 있는 코드는 `skip:other_set`으로 센다.** 조용히 옮기지 않는다
- 🚨 **`name_ja`를 한국어명으로 채우는 경로를 만들지 않는다.** 오염이 조용하고 늦게 발견되며 화면에는 정상으로 보인다
- **세트 적재 순서: `OPK` → `EBK` → 프로모션 → `STK`.** 근거는 **재현 가능성**이지 「원판이 옳아서」가 아니다

#### ⓖ 드라이런의 정의 — **무엇을 출력하면 드라이런인가**

「쓰지 않는 실행」이 아니라 **「사람이 다섯을 판단할 수 있는 출력」**이다: **4부 구성 + 샘플 5건 전문.** 🚨 **사람이 리포트를 읽는 것이 전제다** — 출력이 잡음에 파묻히면 이 전제가 무너진다.

#### ⓘ 테스트 전략 — **네트워크를 타는 코드에 §7을 그대로 적용하지 않는다**

⚠️ **네트워크·DB를 타는 테스트를 만들지 않는다.** 저장본 픽스처로 재현한다. **`pace.ts`가 가장 중요한 테스트 대상이다** — 부하 규율이 코드로 지켜지는지를 그 파일이 진다. 파서는 **0건이면 스스로 중단**한다(자기 검증).

### §4.9 도감 「관련 카드」 — 두 축 계약 (T2.13)

#### ⓐ 🚨 절반은 이미 구현돼 있다 — **다시 설계하지 않는다**

「같은 카드의 다른 버전」축은 `similar-cards.tsx` + `fetchCardAlternatives`로 **이미 산다.** T2.13은 **세트 축만** 만든다.

| 판정 | 내용 |
|---|---|
| ⓑ **어디에** | **세트 전용 라우트 `/sets/[setId]`를 새로 낸다.** 🚨 **`[setId]`는 uuid다** — `card_sets.code`가 게임을 가로질러 유일하다는 보장을 확인하지 못했다. 세트가 없으면 `notFound()` |
| ⓒ **한 영역인가 두 영역인가** | **두 영역. 탭으로 묶지 않는다**(§4.6) — 「덱에서 바꿔 쓸 수 있다」와 「같이 나왔다」는 뜻이 전혀 다르다 |
| ⓓ **규모** | **미리보기 12장 + 「전체 N장 보기」.** 전체는 **페이지당 60장 오프셋 페이지네이션**. 🚨 **커서를 쓰지 않는다** — §2.7-9(커서 키 ≠ 유니크 키)를 건드리지 않는 것이 이 선택의 목적이다. **정렬 옵션을 넣지 않는다**(B-5가 딸려 온다) |
| ⓔ **쿼리와 성능** | **RSC가 직접 조회한다. API 라우트를 만들지 않는다.** `src/lib/cards/queries.ts`에 함수 3개를 더한다. `count: "exact"`로 직접 센다 |
| ⓕ | 현재 보고 있는 카드를 미리보기에서 **빼지 않고 표시로 구분한다** |

### §4.10 전 범위 카탈로그 수집 — 계열 단위 실행 계약 (T1.24 · T1.25 — ✅ 완료)

| 항목 | 계약 |
|---|---|
| ⓐ 🚨 **`--max-requests`는 계열 전체의 총 상한이다** | **세트당 상한이 아니다.** `PaceState`는 프로세스당 **정확히 1개**다. 세트당으로 두면 **사람이 승인한 숫자와 상대가 받는 요청 수가 갈린다** |
| ⓑ **부하 규율의 적용 범위** | 값은 §4.8 ⓔ 그대로, 범위만 정한다 — `robots.txt`는 **세트 경계마다** 확인하고 **상한 밖으로 따로 센다**. `--refetch`는 **2세트 이상에서 거부**한다 |
| ⓒ **대상 세트를 누가 정하는가** | **사람이 `--sets`로 나열한다.** 🚨 **접두사 확장을 만들지 않는다. 순서를 재정렬하지 않는다** |
| ⓓ **중단과 재개** | 세트 단위 재실행 로직이 계열로 그대로 합성되지 않는다 — `SeriesProgress` + 계열 매니페스트가 그 조각을 메운다 |
| ⓔ 🚨 **`【프로모션】`** | CLI로 도달 불가라 **예약 코드 `PROMO`**로 연다 |
| ⓕ **계열별 권장 상한** | **OPK 120 · EBK 30 · STK 50 · PROMO 5 = 총 205** (+ 상한 밖 `robots.txt` 40회). ⚠️ **실측 2점 · 나머지는 추정.** 추정이 빗나가는 방향이 안전하도록 잡았다 |
| ⓖ **모듈 경계** | 새로 생기는 판단 셋은 **`src/lib/catalog/series.ts`**에. `scripts/`는 배선 |
| ⓗ 🚨 **T1.16을 다시 열지 않는다** | **T1.16이 고정한 58건이 하나도 수정되지 않고 통과하는 것**이 이 절의 완료 기준이다. ⚠️ **예외는 없다** — 고쳐야 하는 케이스가 나오면 그것이 T1.16을 다시 여는 신호다 |

### §4.11 카탈로그 임포트 구현 계약 (T1.18 — ✅ 완료)

> **40세트 3,146행 전수 실측 위에 서 있다.** 🚨 **이 절을 쓰는 동안 「표본을 전량으로 착각한 판정」이 세 번 뒤집혔다. 그것 자체를 규율로 남긴다.**

#### ⓑ 모듈 경계 — 판단은 `src/lib/catalog/`, `scripts/`는 배선

순수 함수 넷: **`normalize`** · **`plan`** · **`report`** · **`gate`**. 🚨 **집계도 여기 둔다 — `scripts/`에서 세지 않는다.**

#### ⓒ 공개 함수 시그니처 (요지)

```ts
normalizeCard(raw: CollectedCard, ctx): NormalizeResult          // 17필드 → CardRowDraft + issues
buildImportPlan(input: BuildImportPlanInput): ImportPlan          // 행별 RowVerdict + ColumnChange
summarizePlan(plan: ImportPlan): ImportReport                     // 집계 전량
renderReport(report: ImportReport): string                        // 드라이런 4부 출력
checkApplyGates(input: ApplyGateInput): GateFailure[]             // --apply 관문
shouldAbortApply(consecutiveFailures: number): boolean            // CONSECUTIVE_FAILURE_LIMIT = 10
pickLatestDump(files: DumpFileFact[]): DumpFileFact | null        // DUMP_MAX_AGE_MS = 24h
distributeLifeCost(...)                                           // LIFE_CARD_TYPES / COST_CARD_TYPES
```

#### ⓔ `card_sets` 행을 누가 만드는가 — **사람이 미리 만든다. 임포터는 upsert하지 않는다. PROMO도 예외가 아니다**

🚨 **프로모 카드는 별도 `card_sets` 행이다. 코드 접두사로 세트를 추론하지 않는다 — 파일(디렉토리명)이 곧 세트다.** 세트 이름은 `name_ko`에 넣는다(`name_ja`가 아니다).

#### ⓕ 수치 표기 4종 — `validation/catalog.ts`를 **넓힌다.** 규칙을 바꾸는 것이 아니다

전각 숫자 · 소수점 · `+` 접두 · `-` 표기를 **고정된 순서로** 정규화한다. 순서를 바꾸면 결과가 달라진다.

#### ⓖ 드라이런과 `--apply` 관문

**관문 4종** — 신선한 덤프(**24시간 이내**) · sha256 · game · set · mode 일치. 🚨 **`npm run db:dump` 없이 `--apply`가 통과하지 않는다**(`CLAUDE.md` · §9.2 ⓑ). 무효 비율 **5%** 초과면 경고.

#### ⓗ 실패 모드 · 멱등성 · 트랜잭션 경계

**연속 실패 10회면 중단한다.** 부분 적용이 남으면 리포트가 어디까지 갔는지 적는다. 재실행이 같은 결과를 내야 한다.

#### ⓘ 집계와 보고 — **전부 `report.ts`에**

🚨 **「0건은 초록이 아니다」** — 0건과 성공을 같은 모양으로 출력하지 않는다.

#### ⓓ JSONL 17필드 → `cards` 컬럼 매핑

**대조 대상은 마이그레이션 008 적용 후의 실제 스키마다**(`src/types/database.ts` · `supabase/migrations/20260829000008_card_performance_columns.sql`을 직접 읽고 대조했다).

| # | JSONL 필드 | `cards` 컬럼 | 변환 | 실측(3,146행) · 근거 |
|---|-----------|--------------|------|----------------------|
| 1 | `code` | **`code`** | trim. **대소문자 원문 보존** | 🚨 `base_code`는 **생성 컬럼**(005)이라 **쓰지 않는다.** 쓰면 `428C`로 거절된다 |
| 2 | `nameKo` | **`name_ko`** | 빈 문자열 → `null` | `name_ko`는 nullable(002) |
| — | (없음) | **`name_ja`** | **항상 `null`** | §4.8 ⓕ ★★. **타입이 `null` 리터럴이라 값을 넣는 코드가 컴파일되지 않는다** |
| 3 | `cardType` | **`card_type`** | 원문 그대로 | 4종 + **빈 문자열 4건 → `invalid`**(ⓓ-3) |
| 4 | `colorRaw` | **`colors text[]`** | `,` split · trim · 빈 항목 제거 | 최대 3개. **「다색」도 원소로 넣는다**(ⓓ-4) |
| 5 | `lifeRaw` | **`life` 또는 `cost`** | `cardType`으로 분배(ⓓ-2) | §4.8 ⓗ #8이 T1.18에 넘긴 판정 |
| 6 | `powerRaw` | **`power`** | 수치 정규화(ⓕ) | `-` 343행 → `null` |
| 7 | `counterRaw` | **`counter`** | 수치 정규화 + **`+` 접두 제거** | `-` 1,164행 → `null` · `+1000`/`+2000` 105행 |
| 8 | `attribute` | **`attribute`** | trim. `""`·`-` → `null`. **`?`와 `/` 복합값은 원문 그대로**(ⓓ-5) | 빈값 378 · `-` 35 · `?` 2 · 복합 18 |
| 9 | `traitsRaw` | **`traits text[]`** | `/` split · trim · 빈 항목 제거 | 1~3개 |
| 10 | `rarity` | **`rarity`** | trim. `""` → `null` | 8종(P 108 포함) |
| 11 | `effectText` | **`effect_text`** | 이미 `\n` 정규화됨. `""` → `null` | 빈값 187행 = 정상 |
| 12 | `triggerText` | **`trigger_text`** | 같음 | 빈값 2,651행 = 정상 |
| 13 | `illustrationType` | **`illustration_type`** | 원문 그대로 | **4종** |
| 14 | `blockNumberRaw` | **`block_number`** | 수치 정규화 | 빈값 35행 → `null` · `1`도 있다 |
| 15 | `imagePath` | 🚨 **`source_image_url`** | `new URL(path, CATALOG_ORIGIN)` (`validation/catalog.ts`가 이미 한다) | 🚨 **`image_url`이 아니다.** 임포터는 `image_url`을 **읽지도 쓰지도 않는다**(§8 T1.18 ⓕ ★★ — 두 스크립트가 같은 컬럼을 쓰면 재실행이 자체 호스팅 경로를 원천 URL로 되돌린다) |
| 16 | ❌ **`sourceSetLabel`** | **매핑 없음** | 버린다 — 단 **리포트에 고유값 목록을 찍는다**(ⓓ-6) | PROMO 276행에 고유값 **83개**. **세트 판정에 쓰면 안 된다** |
| 17 | ❌ **`page`** | **매핑 없음** | 버린다 | 중간 파일의 재수집 skip 판정 전용(§4.8 ⓚ-2) |

**임포터가 채우지 않는 `cards` 컬럼과 그 이유.** `id`·`created_at`·`updated_at`(DB 기본값 · `cards_touch_updated_at` 트리거) · `base_code`(생성 컬럼) · `name_ja`(위) · `name_en`(원천에 없다) · `sub_type`(§4.0이 `basic_energy` 판정 전용으로 못박았고 원피스에는 해당 값이 없다 — **`traits`를 여기 넣지 않는다**) · `image_url`(T1.22) · `search_vector`(트리거). **`game_id`·`set_id`는 조회 결과로 채운다**(ⓔ).

**ⓓ-1 `card_keywords`를 건드리지 않는다.** §4.8 ⓕ가 「1차 적재에서는 키워드 태깅을 하지 않는다 — 원천이 우리 `keywords` 코드 체계를 모른다」고 이미 정했다. **T1.18은 `card_keywords`에 0행을 쓴다.** 그러면 §4.8 ⓕ의 「키워드 연결 실패 → 카드를 되돌린다」 조항은 **T1.18에서 발동할 경로가 없다** — 조항을 지우지 않고 **「관리자 폼 경로에만 남는다」로 범위를 적어 둔다.**

#### ⓔ-2 ★★ 사람이 40행을 어디를 보고 치는가 — 원천 재방문 0회 참고표

> 🚨 **이 표를 지우지 않는다. `data/`가 gitignore라 원천 세트 라벨의 유일한 커밋본이다** — 지우면 복구에 원천 요청 약 3,000회가 든다.
- **그래도 막히지 않는다:** `card_sets.released_at`은 마이그레이션 001부터 **nullable(`released_at date`)**이고, 009가 더한 `card_sets_name_present_ck`도 이름 두 컬럼만 본다. **비워도 §4.8/§4.11의 어느 조항도 걸리지 않는다.**

**판정 4 — PROMO 한 행만 규칙 바깥이고, 그래도 손댈 것이 없다.** `sourceSetLabel`이 **`【프로모션】`**이다 — 대괄호가 아니라 `【】`이고 **안에 코드가 없다.** 판정 2의 「`[코드] ` 제거」가 적용될 대상 자체가 없으므로 **원문을 그대로 넣는다.** `code`는 예약 코드 `PROMO`다(§4.8 ⓔ).

> **표 쓰는 법.** `/admin/sets`에서 40번 입력한다. **`code`와 `name_ko` 두 칸만 채우고 `name_ja`·`released_at`은 비운다**(009가 그것을 허용하려고 나왔다). **입력 순서는 이 표의 순서 = 적재 순서(`OPK`→`EBK`→PROMO→`STK`)로 두는 것을 권한다** — 순서가 결과를 바꾸는 것은 `cards` 적재이지 세트 생성이 아니지만(§4.8 ⓕ ★4), **같은 순서로 두면 사람이 어디까지 했는지 세기 쉽다.**

| code | name_ko (제안값) |
|------|------------------|
| `OPK-01` | 부스터 팩 ROMANCE DAWN |
| `OPK-02` | 부스터 팩 정상결전 |
| `OPK-03` | 부스터 팩 강대한 적 |
| `OPK-04` | 부스터 팩 모략의 왕국 |
| `OPK-05` | 부스터 팩 신시대의 주역 |
| `OPK-06` | 부스터 팩 쌍벽의 패자 |
| `OPK-07` | 부스터 팩 500년 후의 미래 |
| `OPK-08` | 부스터 팩 두 전설 |
| `OPK-09` | 부스터 팩 새로운 황제 |
| `OPK-10` | 부스터 팩 왕족의 혈통 |
| `OPK-11` | 부스터 팩 신속의 권 |
| `OPK-12` | 부스터 팩 사제의 연 |
| `OPK-13` | 부스터 팩 계승되는 의지 |
| `OPK-14` | 부스터 팩 창해의 칠걸 |
| `EBK-01` | 엑스트라 부스터 팩 메모리얼 컬렉션 |
| `EBK-02` | 엑스트라 부스터 팩 Anime 25th collection |
| `EBK-03` | 엑스트라 부스터 팩 ONE PIECE Heroines Edition |
| `PROMO` | 【프로모션】 ← **판정 4. 원문 그대로다** |
| `STK-01` | 스타트 덱 밀짚모자 일당 |
| `STK-02` | 스타트 덱 최악의 세대 |
| `STK-03` | 스타트 덱 왕의 부하 칠무해 |
| `STK-04` | 스타트 덱 백수 해적단 |
| `STK-05` | 스타트 덱 ONE PIECE FILM edition |
| `STK-06` | 스타트 덱 해군 |
| `STK-07` | 스타트 덱 빅 맘 해적단 |
| `STK-08` | 스타트 덱 Side 몽키 D. 루피 |
| `STK-09` | 스타트 덱 Side 야마토 |
| `STK-10` | 얼티밋 덱 "삼선장" 집결 ← ⚠️ **「스타트 덱」이 아니다. 큰따옴표도 원문이다** |
| `STK-11` | 스타트 덱 Side 우타 |
| `STK-12` | 스타트 덱 조로 & 상디 |
| `STK-13` | 스타트 덱 3형제의 유대 |
| `STK-14` | 스타트 덱 3D2Y |
| `STK-21` | 스타트 덱 기어5 |
| `STK-22` | 스타트 덱 에이스 & 뉴게이트 |
| `STK-23` | 스타트 덱 적 샹크스 |
| `STK-24` | 스타트 덱 녹 쥬얼리 보니 |
| `STK-25` | 스타트 덱 청 버기 |
| `STK-26` | 스타트 덱 자흑 몽키 D. 루피 |
| `STK-27` | 스타트 덱 흑 마샬 D. 티치 |
| `STK-28` | 스타트 덱 녹황 야마토 |

**특이 케이스 4건 — 표를 훑을 때 눈에 걸릴 것들.** ⓐ **`PROMO`** — 괄호 종류가 다르고 코드가 없다(판정 4). ⓑ **`STK-10`** — 유일하게 「얼티밋 덱」이고 **큰따옴표를 포함한다**(그대로 친다). ⓒ **`STK-15`~`20`이 없다** — 원천에 옵션이 없다(§4.11 ⓖ · 백로그 A-7). **빠뜨린 것이 아니므로 채우려 하지 않는다.** ⓓ **`EBK-02`·`EBK-03`·`STK-05`는 이름에 영문이 섞여 있다** — 원문 대소문자 그대로다(`Anime 25th collection` · `ONE PIECE Heroines Edition` · `ONE PIECE FILM edition`).

> ⚠️ **이 표는 관측의 복사본이지 원천이 아니다.** 원본은 `data/catalog/opcg/<SET>/manifest-*.json`의 `sourceSetLabel`이고, **`data/`는 커밋되지 않는다**(§4.8 ⓓ). 표와 매니페스트가 어긋나 보이면 **매니페스트가 맞다.**

### §4.12 원피스 KR·JP 판 분리 — 스키마 (✅ 마이그레이션 010 · 로컬+원격 적용됨)

| 판정 | 내용 |
|---|---|
| ⓒ **`games.code` 컨벤션** | **`<기본게임>[-<지역>]`.** 원피스는 `opcg-kr` · `opcg-jp` 두 행. 🚨 **판이 하나뿐인 게임은 접미사를 붙이지 않는다**(`ptcg` 그대로) — **원천 미정인 게임에 지역을 붙이면 스키마가 결정을 선취한다.** `check` 제약은 열거형이다 |
| ⓓ 🚨 **판 분리가 도메인으로 새지 않는다 — 이 절의 핵심이다** | **`GameCode`(`"ptcg" \| "opcg"`)는 한 글자도 안 바뀌고**, DB 행 식별자만 새 타입 **`GameRowCode`**(`"ptcg" \| "opcg-kr" \| "opcg-jp"`)가 받는다. 경계는 순수 함수 **`baseGameCode()`** 하나. **`composeGameRules` 시그니처 · `STRUCTURAL` 2항목 · T2.1/T2.2 테스트가 전부 무변경이다.** 「시뮬레이터는 KR인지 JP인지 물을 수 없다」를 문장이 아니라 **타입이** 강제한다 |
| ⓔ **`base_code`/대체 카드는 KR·JP 경계를 넘지 않는다 (지금은)** | 교차 판 대체 카드는 **일부러 미룬다.** 🚨 **스키마가 가능해진 것이지 「해도 된다」가 아니다** |
| ⓕ **`games.base_game`** | 생성 컬럼. 룰 조회가 이 값을 탄다 |
| ⓘ 🚨 **`opcg-jp` 행은 비어 있다.** JP 카드 수집·적재는 하지 않는다 | **원천을 늘리는 것은 §4.4.1을 개정하는 사용자 결정이고, 스키마·코드 준비가 그 결정을 대신하지 않는다** |

**010 적용 절차 — §9.2 ⓑ 그대로.** ⓐ **`npm run db:dump` 먼저** ⓑ 로컬 `db:reset`으로 전량 적용 리허설 ⓒ `npm run db:types` 재생성 ⓓ **원격 적용은 사용자 손**(백로그 E-1의 어긋남 창을 열지 않도록 로컬·원격을 같은 날 맞춘다).

### §4.13 성취감 가치 3축 — 도메인 계약 (T2.14 · T2.15 · T2.16)

> ★★★ **2026-09-03 — 이 절이 컬렉션 가치의 *유일한* 축이다.** 시세(가격) 축은 폐기됐고(§5.7) 이 절은 그 대체재가 아니라 **본체**다.
> **세 축:** ⓐ **자체 희귀도 점수**(🚨 우리 DB의 실재 컬럼만. 새 원천 0개) ⓑ **도감 완성도**(브라우저 localStorage 선행 — 로그인 0 · 테이블 0) ⓒ **PSA 팝수**(⏸ **자리만. 데이터 0행 · 원천 미정** — 백로그 A-8)

#### ⓒ 모듈 경계 — 🚨 **계산은 순수 함수, 저장소는 어댑터. 이 절의 본체다**

| 무엇 | 어디 | 🚨 |
|---|---|---|
| 점수·완성도 **계산** | `src/lib/domain/achievement/{rarity-score,completion}.ts` | **순수.** `window`를 모르고 DB 컬럼 이름도 모른다 |
| **저장소** | `src/lib/collection/owned-store.ts` | **여기만 `localStorage`를 안다.** `domain/`에 두지 않는다 |
| **번역**(DB 컬럼 → 도메인 필드) | `src/lib/cards/queries.ts` (조회 계층) | `rarity`→`rarityLabel` · `illustration_type`→`illustration` · `code !== base_code`→`isAlternatePrinting` |

**왜 가르는가:** 나중에 계정 기반(T3.2)으로 옮길 때 **로직을 두 벌로 만들지 않기 위해서다.** `OwnedCardStore`는 T3.2가 만들 **두 번째 구현**의 인터페이스다.

#### ⓓ 자체 희귀도 점수 — 계약

- 🚨 **모르는 라벨은 `null`이다. `0`이 아니다** — `score === null` · `undecidable === "rarity_unknown"`. **0점은 주장이다**
- **`reasons`가 값으로 나온다.** 화면이 문장을 짓지 않는다
- **`population`(PSA 팝수)은 선택 인자다** — 🚨 **아예 넘기지 않는 테스트가 전량 통과하는 것이 「자리만 만들었다」의 유일한 증거다**
- ★ **정수 가드가 있다**(`Number.isInteger`) — 부등호 셋만으로는 `NaN`·`Infinity`가 전부 빠져나가 점수가 `NaN`이 된다. 클램프도 `NaN`을 못 막는다

#### ⓔ 도감 완성도 — 계약. 🚨 **계산과 저장소를 가른다**

- 🚨 **저장 키는 `cards.code`이고 `<gameCode>:` 접두가 붙는다. uuid가 아니다** — ⚠️ **재적재가 사용자의 체크를 지우지 않게 하는 유일한 장치다**
- **게임별로 키를 쪼개지 않고 단일 키 하나에 접두 붙은 항목을 담는다.** 쪼갰으면 항목의 접두가 중복이 된다. `clear()`도 이 게임 몫만 지운다
- 🚨 **`localStorage` 접근 전부가 `try/catch` 안이다** — 속성 접근 · 읽기 · 쓰기 셋 다. `typeof window` 검사 하나로 끝내면 멈춘다
- ★ **쓰기가 `QuotaExceededError`를 던지면 `available`을 `false`로 내린다.** 던지지 않기만 하면 그것이 정확히 「조용히 버린다」가 된다
- 🚨 **`strays`(우리 카탈로그에 없는 체크)를 버리지 않고 센다**
- 🚨 **묻는 것은 「가졌는가」 하나다** — ❌ 수량 · 상태 등급 · 구매가 **0개.** ⚠️ **셋 중 하나라도 넣으면 `localStorage`에 스키마가 쌓이기 시작한다**
- **한계 4가지를 화면에 정직하게 적는다** — 기기 변경 · 브라우저별 분리 · 시크릿 창 · 데이터 삭제

#### ⓕ PSA 팝수 — 🚨 **자리만 만들고 데이터는 비운다**

| 항목 | 상태 |
|---|---|
| **원천** | ⏸ **미정.** ✅ 조사는 끝났다(`docs/crawler-compliance.md` §11) — **판정: 「열림, 그러나 스코프 불일치」.** 공식 API는 실재하나 **cert 번호 단건 조회**만 주고 **팝수를 주지 않는다** |
| **남은 물음 넷** | EUA 본문 · `robots.txt` 존재 여부(⚠️ **403이라 못 본 것이지 404로 확인된 부재가 아니다**) · 무료 호출 한도 · 팝수를 얻는 다른 공식 경로. **넷 다 HTTP 403 — 사람이 브라우저로 여는 경로만 남았다** |
| ★ **API가 열려도 남는 공백 둘** | 🚨 **`cards`에 PSA와 이어 붙일 키가 없고, PSA가 원피스 한국판을 어떻게 색인하는지도 모른다.** ⚠️ **「토큰만 받으면 팝수가 들어온다」가 성립하지 않는다** |
| 🚨 **`POPULATION_POINTS = 0` 같은 상수를 만들지 않는다** | 그 자리가 「채우기만 하면 되는 칸」으로 보인다. **값이 올 날 표에 줄이 하나 는다 — 그날까지 자리는 타입에만 있다** |
| 🚨 **판정이 「열림」이어도 그날 구현하지 않는다** | **원천을 늘리는 것은 §4.4.1을 개정하는 사용자 결정**이고 스키마·코드 준비가 그 결정을 대신하지 않는다 |

#### ⓖ 화면 노출 규칙 — 🚨 **P6의 직접 집행 자리다**

1. 🚨 **화폐 단위(원 · 엔)로 표기하지 않는다** — 폐기된 시세 축을 화면이 몰래 되살리는 것이다
2. **「우리가 만든 값」 고지가 화면에 있다.** `reasons`를 값으로 받아 그린다 — 화면이 문장을 짓지 않는다
3. 🚨 **시계열 그래프로 그리지 않는다** — 없는 히스토리가 있는 것처럼 보이게 하는 것이다
4. **`score === null`이면 「산출 불가」를 그린다. 자리를 비우지 않는다**(§2.8-1)
5. **정렬 옵션을 만들지 않는다**
6. ❌ **일괄 내보내기(export) API를 만들지 않는다**

#### ⓗ 테스트 — 케이스 전량

**희귀도 점수 11건 · 도감 완성도 7건 · 저장소 어댑터 6건.** 🚨 **`localStorage`가 던지는 환경을 실제로 흉내 낸 테스트가 있다.** 🚨 **테스트가 점수 리터럴을 손으로 적지 않고 아래 불변식 다섯을 단언한다** — 합 100 · 서열 단조 · 밴드 한 칸·무강등 · `null` 규칙 · 팝수 무인자.

#### ⓓ-1 시그니처 — 자체 희귀도 점수

```ts
// ── src/lib/domain/achievement/rarity-score.ts ──────────────────────────
// 🚨 카드 DB 타입 import 금지 (§4.7 ⓓ · eslint가 문다). 전부 원시값이다.

/** 한 인쇄본에 대해 우리가 아는 것. 🚨 모르는 것은 넣지 않는다 — 옵셔널로도. */
export interface PrintingFacts {
  /** 원천이 붙인 레어도 라벨. 실측 8종이나 **도메인은 그 목록을 모른다**(ⓓ-4). */
  readonly rarityLabel: string | null;
  /** 일러스트 구분(실측 `오리지널`·`원작`). 미관측 값이 올 수 있다. */
  readonly illustration: string | null;
  /** 같은 카드의 다른 인쇄본인가(§4.6). 🚨 도메인은 `_P1` 규칙을 모른다. */
  readonly isAlternatePrinting: boolean;
  /** 같은 base_code를 공유하는 인쇄본 수. **자기 자신을 포함한다.** ≥ 1 */
  readonly printingsInGroup: number;
  /** 같은 세트에서 같은 rarityLabel을 가진 행 수. **자기 자신을 포함한다.** ≥ 1 */
  readonly peerCount: number;
  /** 그 세트의 총 행 수. ≥ 1. 🚨 「발매된 카드 수」가 아니라 **우리가 가진 행 수**다. */
  readonly setSize: number;
}

/** 🚨 팝수는 **별개 인자**다. 없어도 점수가 나온다 — ⓕ. */
export interface PopulationFacts { readonly graded: number; readonly gem: number }

export interface RarityScore {
  /** 0~100. 🚨 **모르면 `null`이다. 0이 아니다** — ⓓ-4. */
  readonly score: number | null;
  /** 화면이 그리는 등급. score가 null이면 이것도 null이다. */
  readonly band: "common" | "uncommon" | "rare" | "scarce" | "trophy" | null;
  /** 🚨 **왜 그 점수인지를 값으로 돌려준다.** 화면이 문장을 지어내지 않게 한다 — ⓖ-2. */
  readonly reasons: readonly RarityReason[];
  /** score가 null일 때 왜인지. 그 외에는 null. */
  readonly undecidable: "rarity_unknown" | "set_unknown" | null;
}
export type RarityReason =
  | { readonly kind: "rarity_label"; readonly label: string; readonly weight: number }
  | { readonly kind: "scarce_in_set"; readonly peerCount: number; readonly setSize: number }
  | { readonly kind: "alternate_printing"; readonly printingsInGroup: number }
  | { readonly kind: "illustration"; readonly label: string }
  | { readonly kind: "population"; readonly graded: number };  // ⓕ — 있을 때만

export function rarityScore(
  facts: PrintingFacts,
  population?: PopulationFacts | null,   // 🚨 **선택 인자다**
): RarityScore;

/** 레어도 라벨의 가중치 표. 🚨 **모르는 라벨에 기본값을 주지 않는다 — `null`이다.** */
export const RARITY_WEIGHTS: Readonly<Record<string, number>>;
export function rarityWeight(label: string | null): number | null;
```

#### ⓓ-6 확정값 — 🚨 **숫자의 출처는 이 표 하나다. 두 벌로 만들지 않는다**

| 라벨 | **가중치** | 실측 행 수(3,146 전수 · ⓐ-2) | 점유율 | 사다리 자리 |
|---|---|---|---|---|
| `C` | **5** | 1,026 | 32.6% | 1단 |
| `UC` | **20** | 475 | 15.1% | 2단 |
| `R` | **35** | 639 | 20.3% | 3단 (⚠️ **6-4**) |
| `SR` | **55** | 456 | 14.5% | 4단 |
| `L` | **70** | 252 | 8.0% | 5단 |
| `SEC` | **85** | 95 | 3.0% | 6단(최상) |
| `SP` | **85** | 95 | 3.0% | 6단 (🚨 **6-5**) |
| `P` | **60** | 108 | 3.4% | 🚨 **사다리 밖** (**6-6**) |

**어떻게 나온 값인가 — 규칙은 하나뿐이다.** 원천이 붙인 서열 6단(`C` < `UC` < `R` < `SR` < `L` < `SEC`·`SP`)을 **5~85 구간에 등간(16점)으로 놓고 5의 배수로 반올림했다** — 5 · 21 · 37 · 53 · 69 · 85 → **5 · 20 · 35 · 55 · 70 · 85**. 🚨 **점유율은 값을 *만들지 않았다*. 검산에만 썼다**(6-4). ⚠️ **그래서 이 표는 「우리가 발명한 서열」이 아니라 「원천의 서열에 눈금을 붙인 것」이다** — 판정 1이 요구한 그대로다.

**6-2. 축 합성 — 🚨 합이 정확히 100이다. 그것이 이 값들을 묶는 유일한 불변식이다.**

| 축 | 상수 | 폭 | 규칙 |
|---|---|---|---|
| **1차 — 라벨** | `RARITY_WEIGHTS` | **0~85** | 표 조회. 🚨 **정확 일치만 한다**(6-8) |
| **2차 — 세트 안 희소** | `SCARCITY_MAX_POINTS = 10` | **0~10** | `10 × (1 − peerCount / setSize)`. 🚨 **`peerCount === setSize`면 정확히 0이다** — ⓗ 테스트 ⑤가 이 식에서 자동으로 성립한다 |
| **3차 — 인쇄본** | `PRINTING_ALTERNATE_POINTS = 4`<br>`PRINTING_GROUP_POINTS = 1` | **0~5** | `isAlternatePrinting`이면 **+4**, `printingsInGroup ≥ 2`면 **+1**(둘은 겹쳐서 붙는다) |
| **일러스트** | — | **0** | 🚨 **점수에 더하지 않는다. `reasons`에만 나온다**(6-7) |
| **팝수** | — | **0** | 🚨 **상수를 만들지 않는다**(6-7) |

- **최댓값 대조: 85 + 10 + 4 + 1 = 100.** ★ **이 합이 100이라는 것을 테스트가 단언한다** — 🚨 **값을 고치다 100을 넘기면 그 자리에서 깨진다. 그것이 「값은 고칠 수 있고 모양은 못 깨는」 장치다**(6-9).
- **반올림은 마지막에 한 번**(`Math.round`), 그 뒤 `[0, 100]`으로 클램프한다. ⚠️ **클램프는 방어이지 설계가 아니다** — 위 대조가 성립하면 클램프는 발동하지 않는다.
- 🚨 **점수의 실질 하한은 5다. 0이 나오지 않는다.** ⚠️ **0은 ⓓ-4가 「가장 흔한 카드라는 *주장*」이라고 부른 값이고, 라벨을 아는 카드에는 그 값을 주지 않는다.** 라벨을 모르면 0이 아니라 `null`이다 — **두 상태가 값에서도 갈린다.**
- **3차 축이 왜 두 조각인가:** **+4**는 「이 인쇄본이 기본 인쇄본이 아니다」(§4.6이 이미 화면에서 가르는 축), **+1**은 「이 카드에 인쇄본이 여럿이다 = 수집 축이 하나 더 있다」. 🚨 **덕분에 ⓗ 테스트 ⑥(패러렐 ≥ 원본: 5 vs 1)과 ⑦(`printingsInGroup` 1 vs >1: 0 vs 1)이 *서로 다른 조각으로* 성립한다** — 한 조각으로 둘을 다 만족시키면 `printingsInGroup`이 사실상 안 쓰이는 인자가 된다.

**6-3. 밴드 경계.**

| 밴드 | 점수 | 이 밴드에 *기본*으로 떨어지는 라벨 |
|---|---|---|
| `common` | **0~14** | `C` |
| `uncommon` | **15~29** | `UC` |

#### ⓔ-1 시그니처 — 도감 완성도 · 저장소 어댑터

```ts
// ── src/lib/domain/achievement/completion.ts ────────────────────────────
// 🚨 순수. localStorage도 fetch도 카드 DB 타입도 모른다.

export interface CompletionInput {
  /** 이 묶음에 속한 카드 키 전량. 🚨 **중복이 있어도 된다 — 함수가 유일화한다.** */
  readonly universe: readonly string[];
  /** 사용자가 가졌다고 표시한 키. universe 밖의 값이 섞여 있어도 된다. */
  readonly owned: readonly string[];
}
export interface CompletionResult {
  readonly total: number;
  readonly ownedCount: number;
  /** 0~1. 🚨 **total이 0이면 `null`이다 — 0/0을 1이나 0으로 만들지 않는다.** */
  readonly ratio: number | null;
  readonly missing: readonly string[];
  /** 🚨 universe 밖인데 owned에 있는 것. **버리지 않고 센다** — ⓔ-4. */
  readonly strays: readonly string[];
}
export function completion(input: CompletionInput): CompletionResult;
```

```ts
// ── src/lib/collection/owned-store.ts ───────────────────────────────────
// 🚨 여기만 브라우저를 안다. 계산은 위 모듈이 한다.

/** ★ T3.2가 계정 기반으로 다시 구현할 인터페이스. **이 모양을 지금 고정하는 것이 이 절의 목적이다.** */
export interface OwnedCardStore {
  read(): Promise<readonly string[]>;
  add(keys: readonly string[]): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  clear(): Promise<void>;
  /** 🚨 저장소가 실제로 동작하는가. **`false`면 화면이 고지한다** — ⓔ-3. */
  readonly available: boolean;
  readonly kind: "local" | "memory" | "account";
}
/** 🚨 **2026-09-01 정정 — 인자가 하나 있다.** 무인자로 적혀 있었으나 ⓔ-1이
 *  「접두를 붙이는 것은 저장소의 일」로 정했고, 저장소가 접두를 붙이려면
 *  게임을 알아야 한다. **인터페이스는 그대로다 — 고친 것은 팩토리뿐이다.** */
export function createLocalOwnedStore(gameCode: string): OwnedCardStore;
/** localStorage에 손도 못 댈 때의 착지점. 🚨 **던지지 않는다.** */
export function createMemoryOwnedStore(): OwnedCardStore;

/** 게임을 가로지르는 **단일 키**. 🚨 게임별로 쪼개지 않는다 — 쪼개면
 *  항목의 `<gameCode>:` 접두가 중복이 되고, 접두가 존재하는 이유가
 *  「한 통에 섞여 담긴다」이기 때문이다(§4.9 ⓑ와 같은 미확인). */
export const OWNED_STORAGE_KEY = "deckbinder.owned.v1";
```

## 1.11 API 명세

### §5.1 Route Handlers (`src/app/api`)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/cards` | 도감 검색. `q, game, set, rarity, attribute, cardType, keywords[], cursor, cursorId, limit`. **키워드는 AND(모두 보유)**. 커서는 `(code, id)` 튜플 (007) | — |
| GET | `/api/cards/facets` | 필터 선택지(레어도 · 속성 · 종류 · 세트 · 키워드). `game`으로 좁힌다 | — |
| GET | `/api/cards/:cardId` | 상세 | — |
| GET | `/api/cards/:cardId/alternatives` | 동일 `base_code` 카드 목록 (현재는 상세 RSC가 직접 조회) | — |
| ★ | ~~`/api/sets/:setId/cards`~~ | **만들지 않는다.** 세트 축은 **RSC가 직접 조회한다** — `alternatives`와 같은 선례 (§4.9 ⓔ) | — |
| GET | `/api/decks` · `/api/decks/:deckId` | 레시피 목록 · 상세 (T2.4) | — |
| POST · PATCH · DELETE | `/api/decks[/:deckId]` | 사용자 덱 저장 · 수정 · 삭제. 소유자만 | ✅ |
| GET · POST | `/api/collection` | 내 컬렉션 조회 · 카드 추가(소장 / 위시리스트) (T3.2) | ✅ |
| PATCH · DELETE | `/api/collection/:itemId` | 수량 · 상태 변경 | ✅ |
| POST | `/api/binder/share` | 공유 슬러그 발급 / 토글 (T3.5) | ✅ |
| GET | `/api/binder/:slug` | 공개 바인더 조회 | — |
| GET | `/api/news` | 기사 목록 — **아직 만들지 않았다.** 현재 `/news`는 RSC가 직접 조회한다 | — |
| ★ | ~~`/api/achievement/*`~~ | 🚨 **만들지 않는다.** 희귀도 점수는 **RSC가 조회하고 도메인 순수 함수가 계산한다**(§4.13 ⓒ), 도감 완성도는 **브라우저에 있다** | — |

**관리자 API** (`/api/admin/*`) — 전 라우트가 `requireAdmin()` 통과 후 `service_role`로 쓴다 (§4.5).

| Method | Path | 설명 |
|--------|------|------|
| POST / DELETE | `/api/admin/session` | 토큰 로그인 / 로그아웃 |
| POST | `/api/admin/sets` · `/api/admin/keywords` · `/api/admin/news` | 세트 · 효과 키워드 · 뉴스 등록 |
| PATCH · DELETE | `/api/admin/news/:postId` | 뉴스 수정(발행 토글 포함) · 삭제 |
| POST | `/api/admin/cards` | 카드 등록 (`keyword_ids` 포함. 연결 실패 시 카드를 되돌린다) |
| PATCH / DELETE | `/api/admin/cards/:cardId` | 수정 · 삭제. **PATCH는 `keyword_ids`를 받아 태그를 전량 교체한다.** 삭제는 하드 삭제(§9.10) |

> **키워드 재태깅은 앱 레벨 보상 트랜잭션이다.** 이전 `keyword_id` 목록을 읽어 두고 → `delete` → `insert`, insert가 실패하면 읽어 둔 목록을 되돌려 넣는다. 마이그레이션이 필요 없다.

**🚨 금지 엔드포인트 — 설계상 만들지 않는다.**

`GET /api/cards/:id/price-history` · `POST /api/market/batch` · `GET /api/cards/export` · 공개 API 키 발급 · ★ **`GET /api/achievement/scores`(점수 전량)** · ★ **`GET /api/collection/export`(컬렉션 전량)**

> ⚠️ **뒤의 둘 — 「무엇이 귀한지」의 전량 목록과 「누가 무엇을 가졌는지」의 전량 목록은 한 번의 요청으로 나가지 않는다.**

> ★★★ **카드 이미지 프록시를 Next 라우트 핸들러로 만들지 않는다.** 워커에 둔다 — §1 P2(외부 접근은 Workers에서만)와 킬 스위치 요건(§3.5) 때문이다.

### §5.2-A Image Proxy Worker API (계약 전문은 §3.5)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/img/:source/:id` | 카드 이미지 리버스 프록시. `:source`는 **`opcg-kr` 하나**(§4.4.1 원천 고정) · `:id`는 `downname` **3형식만**. 🚨 **`Content-Type`은 `sniffImageFormat()`이 정한다** |
| GET | `/health` | 상태 확인 |

**금지** — 🚨 **클라이언트가 URL·호스트를 주는 형태(`?url=` · `?host=` · `?w=`)를 만들지 않는다.** 그 한 줄이 오픈 릴레이 방어의 겹 0이다(§9.4 ⓖ-3).

> **시뮬레이터에는 API를 두지 않는다** — `src/lib/domain/simulator`의 순수 함수로 클라이언트에서 실행한다(무지연 + 서버 부하 0 + 단위 테스트 용이).

> 🚨 **폐기된 §5.2 · §5.3 · §5.4** — 매물 Worker API · 매물 검색 시퀀스 · 되팔이 방지 다층 방어는 **2026-09-03 시세 축 폐기와 함께 삭제됐다**(§5.7). 설계 원문은 `plan-archive.md`에 있다. **번호를 재사용하지 않는다.**

## 1.12 환경 변수 (§6)

```
# .env.local (gitignore 대상 / 저장소에는 .env.example만 커밋)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 서버 전용. NEXT_PUBLIC_ 접두사 금지
NEXT_PUBLIC_SITE_URL=             # sitemap.xml · OG · 정규 URL이 전부 이 값을 쓴다

ADMIN_TOKEN=                      # 코드 하한은 16자, 운영 규격은 43자 난수 — §9.2 ⓐ
NEXT_PUBLIC_ADSENSE_CLIENT=       # 비워 둔다 — 값을 넣는 순간 광고가 렌더된다 (§9.1)
                                  #   제거는 백로그 E-2(조건부 보류)

SUPABASE_DB_PASSWORD=             # 로컬 CLI 전용(link / db push). 앱 런타임 미사용

# 이미지 리버스 프록시 (§3.5 · §9.4 ⓖ)
NEXT_PUBLIC_IMAGE_PROXY_BASE=     # 예) https://img.deckbinder.example
                                  # 🚨 proxiedImageUrl()이 **인자로** 받는다. 모듈에 박지 않는다
                                  # 비어 있으면 화면은 폴백 100%다 — 깨지지 않고 이미지만 안 뜬다
```

**워커 쪽 시크릿은 `.env.local`이 아니라 `wrangler secret`에 둔다** — 앱과 배포 단위가 다르다.

| 이름 | 워커 | 설명 |
|---|---|---|
| `IMAGE_PROXY_ALLOWED_HOSTS` | image-proxy | `onepiece-cardgame.kr`. 🚨 **비우면 `decideHost()`가 전부 거부한다 — 배포 단위 킬 스위치** |
| `IMAGE_PROXY_IP_SALT` | image-proxy | 레이트리밋용 IP 해시 |
| (KV 바인딩) | image-proxy | 킬 스위치 플래그. **초 단위로 끄려면 배포가 아니라 KV여야 한다**(§3.5) |

- `src/lib/env.ts`가 클라이언트 변수를, `src/lib/env.server.ts`가 서버 시크릿을 **부팅 시** 검증한다
- 시크릿은 **추적되는 파일(`.gitignore` 포함)에 절대 적지 않는다**
- **시크릿 보관처는 로컬 `.env.local`과 배포 플랫폼의 환경변수 UI 두 곳뿐이다.** 비밀 관리자 도구를 도입하지 않는다(§9.2 ⓐ)

## 1.13 테스트 전략 (§7)

단위 테스트는 소스 옆 `*.test.ts`, E2E만 `tests/e2e`에 둔다.

| 레벨 | 도구 | 대상 | 필수 케이스 |
|------|------|------|-------------|
| 단위 | Vitest | `src/lib/validation` | 검색 파라미터 정규화 · limit 상한 · 관리자 입력의 선택 항목 null 정규화 · **「`name_ko`·`name_ja` 둘 중 하나는 필수」**. 🚨 **기존 케이스를 지우지 말고 고친다 — 규칙이 없어진 것이 아니라 약해진 것이다** |
| 단위 | Vitest | `src/lib/domain` | 시드 셔플 재현성 · 멀리건 후 덱 상태 불변 · 하이퍼기하 확률값(**큰 입력 포함**) · **성취 3축**(희귀도 모르면 `null` · 완성도 분모 0이면 `null` · **PSA 팝수 없이도 성립**). 케이스 전량은 §4.13 ⓗ · §4.7 ⓖ |
| 단위 | Vitest | `src/lib/catalog` | 파서(미닫힌 `<p>` · 엔티티 · `noItems` · 패러렐 코드 보존 · 필드 결측) · **페이싱(연속 3회 중단 · 성공 시 리셋 · 403/429 즉시 중단 · 판정 우선순위)**. ⚠️ **네트워크·DB를 타는 테스트를 만들지 않는다**(§4.8 ⓘ) |
| 단위 | Vitest | `src/lib/validation/card-image` · `workers/image-proxy` | `downname` 3형식 · 호스트 판정 · `sniffImageFormat` · 9단계 순서 · 킬 스위치 · 서킷. **`fetch`는 주입** |
| 단위 | Vitest | `src/components/common` | 에러 경계 폴백 · reset |
| E2E | Playwright | 앱 셸 | 홈 렌더 · 내비 이동 · 타이틀 템플릿 · 다크 모드 토글 |
| E2E | Playwright | 도감 | 검색어 URL 동기화 · URL 복원 · 빈 결과 안내 · 게임 필터 |
| E2E | Playwright | 관리자 | 미인증 접근 차단 · 잘못된 토큰 거부 · API 401 · **세트→카드 등록→도감 반영** · 중복 코드 차단 |

**데이터 의존 금지.** 도감 E2E는 카드가 몇 장 있는지를 전제하지 않는다. 등록 후 반영은 관리자 E2E가 **자기 데이터를 만들어** 검증한다.

**E2E 기준선은 `CI=1`(프로덕션 빌드) 기준으로 잡는다.** `playwright.config.ts`는 `CI`가 있으면 `build && start`로, 없으면 `next dev`로 띄운다. **두 모드는 결과가 다를 수 있다** — 프리페치·정적 프리렌더처럼 프로덕션에만 있는 동작은 dev E2E를 전부 통과해도 그대로 남는다(§2.7-14가 실제 사례이며 배포 환경 사용자도 겪던 버그였다). 🚨 **「몇 건 ✅」을 적을 때는 `CI=1` 실행 결과만 쓴다.** `webServer.timeout`이 300초인 것도 이 경로가 빌드를 포함하기 때문이다.

- **`tests/e2e/global-setup.ts`** — 홈 · 도감 · 뉴스 · 관리자 로그인과 **상세 라우트**를 미리 요청해 첫 컴파일·최초 DB 연결 비용을 스펙 밖으로 밀어낸다. **라우트를 추가하면 워밍업 목록에도 넣는다**
- ⚠️ **serial describe는 통과 건수를 왜곡한다.** 자기 데이터를 만들어 쓰는 spec 4개(`card-detail` · `news` · `cursor` · `filters`)가 serial이라 **앞의 1건이 깨지면 뒤가 통째로 "did not run"** 이 된다. **실패 1건이 실제로는 여러 건의 미검증을 뜻하므로 통과 건수만 보고 판단하지 않는다**

**Developer 규칙:** 각 태스크는 `실패하는 테스트 커밋` → `구현 커밋` 순서를 지킨다 (AGENT.md).

## 1.14 확정 결정표 (§0)

**되돌리려면 근거를 다시 확인해야 하는 결정만 남긴다.** 뒤집힘 이력은 `plan-archive.md`에 있다.

| 결정 | 근거 |
|------|------|
| 지원 TCG는 **포켓몬 + 원피스** 2종 (유희왕 제외) | §4.0 |
| 카드 데이터는 **자체 구축**. 외부 사이트 연동 없음 | §4.4 |
| 참조 원천은 **`onepiece-cardgame.kr` 하나**. 일본 2곳은 배제. **근거는 「허용 확인」이 아니라 「금지 근거를 찾지 못함」이고, 문의 폐기로 그 공백은 영구화됐다** | §4.4.1 · §0.1 ⓒ |
| **`onepiece-cardgame.kr`의 `robots.txt`는 404다. 그것은 「크롤링해도 된다」가 아니라 「아무 말도 하지 않았다」이며, 부하 규율은 우리가 만든다** | §0.1 ⓓ · §4.8 ⓔ |
| `cards`·`card_sets` 모두 **`name_ko`·`name_ja` nullable + `check(둘 중 하나)`**. 🚨 **한국어명을 `name_ja`에 넣는 것은 금지** | §4.4 · §4.8 ⓕ |
| 대체 카드는 `base_code`(생성 컬럼)로 판정. `similar_group_id`는 007에서 제거 | §4.6 |
| 단일 앱 구조(`src/` 4구획). 모노레포 아님 | CLAUDE.md |
| shadcn base는 `radix` (CLI 기본값 `base` 아님) | §2.6 |
| **RLS 정책과 함께 GRANT를 반드시 준다** | §4.1-1 |
| 쓰기 직후 정확성이 필요한 라우트는 **동적(SSR)**. ISR은 전제가 아니다 | §1 P1 · T1.12-7 |
| 시간 조건 RLS(`<= now()`)를 쓰면 앱이 찍는 시각에 **마진을 준다**(`published_at = now - 5초`) | §2.7-20 |
| 관리자 인증은 **T3.1까지 토큰 방식 유지**. 전제 3가지가 붙는다 | §9.2 ⓒ |
| 카탈로그 복구는 **로컬 덤프**로 한다. Supabase 자동 백업에 의존하지 않는다 | §9.2 ⓑ |
| **공식 창구 조사 완료 — 6곳 중 열린 창구 0곳.** 원천 판단 기준을 「금지 근거 부재」에서 옮기지 못했다 | §0.1 ⓐ |
| **권리자 문의 메일을 보내지 않는다.** 초안 4통은 `docs/permission-inquiry-drafts.md`에 보관용 | §0.1 ⓒ · §4.4.1 결정 6 |
| **수익화 — 광고만 열린 선택지다.** 제휴 · 후원 · 유료 기능은 닫혀 있다. 운영비는 자비 부담 | §9.1 |
| ★★★ **카드 이미지는 Cloudflare Workers 리버스 프록시로 전달한다.** 원천 절대 URL은 `cards.source_image_url`에 두고 화면이 **렌더 시점에** 프록시 경로로 재작성한다. 🚨 **마이그레이션 0건 · 데이터 변경 0행** | §9.4 ⓖ · §3.5 |
| ★★★ **오픈 릴레이 방어는 세 겹이다** — ⓐ 클라이언트가 URL을 주지 못한다 ⓑ ID 형식 정규식 3형식 ⓒ 레이트리밋. **HMAC 서명과 DB 조회는 기각** | §9.4 ⓖ-3 · §3.5 |
| 🚨 **프록시는 *영구히* 원천에 요청을 낸다.** 그래서 승인의 모양이 「N회 승인」이 아니라 **「상시 운영 승인 + 상한 + 자동 중단」**이다 | §9.4 ⓖ-7 |
| **`referrerPolicy`는 `CardImage`에서 제거한다**(T1.23). 브라우저가 원천에 안 닿는다. 🚨 **단 워커는 닿고, 그 워커는 `Referer`를 위조하지 않는다** | §9.4 ⓖ-6 · ⓖ-3 |
| **폴백 프레임은 장식이 아니라 방어 코드다 — 이미지가 하나도 없어도 서비스가 성립해야 한다.** 프록시에서는 **킬 스위치의 착지점**이 되어 더 무거워졌다 | §9.4 ⓑ · ⓖ-4 · §2.8-6 |
| ★ **「이미지가 하나도 없어도 성립한다」가 실측으로 확인됐다** — `image_url` 전량 null(폴백 100%)에서 도감·검색·상세·대체 카드가 전부 성립했다 | T1.19 |
| **프록시의 회수는 「캐시 만료 대기」가 아니라 「라우트 끄기」다** — 모든 요청이 우리 코드를 지나므로 **킬 스위치 한 겹이 모든 캐시 층을 무력화한다** | §9.4 ⓖ-4 |
| ⚠️ **프록시(②축)와 광고(④축)가 동시에 켜지면 노출이 가장 큰 조합이고, 광고 수익은 「중지 요청」에 대한 판단을 무디게 한다.** 🚨 **프록시가 ②축을 낮추지 않는다** | §9.4 ⓖ-2 · §4.4.1 되돌릴 조건 6 |
| **도감의 「관련 카드」는 두 영역이다** — 「같은 카드의 다른 버전」(§4.6)과 「같은 세트의 카드」. **탭으로 묶지 않는다** | §4.9 |
| **카드 데이터는 원천 사이트에서 자동 수집해 등록한다.** T1.14 손입력은 폐기 | §0.1 ⓓ |
| **게임 룰은 수치(60/50 · 7/5 · 4장)를 DB `games` 행에서만 읽고, 구조 룰만 코드에 둔다** | §4.7 ⓑ |
| **`src/lib/domain/**`은 카드 DB 타입을 import 하지 않는다.** 카드는 `DeckSlot`(원시값)으로만 들어오고 `no-restricted-imports`가 강제한다 | §4.7 ⓓ |
| **수집기·임포터는 `scripts/`의 로컬 tsx 스크립트다. §1 P2의 대상이 아니다** | §4.8 ⓑ |
| **중간 파일(JSONL)은 `data/`에 두고 커밋하지 않는다.** DB는 `UPDATE` 한 번으로 내려가지만 **git 히스토리는 그렇지 않다** | §4.8 ⓓ |
| **§9.2 ⓒ 전제 3(관리자 API 파괴 표면 동결)은 유지된다** — 임포터는 `/api/admin/*`에 엔드포인트를 0개 만들고 기본은 insert-only이며 DELETE 경로가 없다 | §4.8 ⓕ |
| ★★ **프로모 카드는 별도 `card_sets` 행이다. 코드 접두사로 세트를 추론하지 않는다 — 파일(디렉토리명)이 곧 세트다** | §0.1 ⓕ · §4.11 ⓔ |
| ★★ **T1.18 임포터 계약은 §4.11이다 — 40세트 3,146행 전수 실측 위에 서 있다.** 판단은 `src/lib/catalog/`의 순수 함수 넷, `scripts/`는 배선 | §4.11 ⓑ · ⓘ |
| ★★ **원피스는 `games` 행 둘로 갈린다 — `opcg-kr` · `opcg-jp`**(010). 컨벤션은 `<기본게임>[-<지역>]`이고 **판이 하나뿐인 게임은 접미사를 붙이지 않는다** | §4.12 ⓒ |
| 🚨 **판 분리가 도메인으로 새지 않는다** — `GameCode`는 한 글자도 안 바뀌고 DB 행 식별자만 `GameRowCode`가 받는다. 경계는 `baseGameCode()` 하나 | §4.12 ⓓ |
| ★★ **A-5 우산이 닫혔다 — 카탈로그가 실제로 채워졌다.** `cards` **3,139행** · `card_sets` **40행**. **「데이터가 병목」이라는 전제는 여기서 끝났다** | T1.19 · T1.27 |
| ★★★ **시세(가격) 축을 폐기했다 (2026-09-03 사용자 결정).** 컬렉션의 가치는 **자체 수집 점수**로만 표현한다 | §5.7 · §4.13 |
| ★★★ **성취 3축이 유일한 가치 축이다** — ⓐ 자체 희귀도 점수(**우리 DB의 실재 컬럼만. 새 원천 0개**) ⓑ 도감 완성도(**localStorage 선행** — 로그인 0 · 테이블 0) ⓒ PSA 팝수(⏸ **자리만**) | §4.13 |
| 🚨 **성취 3축은 「계산은 순수 함수 · 저장소는 어댑터」로 가른다** — 계정 기반(T3.2)으로 옮길 때 **로직을 두 벌로 만들지 않기 위해서다.** 그리고 **PSA 팝수가 하나도 없어도 점수가 성립해야 한다** | §4.13 ⓒ · ⓔ · ⓕ |
| 🚨 **수집 점수를 화폐 단위(원 · 엔)로 표기하지 않고 시계열 그래프로 그리지 않는다** | §1 P6 · §4.13 ⓖ |

---

# 2. Current Goal

**다음 세션은 로컬 세 칸이고, 배포는 사람 승인 하나에 막혀 있다.**

> 🚨 **7~11번을 지우지 않는다. 「막혀 있다」로 남긴다** — 지우면 배포일에 순서를 다시 만들게 되고, **리허설이 빠진 순서가 만들어진다.**
> ⚠️ **이번 묶음에는 「창」이 없다** — 네트워크 0회 · DB 쓰기 0건 · 마이그레이션 0건 · 배포 0건. **되돌리기는 커밋마다 `git revert` 하나다.**

| # | 걸음 | 🚨 중단 조건 | 사람 |
|---|---|---|---|
| **0** | ★★★ **착수 전 총계** — 루트 **41 files / 516 tests** · 워커 **57건** · `lint` · `typecheck` · **`test:e2e`** | ★★★★ **판정 기준이 「빨간불 0건인가」가 아니라 「기준선과 같은가」다.** **e2e 기준선 = 49건 중 41 통과 · 2 실패 · 6 미실행**(E-5 · `cursor.spec.ts:53` · `filters.spec.ts:78`). 🚨 **그 둘 말고 다른 것이 빨간불이면 멈춘다.** ⚠️ **「초록일 때만 간다」로 읽으면 세션이 시작조차 못 한다** — 이 규율이 노린 것은 *끝에서 되짚지 않는 것*이다 | — |
| **1** | **T1.23-A** — `referrerPolicy` 제거 + 파일 doc 셋 + 테스트 단언 뒤집기 | **폴백 프레임(`CardFallbackFrame`)을 고쳐야 하면 멈춘다** — 킬 스위치의 착지점이다 · **미실측 2건을 확인하려 들면 멈춘다**(그것이 B다) | — |
| **2** | **커밋(T1.23-A 단독) + 기록** | 🚨 **체크박스를 켜지 않는다.** 「코드까지. 미실측 2건 미실행 · 선행 배포」 한 줄을 적는다 — **안 적으면 다음 세션이 「T1.23을 했다」로 읽는다** | — |
| **3** | **T2.15** — 번역 · 집계 ⓑ · 배지 · 고지 · `rg` · 검증 | **도메인 함수를 고쳐야 통과하면 멈춘다**(번역이 틀린 것이다) · **테이블·마이그레이션이 필요해 보이면 멈춘다** · ★ **`filters.spec.ts`가 *새로* 깨지면 그것은 E-5가 아니라 오늘 것이다** · 🚨 **화면에 화폐 단위가 하나라도 보이면 멈춘다**(§1 P6) | — |
| **4** | **커밋(T2.15 단독) + 기록.** ★ **ⓑ의 집계 비용 측정값을 백로그 B-4에 옮겨 적는다** | 🚨 **재고 안 적으면 다음에 또 잰다** | — |
| **5** | **E-4** — `token.trim()` + 컴포넌트 테스트 1건 | **서버 `session.ts`를 고쳐야 하면 멈춘다** — 🚨 **다듬는 것은 입력의 일이지 검증의 일이 아니다** | — |
| **6** | **최종 검증 + `.claude/plan.md` 기록** — `lint` · `typecheck` · `test` · **`test:e2e`** | **검증 넷을 안 돌고 끝내지 않는다** — **E-4를 마지막에 두는 근거가 그것이다**(검증 비용이 0으로 흡수된다). ★ **e2e는 0번 기준선과 대조한다** | — |
| **7** | ⏸ ❌ **§9.3 ⓓ 재확인**(`robots.txt` 404 불변 · 푸터 인용문 대조) | 🚨 **막혀 있다 — 「미룬 것」이 아니라 배포 당일의 첫 걸음이다.** ⚠️ **미리 하면 값이 상한다. 약관은 바뀐다** | — |
| **8** | ⏸ ❌ **사람 확인 지점 ②**(사용자 일감 9) — 상시 운영 승인 · 시간당 상한 · 자동 중단 | 🚨 **배포를 막는 유일한 것이다. 기술적 잠금은 없다** — 「아직 못 한다」가 아니라 **「아직 하면 안 된다」**. ⚠️ **「솔트가 없으면 전량 503이니 안전하다」를 「그러니 먼저 배포해도 된다」로 읽지 않는다** | ✅ **필요** |
| **9** | ⏸ ❌ **배포 → `wrangler secret put IMAGE_PROXY_IP_SALT` → 킬 스위치 리허설** | 🚨 **순서를 바꾸지 않는다.** **없는 워커에 시크릿을 넣으면 워커가 생기고 그것이 곧 배포다** | ✅ **필요** |
| **10** | ⏸ ❌ **T1.31-B · T1.23-B** — base 확정 → 프로덕션 빌드로 화면 · 미실측 2건 | **9번에 딸린다.** 🚨 **여기서 두 태스크의 체크박스가 켜진다** | — |
| **11** | ⏸ ❌ **T2.13 → T2.16-B** | **10번 뒤 + 착지 화면.** 🚨 **T2.16-B의 선행이 둘이다** | ✅ **필요**(확인 7) |

---

# 3. Pending Tasks

> 🚨 **미완료 태스크의 완료 기준은 이력이 아니라 살아 있는 계약이다.** 완료된 태스크의 것만 `plan-archive.md`에 있다.

## 3.1 Phase 1.5 잔여 — 이미지 축

- [ ] **T1.23** `CardImage` 리버스 프록시 대응 · **S** · 선행 **T1.31**
  - **하는 일은 둘뿐이다.** ⓐ **`referrerPolicy="no-referrer"` 제거** — 브라우저가 원천에 닿지 않는다. 🚨 **단 이제 *워커*가 닿고, 워커는 `Referer`를 위조하지 않는다** ⓑ **파일 doc의 근거 갱신**(`next/image`를 안 쓰는 이유)
  - 🚨 **폴백 프레임은 손대지 않는다.** 요건이 유지될 뿐 아니라 **킬 스위치의 착지점**이 되어 더 무거워졌다
  - **완료 기준:** ⓐ 렌더된 `<img>`에 `referrerpolicy` 속성이 **없다**(B-6의 단언을 뒤집어 교체) ⓑ 폴백 진입 조건 두 가지가 그대로 통과 ⓒ 파일 doc이 프록시 근거로 갱신됨 ⓓ `lint`·`typecheck`·`test` 통과
  - **A/B 분할** — **A(코드)**: ⓐ~ⓓ 전량 로컬. **다음 세션 1번 걸음.** **B**: 미실측 2건(「죽은 URL이 실제로 생기는 날」) — **배포 뒤, T1.31-B와 같은 걸음**
  - 🚨 **A만 끝나면 체크박스를 켜지 않는다**
- [ ] **T1.30** `workers/image-proxy` 리버스 프록시 워커 · **L** · 계약 전문은 **§3.5**
  - ✅ **코드 + KV 배선까지 끝났다 (2026-09-01). 배포 0건.** 워커 테스트 57건 통과 · `--dry-run` 통과
  - **남은 완료 기준 다섯 — 전부 배포가 있어야 닫힌다:**
    - ⓖ ★★★ **킬 스위치 리허설 1회** — 켜고 → **표본 20건이 전부 거부되는가** → 화면이 폴백으로 떨어지는가. 🚨 **이것이 T1.21이 지고 있던 의무를 이어받는 자리다**
    - ⓗ ★★ **앞단이 워커를 건너뛰지 않는 것을 확인한다** — ⓖ에서 켰는데 **이미지가 계속 뜨면 즉시 멈춘다**
    - ⓘ **자동 발동 확인** — 403/429를 **주입한 응답으로** 재현. ⚠️ **원천에 실제로 시험하지 않는다**
    - ⓙ ★ **측정 5·6·7**(§9.4 ⓖ-10): 무변환 장당 바이트 분포 · **캐시 히트율** · 원천 응답 시간과 5xx 발생률
    - ⓜ ❌ **배포는 사람 확인 지점이다** — 시크릿. 그리고 **첫 실제 요청 전에 §9.3 ⓓ 재확인**
  - **닫힌 기준(참고):** ⓑ 오픈 릴레이 3중 방어 각각 테스트 · ⓒ `Content-Type`이 sniff 결과이고 하드코딩 0건 · ⓓ `redirect:"manual"` + `checkFinalHost()` · ⓔ 응답 헤더가 `public, max-age=3600` 하나(`immutable`·`s-maxage`·`swr` 0건) · ⓕ `Referer` 미전송 + 브라우저 UA 문자열 0건 · ⓚ 레이트리밋 기전 확정(DO) · ⓛ 테스트가 원천에 안 나간다 · ⓝ `src/` 변경 0건
  - **멈춰야 하는 신호:** ⓐ 🚨 **워커 `fetch`가 원천의 비정상 상태줄(`HTTP/1.1 200 200`)을 처리 못 한다 → 이 태스크 전체를 막는다** ⓑ 원천이 403/429 → 킬 스위치 자동. **재시도하지 않는다** ⓒ 킬 스위치를 켰는데 이미지가 계속 뜬다 → **고치기 전에는 공개하지 않는다** ⓔ **「URL을 받으면 편한데」라는 생각이 든다 → 그것이 오픈 릴레이의 시작이다**
- [ ] **T1.31** 렌더 시점 재작성 — `source_image_url` → 프록시 URL · **M**
  - ✅ **A(코드) 완료 (2026-09-01 심야).** `image-src.ts` + 13건 → **516 tests.** ⏸ **체크박스는 켜지 않는다 — 「코드까지. 화면 확인 미실행 · 선행 배포」**
  - **완료 기준:** ⓐ 순수 함수 `proxiedImageUrl(sourceUrl, proxyBase)`를 **`src/lib/cards/image-src.ts`**에 둔다(🚨 `catalog/`가 아니다) ⓑ `extractDownname()`+`isValidDownname()`로 판정하고 **형식이 어긋나면 `null`을 돌려 폴백으로 보낸다**(프록시에 보내 404를 받지 않는다) ⓒ 🚨 **`proxyBase`는 인자다. 모듈에 박지 않는다** ⓓ 조회 계층이 `source_image_url`을 select해 `image_url`에 파생값으로 채운다 ⓔ **`image_url ?? proxiedImageUrl(...)` 순서**(되돌릴 갈래에서 그 컬럼이 다시 채워질 때를 위해) ⓕ **base가 비면 전량 폴백. 깨지지 않는다** ⓖ 화면 넷이 같은 경로를 탄다 ⓗ 단위 테스트 5종(정상·null·형식 위반·base 없음·**호스트 화이트리스트 밖 → null**) ⓘ 검증 통과 · **마이그레이션 0건**
  - **B(화면 확인)** — **프로덕션 빌드로 화면을 연다** + T1.23-B의 미실측 2건. 🚨 **배포 뒤. base 값이 첫 배포에서 나온다**
  - ⚠️ **`/cards` 목록은 `queries.ts`를 지나지 않는다** — `search_cards` RPC를 탄다. 파생이 **두 자리(조회 계층 · 라우트 핸들러)**에 섰고 언제 한 자리로 모을지가 미결(확인 5)
- [~] **T1.21** 이미지 회수(purge) 경로 — ⏸ **조건부 보류. 코드는 남기고 태스크를 닫지 않는다**
  - **코드(`purge.ts` · `scripts/purge-images.ts` · 테스트 30건)는 그대로 둔다.** 🚨 **되돌릴 갈래(§9.4 ⓖ-9)에서 그대로 쓰인다 — 지우지 않는다**
  - **실데이터 실행이 도달 불가**(T1.22 폐기로 지울 객체가 없다). **의무는 T1.30 ⓖ(킬 스위치 리허설)로 이관됐다**

## 3.2 Phase 2 · 3

- [ ] **T2.3** 마이그레이션 002 — `decks` / `deck_cards` + RLS + **GRANT 3단**
- [ ] **T2.4** 덱 레시피 목록 · 티어표 · 상세
- [ ] **T2.5** 덱 빌더 UI + 첫 손패 드로우 · 멀리건
- [ ] **T2.13** 도감 「관련 카드」 세트 축 · **M** · 계약 전문 **§4.9**
  - 🚨 **번호가 순서를 뜻하지 않는다.** 🚨 **절반은 이미 있다 — `similar-cards.tsx`를 다시 설계하지 않는다**
  - **완료 기준:** ⓐ `/sets/[setId]`가 생긴다(**`[setId]`는 uuid**. 없으면 `notFound()`) ⓑ 세트 코드·라벨·게임·총 카드 수 + **`code` 오름차순 60장/페이지 오프셋**(`pagination.tsx` 재사용) ⓒ 🚨 **커서를 쓰지 않는다** ⓓ 카드 상세 하단에 **미리보기 12장 + 「전체 N장 보기」**를 「같은 카드의 다른 버전」 **아래 별도 영역**으로(탭 금지) ⓔ 현재 카드를 **빼지 않고 표시로 구분** ⓕ `queries.ts`에 함수 3개를 더해 **RSC가 직접 조회. API 라우트를 만들지 않는다** ⓖ **`/sets/[setId]`는 동적(`ƒ`)** ⓗ `(set_id, code)` 인덱스가 없으면 마이그레이션 1건 ⓘ **정렬 옵션을 넣지 않는다**(B-5가 딸려 온다) ⓙ E2E 1건(상세 → 전체 보기 → 2페이지). ⚠️ **전역 셀렉터 사고 2건을 되풀이하지 않는다** ⓚ 검증 넷 통과
- [ ] **T2.15** 희귀도 점수 화면 노출 · **S~M** · 선행 **T2.14**(✅) + 🚨 **T1.31**
  - 🚨 **T1.31이 선행인 이유는 순위가 아니라 *파일 충돌*이다** — 둘 다 `queries.ts`의 select와 파생값 채우기를 고친다. 순서를 뒤집으면 되돌릴 때 둘이 함께 돌아간다
  - **완료 기준:** ⓐ 조회 계층이 DB 컬럼을 `PrintingFacts`로 **번역**한다(🚨 번역은 조회 계층의 일이고 도메인은 모른다) ⓑ 집계 셋(`printingsInGroup`·`peerCount`·`setSize`)의 **조회 비용을 재고 적는다**(→ B-4) ⓒ **배지가 카드 상세에 뜬다.** 🚨 **목록 타일에는 넣지 않는다** — §2.8-2의 레어도 배지와 겹친다 ⓓ 🚨 **`score === null`이면 「산출 불가」를 그린다. 자리를 비우지 않는다** ⓔ 🚨 **화폐 단위 0건 · 그래프 0개 · 정렬 옵션 0개**를 `rg`와 눈으로 확인 ⓕ **「우리가 만든 값」 고지**가 화면에 있다(`reasons`를 값으로 받아 그린다) ⓖ 검증 넷 통과 · **마이그레이션 0건**
- [ ] **T2.16** 도감 완성도 — 브라우저 로컬 체크리스트 · **M** · 계약 전문 **§4.13 ⓔ**
  - ✅ **A(코드) 완료 (2026-09-01).** ⏸ **「코드까지. 화면(ⓔ·ⓕ)·E2E(ⓙ) 미실행」이라 체크박스는 꺼진 채다**
  - **닫힌 기준:** ⓐ `completion.ts`(순수) + `owned-store.ts`(어댑터) 두 파일 · ⓑ `OwnedCardStore` 인터페이스 · ⓒ 저장 키 `<gameCode>:<code>` · ⓓ `localStorage` 접근 전부 `try/catch` · ⓖ `strays`를 센다 · ⓗ **수량·상태 등급·구매가 0개** · ⓘ 단위 테스트 7+6건
  - **남은 기준:** ⓔ **`available === false`일 때 「이 기기에 저장할 수 없습니다」를 그린다**(🚨 체크되는 것처럼 보이게 하고 조용히 버리지 않는다) ⓕ **한계 4가지를 정직하게 적는다** ⓙ E2E 1건(체크 → 새로고침 → 유지)
  - 🚨 **B의 선행이 둘이다 — T1.31-B + 착지 화면(T2.13).** `/sets/[setId]`가 아직 없다(확인 7)
  - **멈춰야 하는 신호:** ⓐ **테이블이 하나 필요해 보인다 → 그 순간 이 태스크의 전제가 깨진다** ⓑ `completion()`에 `window`가 들어간다 ⓒ **`localStorage`가 조용히 실패하는데 화면이 초록이다**
- [ ] **T3.1** Google / Kakao OAuth + `proxy.ts` 세션 갱신 + `profiles` — **관리자 권한을 여기서 계정 기반으로 교체한다**(§4.5의 토큰은 임시)
- [ ] **T3.2** 마이그레이션 004 — `collection_items` / `binder_shares` + RLS + GRANT + 공개 뷰
  - 🚨 **T2.16이 이 태스크를 대체하거나 선취하지 않는다.** T2.16이 만든 `OwnedCardStore`의 **두 번째 구현**이 된다. **완성도 계산은 순수 함수라 저장소가 바뀌어도 옮길 것이 없다**
  - ⚠️ **그때 함께 정할 것: 로컬에 쌓인 체크를 계정으로 옮길 것인가.** 🚨 **오늘 답하지 않는다**(재료가 없다). 다만 **「옮기지 않는다」를 기본값으로 두면 로그인하는 순간 체크가 사라진 것처럼 보인다**
- [ ] **T3.3** 가상 3공 바인더 + 위시리스트
- [ ] **T3.5** 공유 바인더 + 동적 OG 이미지
- [ ] **T3.7** E2E 시나리오 확장 + GitHub Actions CI

## 3.3 백로그

- [ ] **A-7** `ST15`~`ST20` 스타터덱 커버리지 구멍 — PROMO 경로로 30장만 들어온다 — ⏸ **원천이 주지 않아 우리가 메울 수 없다.** 「구멍이 있다는 것을 아는 상태」가 산출물이다
- [ ] **A-8** **PSA 팝수 데이터 원천** (§4.13 ⓕ) — ⏸ **열린 채.** 공식 API는 실재하나 **팝수를 안 준다.** 남은 물음 넷이 전부 HTTP 403 — 사람이 브라우저로 여는 경로만 남았다. **T2.14를 막지 않는다**
- [ ] **B-3** `global-error.tsx` — 빈도가 낮고 `<html>`/`<body>`를 직접 렌더해야 해 검증이 번거롭다
- [ ] **B-4** 도감 결과 건수 표시 — `search_cards`가 total을 안 준다. ★ **T2.15 ⓑ가 `count` 비용의 답을 낸다**
- [ ] **B-5** 도감 정렬 옵션 — 정렬 키를 바꾸면 **커서 튜플도 바꿔야 한다**(§2.7-9). 하루에 끼워 넣을 일이 아니다
- [ ] **B-7** 도감 → 세트 진입점 — **T2.13 뒤에 실제 화면을 보고 판단한다**
- [ ] **C-1** `name_en`이 검색에서 빠져 있다 — `search_cards`는 `name_ja`/`name_ko`만 본다
- [ ] **C-2** `effect_text` 검색 — 수요가 크고 **키워드 수작업 태깅도 줄여준다**
- [ ] **E-1** `db:types`가 **로컬 Docker DB**를 가리킨다 — 🚨 **상설 규칙: 마이그레이션을 만드는 태스크는 `db:reset` → `db:migrate` → `db:types` 순서를 지킨다**
- [ ] **E-2** 애드센스 잔재 제거(`ad-slot.tsx` · `NEXT_PUBLIC_ADSENSE_CLIENT`) — ⏸ **조건부 보류. 🚨 지우지 않는다** — 지금 지우면 광고를 붙이기로 할 때 같은 것을 다시 만든다. **되살아나는 조건: 「광고를 붙이지 않는다」가 다시 확정되는 날.** ⚠️ **그날이 와도 §9.1의 서술까지 함께 지우지 않는다**
- [ ] **E-4** 관리자 로그인 폼이 입력을 `trim()`하지 않는다 · **XS** — **다음 세션 5번 걸음.** 실측: 정상 200 · **뒤 공백 401 · 뒤 줄바꿈 401**. 사람이 못 알아채는 이유 셋(password 타입이라 안 보임 · `.env`에서 복사하면 딸려옴 · 에러 문구가 하나뿐). 고칠 곳은 `admin-login-form.tsx`. 🚨 **서버 `session.ts`는 고치지 않는다 — 서버가 trim하면 「공백이 붙은 토큰도 유효」가 되어 인증 비교가 느슨해진다**
- [ ] **E-5** **E2E 2건이 이미 빨간불** · S~M — ⏸ **다음 세션에 열지 않는다. 기준선으로만 다룬다.** 상세는 §5.1
- [ ] ★ **E-6** **시세 잔재 제거** · S~M · **2026-09-03 신설** — 범위는 아래 표

**E-6 상세**

| 대상 | 조치 |
|---|---|
| `src/components/features/cards/base-price-badge.tsx` | 삭제 |
| `src/app/(app)/cards/[cardId]/page.tsx` | import + `<BasePriceBadge priceKrw={null} …/>` 제거. ★ **T2.15의 희귀도 배지가 정확히 이 자리에 온다** |
| `src/app/page.tsx` | 「메르카리 · 라쿠마 · 야후옥션의 실시간 매물…」 소개 문구 · 「시세 그래프를 만들지 않습니다」 섹션 → **수집 점수 문구로 교체** |
| `src/app/(content)/disclaimer/page.tsx` | 「시세 정보의 성격」 절 제거 · 면책 문구에서 시세 삭제 |
| `tests/e2e/card-detail.spec.ts` | 「기준가 데이터가 없으면 산출 불가」 E2E 삭제 |
| `src/lib/supabase/admin.ts` | doc 주석에서 「기준가 갱신」 · `market_sessions` 제거 |
| 코드 주석의 `§5.4` 인용 | 남은 참조를 §3.5(레이트리밋 · IP 솔트 해시)로 옮기거나 문장을 자립시킨다 |
| `docs/crawler-compliance.md` | 매물 3곳 절에 「이 축은 2026-09-03에 폐기됐다」 한 줄 추가. **조사 기록이므로 지우지 않는다** |
| **완료 기준** | `rg -i "기준가\|시세\|메르카리\|라쿠마\|야후옥션\|market_session\|card_prices" src/ tests/`가 **0건** · `lint`·`typecheck`·`test`·`test:e2e` 통과 · **마이그레이션 0건** |

## 3.4 사용자 일감 — 🚨 번호를 다시 매기지 않는다

| # | 한 줄 | 언제까지 | 상태 |
|---|---|---|---|
| ★★★★ **9** | **프록시 상시 운영 승인**(ⓐ 켠다 ⓑ 시간당 상한 ⓒ 자동 중단) | **배포 전** | 🚨 **배포를 막는 유일한 것이다. 기술적 잠금은 없다** — 「아직 못 한다」가 아니라 **「아직 하면 안 된다」** |
| ★★ **13** | **`wrangler secret put IMAGE_PROXY_IP_SALT`** | 🚨 **배포 *뒤*** | 순서가 판정돼 있다: 승인 ② → 배포 → `secret put` → 킬 스위치 리허설. ⚠️ **앞당기면 없는 워커가 생기고 그것이 곧 배포다** |
| ★★ **15** | **머지 커밋의 `[CI Skip]` 프리픽스를 뗀다** | 🚨 **배포를 시작하는 날** | Workers Builds에는 「빌드 비활성화」 버튼이 없어 고른 수단이다. 🚨 **보장이 아니다** — `[CI Skip]`은 Cloudflare 문서가 *Pages 기준*으로 적은 것이다. **확정적 차단이 필요하면 Branch control에서 프로덕션 브랜치를 `main` 밖으로 옮긴다** |
| **3** | 광고를 붙일 것인가 | 기한 없음 | ⏸ 조건 불변 |
| **10** | `psacard.com` 4곳 열람 (EUA · `robots.txt` · 약관 · 무료 한도) | A-8 | ⏸ **넷 다 에이전트 도구로 403.** 급하지 않다 — PSA는 「자리만」이고 점수가 그것 없이 성립한다 |
| (선택) | 워커 UA에 연락처를 넣을지 | 배포 전 | **상대가 멈추라고 말할 수 있는 유일한 경로다** |
| ~~**4**~~ | ~~`faq.fril.jp` 「ラクマのルール」 열람~~ | — | ✅ **닫혔다 (2026-09-03)** — T2.7 착수 조건이었고 시세 축 폐기로 T2.7이 없어졌다 |
| ~~**14**~~ | ~~Cloudflare–GitHub 연결 확인~~ | — | ✅ **닫혔다 (2026-09-01)** — **「워커는 자동 배포되지 않는다」.** 근거 셋: 목록에 `deckbinder-image-proxy`가 **없다** · 저장소 루트에 wrangler 설정이 없다 · 시크릿이 없으면 3단계에서 전량 503이고 원천 fetch는 6단계다. 🚨 **마지막 근거를 「그러니 배포해도 된다」로 읽지 않는다 — 일감 9는 그대로 열려 있다** |

## 3.5 사용자 확인이 필요한 항목 — 🚨 번호를 다시 매기지 않는다

| # | 항목 | 상태 | 지금 무엇을 묻는가 |
|---|---|---|---|
| **1** | T2.16을 코드 절반(A)만 여는 것 | **실행됨** | 물음이 「가르는가」에서 **「가른 채로 두는가」**로 바뀌었다 |
| **2** | ★★ **`P`(프로모) 가중치 60** | ⏸ **열린 채** | **§4.13 ⓓ-6에서 신뢰도가 가장 낮은 값이다.** 🚨 **T2.15가 이 값을 *화면에* 올린다 — 답이 그 전에 오면 고치는 비용이 가장 싸다** |
| **3** | 밴드가 라벨의 되풀이처럼 보이는 것 | ⏸ **열린 채** | **T2.15 ⓕ(고지)의 무게가 이 답에 달렸다** — 「우리 값 = 공식 희귀도」로 읽힐 위험 |
| **4** | T1.31 코드 절반을 배포 전에 낸 것 | **실행됨** | 물음이 **「낸 것을 되돌리는가」**로 바뀌었다. ✅ 되돌리기는 `git revert` 하나이고 화면 위험은 0이다 |
| **5** | 목록 경로 — 2차 조회 vs 마이그레이션 012 | **ⓐ(2차 조회)로 실행됨** | 남는 물음은 **「파생이 두 자리에 선 것을 언제 한 자리로 모으는가」**이고 012는 여전히 선택지다 |
| **6** | `:source` 키·호스트 표가 앱과 워커 두 벌 | ⏸ **열린 채** | 앱은 `image-src.ts`, 워커는 `lib/sources.ts`. **합치기를 미룬 이유가 「배포 직전에 `--dry-run` 통과 번들을 다시 건드린다」이고 — 🚨 그 이유는 배포가 끝나면 사라진다** |
| **7** | T2.16-B 착지 화면 — T2.13을 앞당기는가 | ⏸ **열린 채** | ⓐ T2.13 먼저(M) ⓑ 다른 화면에 붙인다(계약을 고치는 일) ⓒ 배포 뒤로 미룬다(기본값) |

## 3.6 기타

- [ ] **§2.5 하향 고정 4개 되돌리기** — Node 24로 올라갔는데 일부러 안 되돌렸다. **툴체인 업그레이드와 워커 배포를 한 커밋에 섞지 않기 위해서다**
- [ ] **나머지 39세트 이미지 수집** — ⏸ 급하지 않다(프록시는 `source_image_url`만 있으면 뜬다). **새 승인 필요는 그대로**
- [ ] **`workers/**`에도 `no-restricted-imports`를 건다** (§3.5 「번들 오염」)

---

# 4. Completed

> **태스크 1건 = 1줄.** 무엇을 왜 그렇게 했는지는 해당 §에, 실행 이력은 git log와 `plan-archive.md`에 있다.

## Phase 1 — 기반 구축 (2026-08-25 마감 · `cff265d`)

- [x] **T1.1** 저장소 · Next 16 스캐폴드 · npm scripts · Vitest/Playwright 하네스
- [x] **T1.2** shadcn/ui 초기화 + 디자인 토큰 (§2.6)
- [x] **T1.3** 루트 레이아웃 · 라우트 그룹 · 앱 셸 · 다크 모드
- [x] **T1.4** Supabase 연결 · 환경변수 검증
- [x] **T1.5** 마이그레이션 001 — 카드 마스터 스키마 · 인덱스 · RLS · **GRANT**(§4.1-1이 여기서 나왔다)
- [x] **T1.5b** 마이그레이션 002·003 — `name_ja`/`name_ko` nullability 교정 · `pg_trgm`
- [x] **T1.6-A** 관리자 화면 — 인증 · 세트/카드 등록 · 대시보드 (§4.5)
- [x] **T1.7** `GET /api/cards` + 도감(검색 · URL 동기화 · 무한 스크롤)
- [x] **T1.7b** 마이그레이션 004 — `search_cards`/`card_facets` SQL 함수 + 필터 + 키워드 AND 칩 + `/admin/keywords`
- [x] **T1.8** 카드 상세 `/cards/[cardId]` · 마이그레이션 005(`base_code` 생성 컬럼) · DB 타입 생성 도입
- [x] **T1.9** 뉴스 · SEO · 마이그레이션 006(`news_posts`, RLS 기반 초안 차단) · sitemap/robots/OG/privacy/disclaimer
- [x] **T1.10** 비주얼 패스 (§2.8) — 갤러리 톤 토큰 · 홈 재작성 · 카드 그리드 재설계 · `ComingSoon`
- [x] **T1.11** 리팩토링 · 마이그레이션 007(`search_vector`·`similar_groups` 제거) · **커서 버그 수정** · 첫 `CI=1` 전량 E2E 검증
- [x] **T1.12** 관리자 운영 완결 + 404 (하위 1~7). 백로그 A-1~3 · B-1~2 · D를 닫았다. **마이그레이션 0건**
  - **T1.12-7**이 RLS 가시성 창 + Data Cache 증폭을 잡았다 — 반영 지연 최대 1시간 → **약 1초**(§2.7-17 · -20)

## Phase 1.5 — 데이터 착수

- [x] **T1.13** 카탈로그 로컬 덤프 `npm run db:dump` + 복원 리허설 (2026-08-25)
- [x] **T1.15** 세트 · 키워드 수정 · 삭제 (백로그 A-4) — 마이그레이션 0건 (2026-08-27)
- [x] **T1.16** 카탈로그 수집기 — 원천 → JSONL + 매니페스트. `parse`/`pace`/`manifest` + 검증. **테스트 58건** (2026-08-28)
- [x] **T1.17** 마이그레이션 008 — 성능 컬럼 9개 + `name_ja` nullable + `check(둘 중 하나)` + `source_image_url` (2026-08-29)
- [x] **T1.18** 카탈로그 임포터 — `normalize`/`plan`/`report`/`gate` + `catalog:import`. **DB 쓰기 0건**(코드까지) (2026-08-29)
- [x] **T1.19** 첫 실적재 1세트 + 측정 — `cards` **449행** · `card_sets` 40행 (2026-08-29)
  - ★ **여기서 「이미지가 하나도 없어도 서비스가 성립한다」가 실측으로 확인됐다** — 이 검증이 가능한 자리는 한 번뿐이었다
- [x] **T1.20** 이미지 수집기 — 원천 → 로컬 파일 + webp. OPK-14 320파일 (2026-08-30)
  - ⚠️ **산출물 `data/images/opcg/OPK-14/`는 「미사용」이지 「폐기」가 아니다. 지우지 않는다** — 다시 만들려면 원천에 166회를 다시 준다
- [x] **T1.24** 계열 단위 수집 확장 — 39번 실행을 4번으로. **네트워크 0회 · `pace.ts` 무수정**(58건 그대로) (2026-08-29)
- [x] **T1.25** 전 범위 실수집 4회 + 프로모 코드 형식 판독 — **40세트 3,146행** (2026-08-29)
- [x] **T1.26** 원피스 KR·JP 판 분리 — 마이그레이션 **010** + 코드. 원격 적용까지 (2026-08-29)
- [x] **T1.27** 나머지 **37세트 적재** (2026-08-30)
- [x] **T1.28** `card-images` 버킷 — 마이그레이션 011. ⏸ **「완료 · 미사용」으로 지위 변경.** 롤백 마이그레이션을 내지 않았다 (2026-08-30)
- [x] **T1.29** 공유 판정 모듈 — `downname` **3형식** + 호스트 판정을 `validation/card-image.ts`로. **440 → 466 tests** (2026-08-31)
- [~] **T1.14** 실제 카드 손입력 — ❌ **폐기 (2026-08-28 · §0.1 ⓓ).** 자동 수집으로 방침이 바뀌었다. 번호를 재사용하지 않는다
- [~] **T1.22** 이미지 업로더 — ❌ **폐기 (2026-08-31 · §9.4 ⓖ-1).** 리버스 프록시가 업로드 대상을 없앴다. **되돌릴 갈래에서 계약이 그대로 쓰인다**(archive)

## Phase 2

- [x] **T2.1** `src/types/game.ts` + `src/lib/domain/{rules,simulator/*}` — `no-restricted-imports`를 도메인에 걸었다 (2026-08-28)
- [x] **T2.2** `src/lib/domain/deck/{validate,stats}.ts` — 위반을 모아서 내고 매수 제한은 `cardKey`로 합산 (2026-08-28)
- [x] **T2.14** 자체 희귀도 점수(순수 함수) — `rarity-score.ts` + **23건**. **466 → 489 tests.** 마이그레이션 0건 · 화면 0개 (2026-09-01)
- [x] **T2.16-A** 도감 완성도 코드 — `completion.ts`(순수) + `owned-store.ts`(어댑터) + 7·7건. **489 → 503 tests** (2026-09-01)
  - ⏸ **「코드까지. 화면·E2E 미실행」이라 T2.16 체크박스는 꺼진 채다**
- [x] **T1.31-A** 렌더 시점 재작성 코드 — `image-src.ts` + 13건. **503 → 516 tests** (2026-09-01)
- ~~**T3.6** 제휴 링크 캐러셀~~ — ❌ **폐기 (2026-08-28).** 번호를 재사용하지 않는다 — T3.7이 그대로 T3.7이다

## 백로그 (닫힘)

- [x] **A-1~3** → T1.12-1~3 · [x] **A-4** → T1.15 · [x] **A-5** T1.16~T1.19 우산 · [x] **A-6** T1.24·T1.25 우산
- [x] **B-1** `not-found.tsx` → T1.12-4
- [x] **B-2** `loading.tsx` — **철회하고 닫는다.** 상세 라우트에 두면 `notFound()`가 소프트 404가 된다(§2.7-16). **이 경로는 막혀 있다**
- [x] **B-6** `CardImage` 폴백 프레임 + `referrerPolicy` — 폴백은 남고 `referrerPolicy`는 T1.23이 뗀다 (2026-08-28)
- [x] **D** `session.ts`·`responses.ts` 무테스트 → T1.12-5
- [x] **E-3** jsdom CSS 잡음 억제 — `createQuietVirtualConsole()`. 🚨 **억제 대상은 `type === "css parsing"` 하나뿐**이고 다른 `jsdomError`는 그대로 내보낸다. **58건 기대값 무수정** (2026-08-29)

---

# 5. Notes / Known Issues

## 5.1 E2E 기준선 (백로그 E-5) — 🚨 **초록이 아니다**

**`tests/e2e/cursor.spec.ts:53` · `tests/e2e/filters.spec.ts:78`이 이미 빨간불이다.** 기준선 = **49건 중 41 통과 · 2 실패 · 6 미실행.**

- ★★★ **오늘 만든 결함이 아니라는 것을 `git stash -u`로 갈랐다** — 추측이 아니다. T1.31-A를 통째로 빼고 같은 두 스펙을 돌렸더니 똑같이 실패했다
- **증상(뿌리가 하나로 보인다):** 둘 다 `beforeAll`이 `/admin/cards/new`에서 카드를 만드는데 **「게임」 셀렉트에 옵션이 없어** 데이터가 안 만들어지고 뒤 단언이 0건을 본다
- ★★ **가장 위험해지는 자리는 T2.15다** — 실패 스펙 하나가 하필 **「레어도 필터」**이고 T2.15가 희귀도를 화면에 올린다. 🚨 **0번 걸음에서 기준선을 못 박지 않으면 그 자리에서 「내가 깼나」를 되짚는다**
- 🚨 **다음 세션에 이 항목을 열지 않는다. 기준선으로만 다룬다.** **여는 것은 사용자 결정이다.** 첫 걸음 후보 셋: ⓐ `games` 테이블에 행이 있는가 ⓑ `/admin/cards/new`의 게임 목록이 어디서 오는가 ⓒ **E2E가 자기 데이터를 스스로 만들어야 하는가** — 🚨 **ⓒ가 진짜 물음일 수 있다: 로컬 DB 상태에 기대는 E2E는 사람마다 다르게 빨간불이 된다**
- ★★ **여기서 얻은 상설 규율: 「착수 전 총계」에 `test:e2e`를 넣는다.** 끝에서 알면 「내가 깼나」를 되짚어야 하고 그 되짚기에 스태시 왕복이 든다. **앞에서 알았으면 0초다**

## 5.2 재발 방지 — 짧은 목록

전문은 §1.7. **여기 있는 것은 전부 「조용히 잘못 동작」 유형이다.**

- **시간 조건 RLS(`<= now()`)를 쓰면 앱이 찍는 시각에 마진을 준다**(`now - 5초`)
- 🚨 **`revalidateTag`는 이 Next 버전에서 fetch Data Cache에 닿지 않는다. 태그 기반 무효화를 다시 설계하지 않는다**
- **커서 키는 유니크 제약과 같은 폭이어야 한다** — `(code, id)`
- **`/cards/[cardId]` · `/news/[slug]`에 `loading.tsx`를 두지 않는다** (소프트 404)
- **data-only 덤프 복원에 `ON_ERROR_STOP=1`을 쓰지 않는다** — 마이그레이션이 심은 참조 데이터와 **구조상 반드시 충돌한다**
- **PostgREST는 1000행에서 에러 없이 자른다**
- **인증 상태에 따라 결과가 갈리는 흐름은 프로덕션 빌드로 확인한다** — dev와 dev 기준 E2E는 통과한다

## 5.3 약관 · 법적 제약

- **원천은 `onepiece-cardgame.kr` 하나. 근거는 「금지 근거를 찾지 못함」이다** — §4.4.1의 되돌릴 조건 6개가 살아 있다
- 🚨 **`robots.txt` 404 = 「아무 말도 하지 않았다」.** 부하 규율은 우리가 만든다(§4.8 ⓔ)
- 🚨 **「팬 사이트라서 허용된다」를 어떤 문서·화면·커밋 메시지에도 쓰지 않는다.** **「비영리」는 사실 서술로만 쓰고 정당화 근거로는 못 쓴다** — ②축(데이터 재사용) 금지 조항은 **영리성을 조건으로 달지 않고**, 원피스 저작권 표기 주체는 **비영리를 명시적으로 배제했다**
- **§9.3 ⓓ 재확인 의무는 살아 있다** — `robots.txt` 404 불변 · 푸터 인용문 대조. **배포 당일의 첫 걸음이고 미리 하면 값이 상한다**(약관은 바뀐다)
- **이 검토는 법률 자문이 아니다.**

## 5.4 미실측 위험 — T1.30 첫 실행을 막을 수 있는 것들

🚨 **「확인하지 못한 것」을 「없는 것」으로 읽지 않는다.**

- 🚨 **Cloudflare Workers의 `fetch`가 원천의 비정상 상태줄(`HTTP/1.1 200 200`)을 어떻게 다루는가** — 미실측. **이것이 T1.30 전체를 막을 수 있다.** 닫는 것은 **첫 실제 요청**이다
- 🚨 **우리 앞단(Cloudflare 엣지)이 워커를 건너뛰고 캐시 응답하는가** — 미실측. **건너뛴다면 「모든 요청이 우리 코드를 지난다」가 거짓이 되고 §9.4 ⓖ-4 전체가 흔들린다**
- **원천이 `Referer`·UA 조건을 거는가** — 여전히 미실측. 08-31의 `Referer` 1건은 단일 표본이라 닫지 못한다
- **`size` 파라미터의 상한** — ⏸ **일부러 시험하지 않았다.** 시험 자체가 부하다

## 5.5 운영 위생

- **원격 DB의 임시 데이터** — 디자인 확인용 샘플은 **카드명과 일러스트가 맞지 않는 가짜**라 **공개 전에 반드시 지운다.** `npm run db:clean`은 접두사 + 6자리 타임스탬프 정규식으로만 지운다
- **E2E가 데이터를 남긴다 (§9.9)** — 각 spec의 `beforeAll` 데이터가 누적된다. 근본 해결은 테스트 전용 Supabase 프로젝트 분리
  - **규칙 1 — 접두사를 새로 쓰는 스펙을 추가하면 `cleanup-sample.ts`의 표와 패턴을 같은 커밋에서 갱신한다**
  - **규칙 2 — 원인 추적용으로 만든 데이터는 그 세션 안에서 지운다.** `cleanup-sample.ts`에 진단용 접두사를 등록하지 않는다
  - ⚠️ **`db:clean`에는 dry run도 24시간 덤프 관문도 없다**(임포터와 비대칭이다). **실행 직전에 `npm run db:dump`를 돌린다**
  - **자가 정리 선례:** `admin-cards.spec.ts`의 등록 → 수정 → **삭제** 왕복은 끝에 자기 카드를 지운다. 같은 파일의 페이지네이션 테스트(22장)는 **의도적으로 지우지 않는다**
- **카드 삭제는 하드 삭제를 유지한다 (§9.10)** — 참조가 `card_keywords`(`on delete cascade`) 하나뿐이라 지금 soft-delete를 도입하면 전 조회 경로에 `deleted_at is null`을 다는 비용만 남는다. **재검토 트리거: `deck_cards`(T2.3) 또는 `collection_items`(T3.2) 중 먼저 오는 쪽**

## 5.6 🚨 지우면 안 되는 것 — 체크리스트

| 대상 | 왜 |
|---|---|
| **§4.11 ⓔ-2 40행 `card_sets` 참조표** | `data/`가 gitignore라 **원천 세트 라벨의 유일한 커밋본**이다. 복구에 원천 요청 약 3,000회 |
| **`purge.ts` · `scripts/purge-images.ts` + 테스트 30건** | 자체 호스팅 갈래 전용 · 현재 미사용이나 **되돌릴 갈래(§9.4 ⓖ-9)에서 그대로 쓰인다** |
| **`data/images/opcg/OPK-14/` 320파일 · 버킷(011)** | 「미사용」이지 「폐기」가 아니다. 다시 만들려면 원천에 166회를 다시 준다 |
| **`cards.image_url` 컬럼** | 계속 null이지만 **컬럼을 지우지 않는다**(§9.4 ⓖ-5) |
| **백로그 E-2 (애드센스 잔재)** | 조건부 보류. 지우면 광고를 켤 때 같은 것을 다시 만든다 |
| **Current Goal의 7~11번(배포 사슬)** | **지우면 배포일에 순서를 다시 만들게 되고 리허설이 빠진 순서가 만들어진다** |
| **§4.4.1의 「금지 근거를 찾지 못함」 문장** | **한 글자도 바꾸지 않는다.** 이 절이 문서의 법적 지반이다 |
| **§4.5가 §4.6 뒤에 있는 순서** | 코드와 `docs/`가 그 번호로 참조한다 |
| **§2.8 규칙 번호 · §1 P1~P6 · §0.1 ⓐ~ⓗ · §4.1-1** | 하위 앵커로 인용된다 |

## 5.7 폐기된 축 — 시세 (2026-09-03)

🚨 **매물 수집(메르카리 · 라쿠마 · 야후옥션)과 기준가 표기는 사용자 결정으로 폐기됐다. 「미구현」이 아니라 「하지 않기로 한 것」이다.**

- **없어진 것:** §4.3(기준가 산출) · §3.4(`workers/crawler`) · §5.2 · §5.3 · §5.4(되팔이 방지) · **T2.6~T2.12** · **T3.4**(컬렉션 총 가치) · `card_prices` · `market_sessions` · 환경변수 3종 · 사용자 일감 4
- ✅ **폐기 비용은 0이었다** — 일곱 테이블·워커·화면 중 **실물이 하나도 없었다**(마이그레이션 0건 · 데이터 0행)
- **남은 것:** `condition` 3값은 `collection_items`가 재사용한다(§4.1). `docs/crawler-compliance.md`의 조사 기록은 **지우지 않는다**
- **화면·문구 코드 제거는 백로그 E-6이다** — 이 문서 개정 시점에는 코드를 건드리지 않았다
- 🚨 **되살리려면 `CLAUDE.md`와 §4.4.1을 먼저 고쳐야 한다.** 설계 원문은 `plan-archive.md`에 있다
- ⚠️ **다음 세션이 이것을 「빠진 기능」으로 읽고 다시 제안하지 않게 하려고 이 절이 있다.** 🚨 **에이전트가 「이제 할 만해 보인다」로 열지 않는다 — 여는 것은 사용자 결정이다**

## 5.8 §9.11 — 권리자 문의 갈래 (전제는 소멸, 절은 남는다)

§4.4.1 결정 6이 문의 발송을 폐기해 「회신을 기다린다」는 전제가 사라졌다. 🚨 **그러나 이 절을 「닫힌 절」로 읽지 않는다 — 문제는 그대로 남고 해결 경로만 없어졌다.**

- **살아 있는 것:** 「묻는 비용」 판단 · **ⓓ 세 갈래**(진입 트리거만 §4.4.1 되돌릴 조건 1·3으로 이동) · **「중지 요청」 행**(회신과 무관하게 살아 있다)
- **`src/types/game.ts`가 인용하는 ⓓ-2** — **카탈로그를 호스팅하지 않는 갈래에서도 도메인 순수 함수가 그대로 살아남는다**는 판정이다. ✅ T2.1·T2.2가 이미 그 모양으로 구현됐다
- **전문은 `plan-archive.md` §9.11에 있다.** 발송을 다시 결정하면 표 전체가 그대로 다시 쓰인다

## 5.9 미해결 결정

| 항목 | 상태 |
|---|---|
| **§9.1 광고를 붙일 것인가** | 🔓 **열린 선택지.** 붙이지 않았고 붙이기로 정하지도 않았다. 제휴·후원·유료는 🔒 닫힘. **운영비는 자비 부담** |
| **되돌릴 조건 셋 (§9.1)** | ① 공식 창구가 채워져 있을 것 ② 그 시점 원천의 ④축이 「허용」 또는 「해당 없음」일 것 ③ **②축이 그때도 남아 있는지를 먼저 판정할 것.** 🚨 **셋을 확인하지 않은 채 `NEXT_PUBLIC_ADSENSE_CLIENT`에 값을 넣지 않는다** |
| **§9.2 관리자 토큰** | ✅ 결정됨 — **T3.1까지 토큰 유지 + 전제 3.** ⓐ **256비트 난수 base64url 43자**(`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. 🚨 **`Get-Random`은 암호학적 난수원이 아니다**) ⓑ **카탈로그 복구는 로컬 덤프**(`CLAUDE.md`가 인용) ⓒ **관리자 API 파괴 표면 동결** |
| **A-8 PSA 원천** | ⏸ 열린 채. 아무것도 막지 않는다 |
| **파생이 두 자리에 선 것(확인 5)** | 조회 계층 · 라우트 핸들러. 마이그레이션 012가 여전히 선택지다 |
| **`:source` 표 두 벌(확인 6)** | 앱 · 워커. **합치기를 미룬 이유가 배포와 함께 사라진다 — 그날 다시 묻는다** |
| **ptcg 기본 포켓몬 판정 (§4.7 ⓗ)** | 재료가 없어 열린 채. 포켓몬 카탈로그를 넣는 날 다시 본다 |
