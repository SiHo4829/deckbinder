# CLAUDE.md — DeckBinder Developer Guide

## 📌 Project Overview

DeckBinder(덱바인더)는 TCG 플레이어와 컬렉터를 위한 종합 서포팅 웹 서비스입니다. Next.js App Router와 Supabase, Tailwind CSS 기반으로 구축됩니다.

## 🎨 Tech Stack & Conventions

- **State Management:** Zustand (Client state), TanStack Query (Server state)
- **Proxy/Scraper:** Cloudflare Workers (Handling CORS and proxy requests)

## 📐 Architecture & Coding Rules

1. **Core Domain Business Rules:**
   - **Crawler Restrictions — two different crawlers, two different rules. Do NOT apply one's rules to the other.**
     - **(A) Marketplace price crawler** (`workers/crawler`, `market_sessions`, Phase 2 T2.6–T2.11). Fetches live listings from Mercari / Rakuma / Yahoo Auctions on user request.
       - Search MUST be limited to **1 card per query**. Do NOT implement batch scraping here.
       - Enforce intentional delay UI (8–12 seconds Progressive Loading animation) during live search.
       - Basic filtering must support `All`, `A-Grade/Unopened`, and `PSA/BGS Graded`.
       - **Why:** these are anti-scalping controls, not data-access controls (`.claude/plan.md` §5.4). They stay even if the data path changes.
     - **(B) Card catalog ingestion** (backlog A-5). Populates our own `cards` table from the source site.
       - Batch collection is **allowed here** — it is what this task is. Rule (A)'s 1-card limit does NOT apply.
       - MUST be two stages: **collect → intermediate file**, then **import → DB**. Never write to the DB straight from the network.
       - The importer MUST support a dry run, and MUST NOT be run without a fresh `npm run db:dump` (`.claude/plan.md` §9.2 ⓑ).
       - Rate limiting is **our** responsibility: the source's `robots.txt` returns 404, so there is no `Crawl-delay` to follow. Serial requests, concurrency 1, an explicit request cap, and an abort-after-N-failures rule are required before any run. A 404 `robots.txt` means the site said *nothing*, not that it said *yes*.
       - Source scope is fixed to what `.claude/plan.md` §4.4.1 lists. Do NOT add a source without amending that section first.
   - **Price Representation:**
     - Do NOT display stock/crypto-style price variation charts.
     - Display only **a single benchmark average price** (SNKRDUNK-style baseline).
   - **Database Architecture:**
     - Card DB must support tag-based search for TCG effect keywords (e.g., `Draw`, `Energy Accelerate`).
     - Cards that are the same card in play (different printings — parallel/alt art) are grouped by `base_code`, a generated column that strips the printing suffix from `code`. This replaced the original `similar_group_id` FK, which was dropped in migration 007 (see `.claude/plan.md` §4.6).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
