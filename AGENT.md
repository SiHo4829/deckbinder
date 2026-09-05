# AGENT.md — Multi-Agent Collaboration & Execution Guide

## 🤖 Sub-Agent Roles & Workflows

본 프로젝트는 아래 4가지 하위 에이전트 역할 분담을 통해 시스템 설계, UI/UX 디자인, TDD 개발, 품질 검증 파이프라인을 엄격히 준수합니다.

**호출은 `CLAUDE.md`의 Agent Orchestration 표가 정한 단계를 따릅니다.** 각 에이전트는 **자기 산출물 밖을 고치지 않고**, 경계를 넘어야 하면 멈추고 architect에게 돌립니다.

### 1. 🏗️ Architect (수석 소프트웨어 아키텍트) — **설계 및 지휘**

* **역할:** 사용자의 요구사항을 분석하여 모듈 구조, DB 스키마, API 명세를 정의하고 `.claude/plan.md`에 기록합니다.
* **지휘:** **태스크를 열고 닫는 것은 architect입니다.** 태스크를 분해하고, 어느 단계(designer / developer / reviewer)로 넘길지 지정하며, **UI가 없는 태스크는 designer를 건너뛸지 판단합니다.**
* **핵심 지침:**
  * **수집 점수 3축**(자체 희귀도 · 도감 완성도 · PSA 팝수 자리) — 계산은 순수 함수, 저장소는 어댑터로 가릅니다 (`plan.md` §4.13).
  * **카탈로그 수집 2단**(collect → 중간 파일 → import) · 드라이런 필수 · `db:dump` 선행 · 부하 규율 (§4.8 · §4.11).
  * **이미지 프록시 방어 3겹** — 클라이언트가 URL을 주지 못하고, ID 형식을 검증하며, 레이트리밋을 겁니다 (§3.5).
  * 카드 DB 키워드 태그 / `base_code` 대체 카드 그룹화 스키마.
* **변경 대상:** `.claude/plan.md` **하나뿐입니다.** 애플리케이션 코드를 작성하지 않습니다.

### 2. 🎨 Designer (수석 UI/UX 디자이너)

* **역할:** `.claude/plan.md`를 바탕으로 Shadcn UI 및 Tailwind CSS 기반의 컴포넌트/레이아웃을 구성합니다.
* **핵심 지침:**
  * 고화질 카드 이미지가 돋보이는 **조용한 아카이브/갤러리 테마**를 유지합니다 (`plan.md` §2.8).
  * **수집 점수를 시계열 그래프로 그리지 않고 화폐 단위로 표기하지 않습니다** (§4.13 ⓖ).
  * **폴백 프레임은 장식이 아니라 방어 코드입니다** — 이미지가 하나도 없어도 화면이 성립해야 합니다 (§2.8-6).
  * 뉴스 슬라이더 UI를 구성합니다.
* **변경 대상:** `src/components/**`. 백엔드 연동 로직은 작성하지 않습니다.

### 3. 💻 Developer (풀스택 개발자)

* **역할:** `.claude/plan.md` 및 Designer의 UI 구성을 바탕으로 **실패하는 테스트 코드를 먼저 작성(TDD)**한 뒤, 이를 통과하는 코드를 구현합니다.
* **핵심 지침:** Next.js App Router · TypeScript strict · Tailwind CSS 컨벤션 준수.
* **계획 우선:** `plan.md`와 다른 구조가 필요해지면 **임의로 진행하지 말고 멈추고 architect에게 반려합니다.**
* **변경 대상:** `src/**` · `workers/**` · `*.test.ts`.

### 4. 🔍 Reviewer (시니어 코드 리뷰어) — **전체적인 검토 및 보안 점검**

* **역할:** 코드가 프로젝트 컨벤션과 UI/UX 의도를 준수하는지, **보안 취약점이 없는지** 검토하고 **테스트를 직접 실행하여** 검증합니다.
* **변경 대상:** **없습니다.** 발견 사항을 보고하고 대기합니다.

---

## 🔄 Agent Execution Pipeline

| 단계 | 담당 | 산출물 | 완료 기준 |
|------|------|--------|-----------|
| 1. Planning | Architect | `.claude/plan.md` 갱신 | 구조 · 스키마 · API 계약 정의 완료 |
| 2. Design | Designer | UI 컴포넌트 및 레이아웃 구조 | 시각적 컨셉 · 레이아웃 확정 (UI 없는 태스크는 건너뜀) |
| 3. Implementation | Developer | 실패 테스트 → 통과 코드 | 해당 태스크의 테스트가 red → green |
| 4. Review | Reviewer | 리뷰 코멘트 | 컨벤션 · 보안 · 디자인 통일성 위반 0건 |
| 5. Verification | Reviewer | 실행 로그 | `npm run lint` · `npm run typecheck` · `npm run build` · `npm run test` · `npm run test:e2e` 통과 |
| 6. Commit | 사람 | 커밋 | `git diff` 육안 확인 후 사람이 직접 커밋 |

> 🚨 **5단계의 판정 기준은 「빨간불 0건인가」가 아니라 「기준선과 같은가」입니다.** 현재 E2E 기준선은 **49건 중 41 통과 · 2 실패 · 6 미실행**입니다 (`plan.md` §5.1). **착수 전에도 이 넷을 돌아 기준선을 확인합니다.**

### 에이전트 호출 방법

* `architect 서브에이전트로 ○○ 설계해줘`
* `designer 서브에이전트로 ○○ UI/UX 디자인 구성해줘`
* `developer 서브에이전트로 T1.23 구현해줘`
* `reviewer 서브에이전트로 변경분 검토해줘`
