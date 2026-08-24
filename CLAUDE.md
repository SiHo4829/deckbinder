# CLAUDE.md — DeckBinder Developer Guide

## 📌 Project Overview

DeckBinder(덱바인더)는 TCG 플레이어와 컬렉터를 위한 종합 서포팅 웹 서비스입니다. Next.js App Router와 Supabase, Tailwind CSS 기반으로 구축됩니다.

## 🛠 Commands & Environment

- **Install Dependencies:** `npm install`
- **Development Server:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`

## 🎨 Tech Stack & Conventions

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (Strict mode mandatory)
- **Styling:** Tailwind CSS (Shadcn UI preferred)
- **State Management:** Zustand (Client state), TanStack Query (Server state)
- **Backend & DB:** Supabase (PostgreSQL, Row Level Security enabled)
- **Proxy/Scraper:** Cloudflare Workers (Handling CORS and proxy requests)

## 📐 Architecture & Coding Rules

1. **Directory Structure:**
   - `src/app/`: Next.js App Router pages and API routes
   - `src/components/`: Reusable UI components (Modularized into `ui/`, `features/`, `common/`)
   - `src/lib/`: Utility functions, Supabase client, API helpers
   - `src/types/`: TypeScript interface definitions

2. **Core Domain Business Rules:**
   - **Crawler Restrictions:**
     - Search MUST be limited to **1 card per query**. Do NOT implement batch scraping for crawler requests.
     - Enforce intentional delay UI (8–12 seconds Progressive Loading animation) during live search.
     - Basic filtering must support `All`, `A-Grade/Unopened`, and `PSA/BGS Graded`.
   - **Price Representation:**
     - Do NOT display stock/crypto-style price variation charts.
     - Display only **a single benchmark average price** (SNKRDUNK-style baseline).
   - **Database Architecture:**
     - Card DB must support tag-based search for TCG effect keywords (e.g., `Draw`, `Energy Accelerate`).
     - Cards that are the same card in play (different printings — parallel/alt art) are grouped by `base_code`, a generated column that strips the printing suffix from `code`. This replaced the original `similar_group_id` FK, which was dropped in migration 007 (see `.claude/plan.md` §4.6).

3. **Code Quality Standards:**
   - Maintain strict typing; avoid `any` wherever possible.
   - All server API calls must handle gracefully with structured error boundaries.
   - Use server components (`RSC`) by default; add `'use client'` only when state/interactivity is required.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
