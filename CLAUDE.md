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
   - **Card catalog ingestion** (`.claude/plan.md` §4.8 · §4.10 · §4.11). Populates our own `cards` table from the source site.
     - Batch collection is **allowed** — it is what this task is.
     - MUST be two stages: **collect → intermediate file**, then **import → DB**. Never write to the DB straight from the network.
     - The importer MUST support a dry run, and MUST NOT be run without a fresh `npm run db:dump` (`.claude/plan.md` §9.2 ⓑ).
     - Rate limiting is **our** responsibility: the source's `robots.txt` returns 404, so there is no `Crawl-delay` to follow. Serial requests, concurrency 1, an explicit request cap, and an abort-after-N-failures rule are required before any run. A 404 `robots.txt` means the site said *nothing*, not that it said *yes*.
     - Source scope is fixed to what `.claude/plan.md` §4.4.1 lists. Do NOT add a source without amending that section first.
   - **Collection Score:**
     - 컬렉션의 가치는 **자체 수집 점수**로 표현한다 (`.claude/plan.md` §4.13).
     - **화폐 단위(원 · 엔) 표기를 만들지 않는다.**
     - **시계열 그래프·등락률·변동 차트를 만들지 않는다.**
   - **Database Architecture:**
     - Card DB must support tag-based search for TCG effect keywords (e.g., `Draw`, `Energy Accelerate`).
     - Cards that are the same card in play (different printings — parallel/alt art) are grouped by `base_code`, a generated column that strips the printing suffix from `code`. This replaced the original `similar_group_id` FK, which was dropped in migration 007 (see `.claude/plan.md` §4.6).

> **폐기 기록 (2026-09-03).** 매물 가격 크롤러(메르카리 · 라쿠마 · 야후옥션)와 단일 기준가 표기는 사용자 결정으로 폐기됐다. 그 조항이 걸고 있던 되팔이 방지 통제(1카드 1쿼리 · 8~12초 연출 · 상태 필터 3종)도 함께 사라졌다 — **주어가 없어졌기 때문이지 규칙이 틀려서가 아니다.** 되살리려면 이 절과 `.claude/plan.md` §4.4.1을 먼저 고친다. 설계 원문은 `.claude/plan-archive.md`에 있다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
