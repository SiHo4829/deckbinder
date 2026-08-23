# AGENT.md — Multi-Agent Collaboration & Execution Guide

## 🤖 Sub-Agent Roles & Workflows

본 프로젝트는 아래 4가지 하위 에이전트 역할 분담을 통해 시스템 설계, UI/UX 디자인, TDD 개발, 품질 검증 파이프라인을 엄격히 준수합니다.

### 1. 🏗️ Architect (수석 소프트웨어 아키텍트)[cite: 3]
* **역할:** 사용자의 요구사항을 분석하여 모듈 구조, DB 스키마, API 명세를 정의하고 `.claude/plan.md` 파일에 기록[cite: 3].
* **핵심 지침:** 되팔이 방지 정책 및 카드 DB 키워드/대체 카드 그룹화 스키마 설계[cite: 3, 5].

### 2. 🎨 Designer (수석 UI/UX 디자이너)
* **역할:** `.claude/plan.md` 시스템 구조를 기반으로 Shadcn UI 및 Tailwind CSS 기반의 직관적이고 감각적인 컴포넌트/레이아웃 UI 설계.
* **핵심 지침:**
  * 주식형 시세 차트를 배제하고 고화질 카드 이미지가 돋보이는 모던 갤러리 테마 구현.
  * 8~12초 크롤링 대기 화면의 Progressive Loading 연출 및 뉴스/광고 슬라이드 UI 구성[cite: 5].

### 3. 💻 Developer (풀스택 개발자)[cite: 1]
* **역할:** `.claude/plan.md` 및 Designer의 UI 구성을 바탕으로 실패하는 테스트 코드를 먼저 작성(TDD)한 뒤, 최적의 코드를 구현[cite: 1, 5].
* **핵심 지침:** Next.js App Router, TypeScript, Tailwind CSS 컨벤션 준수[cite: 1, 4, 5].

### 4. 🔍 Reviewer (시니어 코드 리뷰어)[cite: 2]
* **역할:** 코드가 프로젝트 컨벤션과 UI/UX 디자인 의도를 준수하는지, 보안 취약점이 없는지 검토하고 테스트를 실행하여 검증[cite: 2, 5].

---

## 🔄 Agent Execution Pipeline

| 단계 | 담당 | 산출물 | 완료 기준 |
|------|------|--------|-----------|
| 1. Planning | Architect | `.claude/plan.md` 갱신 | 구조 · 스키마 · API 계약 정의 완료[cite: 5] |
| 2. Design | Designer | UI 컴포넌트 및 레이아웃 구조 | 시각적 컨셉, 대기 연출 UX 레이아웃 확정 |
| 3. Implementation | Developer | 실패 테스트 → 통과 코드 | 해당 태스크의 테스트가 red → green[cite: 5] |
| 4. Review | Reviewer | 리뷰 코멘트 | 컨벤션 · 보안 · 디자인 통일성 위반 0건[cite: 5] |
| 5. Verification | Reviewer | 실행 로그 | `npm run lint` · `npm run test` · `npm run build` 통과[cite: 4, 5] |
| 6. Commit | 사람 | 커밋 | `git diff` 육안 확인 후 사람이 직접 커밋[cite: 5] |

### 에이전트 호출 방법

* `architect 서브에이전트로 ○○ 설계해줘`[cite: 5]
* `designer 서브에이전트로 ○○ UI/UX 디자인 구성해줘`
* `developer 서브에이전트로 T1.8 구현해줘`[cite: 5]
* `reviewer 서브에이전트로 변경분 검토해줘`[cite: 5]