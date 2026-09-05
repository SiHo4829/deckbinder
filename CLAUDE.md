# CLAUDE.md — DeckBinder Developer Guide

## 📌 Project Overview

DeckBinder(덱바인더)는 TCG 플레이어와 컬렉터를 위한 종합 서포팅 웹 서비스입니다. Next.js App Router와 Supabase, Tailwind CSS 기반으로 구축됩니다.

## 🎨 Tech Stack & Conventions

- **State Management:** Zustand (Client state), TanStack Query (Server state)
- **Proxy/Scraper:** Cloudflare Workers (Handling CORS and proxy requests)

## 🤖 Agent Orchestration (필수)

구현 작업은 단계별로 전담 서브에이전트에 위임한다. 세부 역할·핸드오프 문구는 `AGENT.md`.

| 단계 | 에이전트 | 하는 일 | 고치는 것 |
|---|---|---|---|
| 설계 · **지휘** | **architect** | 요구 분석 · 태스크 분해 · 모듈/스키마/API 계약 확정 · 다음 단계 지시 | `.claude/plan.md` **만** |
| 디자인 | **designer** | 컴포넌트 구조 · Tailwind/shadcn 레이아웃 | `src/components/**` |
| 개발 | **developer** | 실패 테스트 → 통과 구현 (TDD) | `src/**` · `workers/**` · `*.test.ts` |
| 검토 · **보안** | **reviewer** | 컨벤션 · 보안 · 범위 검토 + 테스트 직접 실행 | **아무것도 고치지 않는다** |

- **architect가 지휘한다.** 태스크를 열고 닫는 것은 architect이고, 나머지 셋은 자기 단계만 한다.
- **자기 산출물 밖을 고치지 않는다.** 경계를 넘어야 하면 멈추고 architect에게 돌린다.
- **UI가 없는 태스크는 designer를 건너뛴다.** 그 판단은 architect가 한다.
- **reviewer는 커밋 단위로 돈다.** 마지막에 한 번이 아니다.
- **커밋은 사람이 한다.** 에이전트는 `git commit`을 실행하지 않는다.

## 📐 Architecture & Coding Rules

1. **Core Domain Business Rules:**
   - **No monetization — 이 서비스로 수익을 내지 않는다 (2026-09-05 사용자 확정).**
     - 광고(애드센스 포함) · 제휴 링크 · 후원 · 유료 기능 · 결제를 **만들지 않는다.** 운영비는 자비 부담이다.
     - **되돌릴 조건이 없다.** 「광고는 열린 선택지」로 열려 있던 결정(`.claude/plan.md` §9.1 · 백로그 E-2 · 사용자 일감 3)은 전부 닫혔다.
     - 🚨 **「비영리」를 우리 행위의 정당화 근거로 쓰지 않는다 — 사실 서술로만 쓴다.** 원천 약관의 ②축(데이터 재사용)·③축(이미지) 금지 조항은 **영리성을 조건으로 달지 않고**(`docs/crawler-compliance.md` §6.1), 토에이는 「非営利であっても…行っておりません」를 명문화했다(같은 문서 §10.3 ⓑ). **수익화를 안 하는 것이 수집을 허용하지 않는다.**
     - **꾸미기 요소 · 칭호 · 프로필 보상은 전량 무료다. 판매하지 않는다** — 개별 판매 · 묶음 · 시즌패스 · 구독 · 「후원하면 준다」를 전부 포함한다.
     - **확률형 요소를 만들지 않는다** — 뽑기 · 상자 · 랜덤 지급과 그 연출까지. 🚨 **무료 확률형도 만들지 않는다.**
     - **재화 개념을 만들지 않는다** — 포인트 · 젬 · 코인 · 티켓처럼 「모아서 교환하는 단위」를 **스키마에도 화면에도** 만들지 않는다.
     - **해금은 잔고가 아니라 파생값이다** — 칭호 · 꾸미기 해금은 「무엇을 가졌는가」에서 계산하고, **지급 이력 · 잔액 테이블을 만들지 않는다.** ⚠️ 대가를 알고 고른 것이다: 분모가 늘면 칭호가 조용히 내려간다(`.claude/plan.md` §4.14-3).
     - **꾸미기 에셋에 공식 저작물을 쓰지 않는다** — 카드 아트 · 로고 · 캐릭터 일러스트 · 상표. 자체 제작(또는 명시적 허용 라이선스)만 쓴다. 🚨 **무료라는 것이 이 제한을 낮추지 않는다**(`docs/crawler-compliance.md` §10.3 ⓑ).
     - 🚨 **이 하위 조항들에는 되돌릴 조건이 없다** — No monetization의 하위이기 때문이다.
   - **Card catalog ingestion** (`.claude/plan.md` §4.8 · §4.10 · §4.11). Populates our own `cards` table from the source site.
     - Batch collection is **allowed** — it is what this task is.
     - MUST be two stages: **collect → intermediate file**, then **import → DB**. Never write to the DB straight from the network.
     - The importer MUST support a dry run, and MUST NOT be run without a fresh `npm run db:dump` (`.claude/plan.md` §9.2 ⓑ).
     - Rate limiting is **our** responsibility: the source's `robots.txt` returns 404, so there is no `Crawl-delay` to follow. Serial requests, concurrency 1, an explicit request cap, and an abort-after-N-failures rule are required before any run. A 404 `robots.txt` means the site said *nothing*, not that it said *yes*.
     - Source scope is fixed to what `.claude/plan.md` §4.4.1 lists. Do NOT add a source without amending that section first.
     - 🚨 **§4.4.1의 원천 목록은 *상한*이지 현재값이 아니다.** 이미지 프록시(§3.5)와 수집기(§4.8 ⓔ)의 화이트리스트는 **각각 따로 열린다** — 원천이 §4.4.1에 실렸다고 그 둘이 따라 열리지 않는다. ⚠️ 이 반올림이 이 절에서 가장 일어나기 쉬운 사고다.
   - **Collection Score:**
     - 컬렉션의 가치는 **자체 수집 점수**로 표현한다 (`.claude/plan.md` §4.13).
     - **화폐 단위(원 · 엔) 표기를 만들지 않는다.**
     - **시계열 그래프·등락률·변동 차트를 만들지 않는다.**
   - **Database Architecture:**
     - Card DB must support tag-based search for TCG effect keywords (e.g., `Draw`, `Energy Accelerate`).
     - Cards that are the same card in play (different printings — parallel/alt art) are grouped by `base_code`, a generated column that strips the printing suffix from `code`. This replaced the original `similar_group_id` FK, which was dropped in migration 007 (see `.claude/plan.md` §4.6).

> **폐기 기록 (2026-09-03).** 매물 가격 크롤러(메르카리 · 라쿠마 · 야후옥션)와 단일 기준가 표기는 사용자 결정으로 폐기됐다. 그 조항이 걸고 있던 되팔이 방지 통제(1카드 1쿼리 · 8~12초 연출 · 상태 필터 3종)도 함께 사라졌다 — **주어가 없어졌기 때문이지 규칙이 틀려서가 아니다.** 설계 원문은 `.claude/plan-archive.md`에 있다.
>
> **2026-09-05 — 사용자가 재확정했다. 「되살리려면」 절차가 없어졌다.** 시세 수집 크롤링은 수익화 폐기와 함께 **영구 폐기**다. 위 **No monetization** 조항이 상위 근거이고, 되돌리려면 그 조항부터 사용자가 뒤집어야 한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
