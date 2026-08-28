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
| 손입력 참조 원천은 **`onepiece-cardgame.kr` 하나**. 일본 2곳은 배제. **근거는 "허용 확인"이 아니라 "금지 근거를 찾지 못함"이고, 문의 폐기로 그 공백은 영구화됐다** | §4.4.1 · §0.1 ⓒ |
| `cards.name_ja`는 `not null`, `name_ko`는 nullable | §4.4 |
| 대체 카드는 `base_code`(생성 컬럼)로 판정. `similar_group_id`는 007에서 제거 | §4.6 |
| 단일 앱 구조(`src/` 4구획). 모노레포 아님 | CLAUDE.md 지정 |
| shadcn base는 `radix` (CLI 기본값 `base` 아님) | §2.6 |
| RLS 정책과 **함께 GRANT를 반드시 준다** | §4.1-1 |
| 쓰기 직후 정확성이 필요한 라우트는 **동적(SSR)**. ISR은 전제가 아니다 | §1 P1 · T1.12-7 |
| 시간 조건 RLS(`<= now()`)를 쓰면 앱이 찍는 시각에 **마진을 준다**(`published_at` = `now - 5초`) | §2.7 ★ |
| 관리자 인증은 **T3.1까지 토큰 방식 유지**. 전제 3가지가 붙는다 | §9.2 ⓒ |
| 카탈로그 복구는 **로컬 덤프**로 한다. Supabase 자동 백업에 의존하지 않는다 | §9.2 ⓑ |
| ~~**공식 창구(개발자 가이드라인 · 공식 API)를 먼저 확인한다.** 원천 판단의 기준을 "금지 근거 부재"에서 옮긴다~~ → **조사 완료(2026-08-26). 6곳 중 열린 창구 0곳이라 기준을 옮기지 못했다. §4.4.1의 근거는 "금지 근거 부재"로 남는다** | §0.1 ⓐ ★ |
| **T2.7 대상 3곳(메르카리 · 라쿠마 · 야후옥션)에 공식 API 경로가 없다.** 어댑터 설계는 API 호출로 바뀌지 않는다 | §9.3 ⓒ ★ |
| ~~**애드센스 수익화는 폐기.** 광고를 붙이지 않는다~~ → **수익화를 하지 않는다.** 광고 · 제휴 · 후원 · 유료 기능 어느 것도 붙이지 않는다. **T3.6(제휴 링크 캐러셀)은 폐기** | §0.1 ⓒ · §9.1 ★ |
| **권리자 문의 메일을 보내지 않는다.** 초안 4통은 `docs/permission-inquiry-drafts.md`에 **보관용**으로 남는다. ⚠️ **묻지 않는 것이 §4.4.1의 근거를 바꾸지 않는다 — 오히려 공백을 메울 유일한 방법이 없어져 공백이 영구화된다** | §0.1 ⓒ · §4.4.1 결정 6 · §9.11 ⓖ ★ |
| **텍스트(코드 · 이름 · 효과 · 성능)는 우리 DB에 저장하고, 이미지 바이트는 저장하지 않는다.** 이미지는 원본 URL 핫링크 + 실패 시 폴백 프레임 | §9.4 ★ |
| **핫링크의 `referrerPolicy` 값은 `no-referrer`로 확정.** ⚠️ **효과는 미실측이고 서버 설정에 따라 양방향이라 "우회 수단"이 아니라 측정 항목이다** | §9.4 ⓑ · ⓒ · ⓔ ★ |
| **폴백 프레임은 장식이 아니라 방어 코드다 — 이미지가 하나도 없어도 서비스가 성립해야 한다** | §9.4 ⓑ · ⓓ · 백로그 B-6 ★ |
| **게임 룰은 수치(60/50 · 7/5 · 4장)를 DB `games` 행에서만 읽고, 구조 룰(존 · 리더 색상 · 멀리건)만 코드에 둔다.** 숫자를 도메인에 다시 쓰지 않는다 | §4.7 ⓑ ★ |
| **`src/lib/domain/**`은 카드 DB 타입을 import 하지 않는다.** 카드는 `DeckSlot`(원시값)으로만 들어오고, 규칙은 `no-restricted-imports`가 강제한다 | §4.7 ⓓ ★ |

---

## 0.1 운영 방침 — 확정 (2026-08-26 ⓐⓑ · 2026-08-28 ⓒ)

> **이 절이 다른 모든 절보다 앞선다.** 아래 ⓐⓑⓒ와 충돌하는 기존 서술은 무효다. 반영된 곳은 **§1 P1 · §2.8-3 · §3.1 · §3.2 · §4.4.1(원천 표 · 결정 5·6·7 · ⓒ) · §6 · §8 다음 작업 · §9.1 · §9.3 ⓒ · §9.4 ⓑⓒⓔ · §9.11 ⓕⓖ**다.
>
> ⚠️ **ⓒ가 ⓑ의 일부를 무효로 만든다.** ⓑ는 「애드센스만 폐기했고 T3.6이 남아 있으므로 "비영리"라고 쓰지 않는다」와 「코드 정리는 수익 모델이 정해진 뒤에 한다」를 전제로 쓰여 있는데, **ⓒ가 그 수익 모델을 "없음"으로 정했다.** ⓑ는 **애드센스 폐기의 근거로서** 그대로 유효하고, 위 두 전제만 ⓒ가 갈아 끼운다.

### ⓐ 공식 창구 조사 — **닫혔다. 결과는 기대와 반대다**

**무엇을 물었나.** 각 TCG 회사의 **개발자 가이드라인 · API 이용약관 · 2차 창작 가이드라인**, 중고 거래 3곳의 **공식 API · 제휴 정책**. §9.3(약관)과 §4.4.1(문의 메일)이 **"하지 말라고 쓰여 있는가"**를 물은 데 반해 이 절은 **"어떻게 하라고 쓰여 있는가"**를 물었다. 목적은 기능 추가가 아니라 **원천 판단의 근거를 "금지 근거 부재"에서 "공식 창구"로 옮기는 것**이었고, §9.8대로 전 테이블이 0행이라 **방침을 바꿔도 버릴 것이 없는 동안**에 하려고 최우선에 뒀다 — T1.14가 실데이터를 쌓기 시작하면 되돌리는 비용이 매일 오른다.

**6개 대상 전부에 ⑤ 공식 창구 축을 채웠다. 열린 곳은 0곳이다.** 원문 인용 · 확인 URL · 확인일은 `docs/crawler-compliance.md` **§10.1~§10.6**에 있다.

| # | 대상 | ⑤ 판정 | 한 줄 |
|---|------|---------|-------|
| 1 | 포켓몬 | **혼합** | 포켓몬코리아만 **열림(조건 미기재)** — 「제휴안내」 이메일. 주식회사 포켓몬·TPCi는 **닫힘** |
| 2 | 반다이 · BANDAI CARD GAMES | **못 찾음** | 「事前許諾」의 신청 경로를 어느 문서에서도 찾지 못했다 |
| 3 | 집영사 · 토에이 | **닫힘** | 둘 다 「個人の方に対して…許諾は行っておりません」를 FAQ에 명문화 |
| 4 | 메르카리 | **스코프 불일치** | Shops API는 실재하나 **자기 상점 전용** |
| 5 | 라쿠마 | **없음(문서로 부재 확인)** | 라쿠텐 API 카탈로그에 부재 + 인접 API가 프리마·C2C를 명시 제외 |
| 6 | 야후옥션 | **닫힘 — 2020년 1월 종료** | 종료 공지 4회 |

**→ 옮길 곳이 없어 기준을 옮기지 못했다.** 이 절은 「공식 창구가 문서로 열려 있다면 §9.11의 회신 대기 갈래가 통째로 필요 없어진다」는 기대로 시작했고 **그 가설은 깨졌다. 따라서 §4.4.1의 근거는 "금지 근거를 찾지 못함"으로 남고, 그 절의 🚨 문단은 그대로 유지된다** — 오히려 더 강해진다(§4.4.1 ⓒ).

> ⚠️ **2026-08-28 — 「회신 대기 갈래」는 결국 없어졌지만 이 절이 바란 방식이 아니다.** ⓐ가 기대한 것은 **근거가 채워져서** 그 갈래가 불필요해지는 것이었고, 실제로 일어난 것은 **묻지 않기로 해서** 갈래가 사라진 것이다(ⓒ · §9.11 ⓖ). **결과 모양은 같고 근거 상태는 정반대다** — 전자는 공백이 메워지는 것이고 후자는 공백이 굳는 것이다. **이 둘을 같은 것으로 읽지 않는다.**

> **⚠️ "못 찾음"을 빈칸으로도 허용으로도 세지 않는다.** 닫히는 조건은 **"⑤축이 채워질 것"**이었지 **"창구가 발견될 것"**이 아니었다. 창구를 못 찾은 것도 **검색 범위와 함께 기록되면 채워진 것**이다 — §4.4.1이 미끄러진 자리가 정확히 그 반대(못 찾음을 허용으로 읽음)다. 그리고 **"못 찾음"과 "닫힘"도 다르다**: 3·6번은 문서가 우리를 배제했거나 창구가 종료된 것이라 **공백이 아니라 답이다.** 기록은 **찾은 문서의 원문 인용**으로만 했고 못 찾은 것은 검색 범위와 함께 남겼다. **법률 자문이 아니라는 것도 그대로다.**

**그럼에도 이 조사는 값을 했다. 넷이다.**

1. **T2.7의 설계 전제가 확정됐다 — 그것이 이 절을 최우선에 둔 이유였다.** 「공식 API가 있으면 어댑터 3종이 스크래핑에서 API 호출로 바뀐다」가 순서 근거였는데 **답은 "바뀌지 않는다"다.** 세 곳 모두 공식 경로가 없다. **T2.6 스캐폴딩 전에 받았다**(`docs/crawler-compliance.md` §10.8 ⓐ)
2. **거래 3곳의 위험 무게중심이 카드 4곳과 반대다.** 카드 4곳은 ①(접근)이 비고 ②가 강했는데, **거래 3곳은 ①이 가장 강하다** — 라쿠마·야후옥션의 `robots.txt`가 검색과 낙찰이력을 파라미터 단위로 지목해 Disallow한다. ⚠️ **`robots.txt`에서 "높음"이 나온 것은 이 프로젝트에서 처음이다**
3. **`onepiece-cardgame.kr`의 공백에 인접 재료가 생겼다 — 방향은 부정적이다** (§10.3 · §4.4.1 결정 7)
4. ~~**문의 메일 초안을 고칠 근거가 둘 늘었다** (§9.11 ⓕ)~~ → ⚠️ **2026-08-28에 발송이 폐기돼 이 값은 실현되지 않았다**(ⓒ). **넷 중 이것 하나만 무효가 된다** — 1·2·3은 문의와 무관한 관측이다. 다만 **3번(§10.3의 집영사·토에이 방침)이 문의 폐기 결정의 배경 재료 중 하나로 쓰였다**(§4.4.1 ⓓ)

**남은 공백 10건은 `docs/crawler-compliance.md` §10.7에 있다.** 그중 가장 무거운 것은 **라쿠마 「ラクマのルール」 가이드(`faq.fril.jp`)**다 — 메르카리가 **규약 → 가이드 위임** 구조였으므로 라쿠마도 같을 수 있고, 그렇다면 지금 "자동화 금지 조항 못 찾음"으로 적힌 판정이 뒤집힌다. **2026-08-28에 두 경로를 재시도했고 둘 다 HTTP 403이었다**(§9.3 ⓒ 말미 · `docs/crawler-compliance.md` §10.5 ⓒ). **에이전트 도구로 여는 길은 남아 있지 않고, 사람이 브라우저로 여는 경로만 남았다.**

**⑤축이 열렸더라도 §1 P2는 그대로였다.** 외부 접근은 Cloudflare Workers에서만 한다 — 근거가 "스크래핑 격리"에서 "API 키 은닉과 쿼터 통제"로 바뀌었을 뿐이다. **`CLAUDE.md`의 크롤러 제약(1회 1장 · 8~12초 연출)도 유지된다** — 되팔이 방지 장치(§5.4)라 데이터 경로와 무관하다.

> **압축 기록 (2026-08-28).** 이 절에서 **조사 과정 서술**(확인할 대상 6행 목록 · "왜 최우선인가" · 기록 형식 지시 · 순서 영향 3항 · 닫히는 조건 대조표)을 지웠다. 결과가 나온 뒤로는 유지 비용만 남는 서술이고, **결과 전문은 `docs/crawler-compliance.md` §10에 그대로 있다.** 남긴 것은 ①근거가 옮겨지지 않았다는 사실 ②⑤축 6곳 판정 ③이 조사가 값을 한 4가지 ④남은 공백이다.

### ⓑ 애드센스 수익화 — 폐기

**결정: 애드센스를 붙이지 않는다.** §9.1의 준비물 ①~⑤는 전부 무효다. 되돌릴 조건은 §9.1에 남긴다.

**이 결정이 실제로 사는 곳은 ⓐ다.** §9.3의 4축 중 **④(상업적 이용)가 일정에서 빠진다.** 「영리목적」(포켓몬코리아 제14조③) · 「상업적으로 이용하는 행위」(제16조 3-1)를 조건으로 건 조항들은 **"나중에 광고를 붙이면"이라는 미래 시제로 걸려 있었는데, 그 미래를 없앴다.** §4.4.1 결정 5가 "광고 없이 먼저 배포하고 나중에 붙인다"였던 것이 **"붙이지 않는다"가 된다** — 순서 문제가 아니라 항목이 사라진다.

> **일본 2곳은 그래도 안 열린다.** §4.4.1의 표대로 `pokemon-card.com`과 `onepiece-cardgame.com`은 기준선을 영리성이 아니라 **사용 목적 그 자체**(「個人的に楽しむ場合に限って」 · 「私的使用…を超えて」)로 그었다. 광고를 없애도 공개 서비스는 그 선 밖이다. **이 결정으로 열리는 것은 포켓몬코리아(결정 3) 하나다.**

**~~⚠️ 그러나 "애드센스 폐기 = 비영리"가 아니다.~~** ~~T3.6(제휴 링크 캐러셀)이 로드맵에 그대로 있고, 제휴 수수료는 문언상 「영리목적」에 애드센스와 똑같이 닿는다.~~ → **2026-08-28에 ⓒ가 T3.6을 폐기해 이 유보가 풀렸다.** 다만 **풀린 것은 "④축(상업적 이용)에 걸릴 미래가 남아 있다"는 조건 하나뿐이고, ②③축은 그대로다** — 정확한 경계는 §9.1이 사이트별로 갈라 적었다. ⚠️ **"비영리이므로 허용된다"로 읽으면 안 된다.**

**~~코드는 지금 건드리지 않는다.~~** ~~지우는 작업은 수익 모델이 정해진 뒤 한 번에 한다.~~ → **ⓒ가 정했다. 제거는 백로그 E-2로 세웠다**(§8). 이 문단의 관측 자체는 그대로 유효하다 — `AdSlot`은 `NEXT_PUBLIC_ADSENSE_CLIENT`가 없으면 아무것도 렌더하지 않고(§3.2) 그 환경변수는 `.env.example`에 빈 값으로만 있어 **동작상 이미 폐기 상태**다. **그래서 제거는 급하지 않고, 급하지 않다는 것이 안 해도 된다는 뜻은 아니다.**

**문의 메일 초안은 2026-08-28 오전에 고쳤고, 같은 날 발송하지 않기로 정해졌다(ⓒ).** 초안을 고친 작업이 헛되지는 않았다 — **보관본이 옛 방침(광고 게재 예정)을 사실처럼 묻는 상태로 남는 것과 현재 방침을 반영한 상태로 남는 것은 다르다.** ⚠️ **`docs/crawler-compliance.md` §7.1의 애드센스 서술은 2026-08-28에 ⓒ와 함께 고쳤다** — 이 절과 §9.1이 그 자리를 대체한다.

**SEO는 그대로 간다.** §1 P1의 결론(RSC 기본 · 쓰기 직후 정확성이 필요한 라우트는 동적)은 **애드센스가 아니라 SEO가 근거였고 SEO는 남는다.** `/privacy`도 유지한다 — 심사 요건이라서가 아니라 **로그인(T3.1)과 개인정보를 다루는 서비스의 일반 요건**이기 때문이다. `ComingSoon`(§2.8-3)도 유지하되 근거가 "심사가 보는 화면"에서 **사용자 이탈 방지**로 바뀐다.

### ⓒ 수익화 포기 · 문의 폐기 · `no-referrer` 확정 (2026-08-28 사용자 결정)

**사용자가 세 가지를 정했다. 셋 다 "미뤄 둔 것을 닫는" 결정이다.**

| # | 결정 | 무엇을 닫았나 |
|---|------|---------------|
| 1 | **권리자 문의 메일을 보내지 않는다** | §4.4.1 결정 6 · §9.11의 회신 대기 전제 |
| 2 | **수익화하지 않는다 — 광고 · 제휴 · 후원 · 유료 기능 전부.** T3.6 폐기 | §9.1의 ★ 진짜 미해결(운영비를 무엇으로 대는가). 후보 넷 중 **"수익화하지 않음"**이 선택됐다 |
| 3 | **핫링크의 `referrerPolicy`는 `no-referrer`** | §9.4 ⓑ · 백로그 B-6의 값이 확정됐다 |

> **⚠️ 재확인이지 변경이 아닌 것 — 섞지 않는다.** 사용자 결정문에는 「텍스트는 내 DB에 직접 구축 · 이미지는 `image_url`만 저장하고 핫링크 · 차단되면 텍스트 프레임」도 함께 적혀 있으나 **이것은 2026-08-26에 §9.4 ⓐ~ⓔ로 이미 확정된 내용이고 §0 결정표에도 있다.** 같은 결정을 두 번 적어 문서를 늘리지 않는다. **이 재확인이 실제로 바꾼 것은 하나뿐이다 — 폴백 프레임의 성격이 "엑박 대신 보기 좋은 것"에서 「방어 코드」로 격상됐다**(→ §9.4 ⓑ · B-6 우선순위).

**1) 문의 폐기 — 🚨 이것이 §4.4.1의 근거를 바꾸지 않는다. 반대다.**

§9.11 ⓑ가 이미 적어 뒀다: **「묻지 않는다고 해서 합법이 되는 것이 아니다」.** §4.4.1의 🚨 문단(근거가 "허용 확인"이 아니라 **"금지 근거를 찾지 못함"**)은 **그대로 유지된다.** 그리고 여기에 하나가 더해진다 — **그 공백을 메울 수 있는 유일한 방법이 문의였고(§9.11 ⓑ), 그것을 없앴으므로 공백은 이제 영구화된다.**

**즉 이 결정으로 위험이 줄어들지 않는다. 줄어든 것은 "묻는 비용"(§9.11 ⓑ — 거절 회신을 받고도 진행하면 위치가 나빠진다)이고, 그 대가로 공백을 닫을 경로를 잃었다.** 이 문서가 반복해서 경계해 온 미끄러짐이 정확히 이 자리에 있다 — **"안 물어봤으니 모르는 상태이고, 모르니 괜찮다"는 성립하지 않는다.**

**2) 수익화 포기 — ④축은 움직이지만 ②③축은 그대로다.**

**어느 축이 얼마나 움직이는지는 §9.1이 §9.3의 4곳 판정표를 근거로 사이트별로 갈라 적었다.** 여기서는 결론만 적는다: **현 유일 원천인 `onepiece-cardgame.kr`의 ④축은 애초에 "근거 없음"이었으므로 이 결정으로 아무것도 바뀌지 않는다.**

> **⚠️ "팬 사이트니까 괜찮다"로 미끄러지지 않는다 — `docs/crawler-compliance.md`가 정확히 반대를 실측했다.**
>
> - **②축(데이터 재사용) 금지 조항은 영리성을 조건으로 달지 않는다** (§6.1 판정표): 「すべての画像・テキスト・データの**無断転用、転載**をお断りします」 · 「**복제, 송신, 출판, 배포, 방송 기타 방법에 의하여**」 · 「他のインターネットなどの公衆ネットワーク上で**利用することはできません**」
> - **토에이 애니메이션은 명문화까지 했다** (§10.3 ⓑ): 「**非営利であっても**画像の使用許可や素材の提供は行っておりません」
>
> **비영리가 되어도 ②③축은 그대로 남는다.** 이 문서는 법률 자문이 아니며, **약관이 무엇이라고 쓰여 있는지만** 기록한다.

**3) `no-referrer` — 값은 확정, 효과는 미확정.**

값을 못박은 것이지 **효과를 확인한 것이 아니다.** `no-referrer`는 `Referer` 헤더를 아예 보내지 않게 하는데 **결과는 서버 설정에 따라 양방향이다** — 외부 `Referer`만 막는 서버에서는 통과하고, **빈 `Referer`도 막는 서버에서는 오히려 더 많이 차단된다.** `onepiece-cardgame.kr`에 대해 어느 쪽인지는 **실측하지 않으면 모르고, 이 세션에서 실측하지 않았다.** → **§9.4 ⓔ에 측정 항목으로 남겼다.**

**이 결정이 만든 일감 변화**

| 없어진 것 | 새로 생긴 것 |
|-----------|--------------|
| 사용자 일감 5(문의 메일 발송) · 6(수익 모델 결정) | 백로그 **E-2** — `AdSlot` · `NEXT_PUBLIC_ADSENSE_CLIENT` 제거 |
| 로드맵 **T3.6**(제휴 링크 캐러셀) · §3.2의 `affiliate-carousel.tsx` | **B-6 우선순위 상향** — 폴백이 방어 코드가 됐고, `no-referrer` 측정의 전제다 |
| §9.11의 「회신별 갈래」 표 (→ ⓖ) | §9.4 ⓔ의 **`no-referrer` 적용/미적용 실패율** 측정 항목 |

---

## 1. 설계 원칙

| # | 원칙 | 근거 |
|---|------|------|
| P1 | **읽기 중심, 쓰기 최소. RSC 기본.** SEO를 확보하는 것은 **서버 렌더**이지 ISR이 아니다 — ISR은 수단 중 하나일 뿐 전제가 아니다. 렌더 모드는 라우트마다 **"관리자 쓰기 직후 정확해야 하는가"** 하나로 가른다: 그렇다면 **동적(SSR)**, 아니라면 ISR. | CLAUDE.md: RSC 기본 / §0.1 ⓑ(애드센스를 폐기해도 SEO는 남는다) / §2.7 · T1.12-7 |
| P2 | **스크래핑은 앱 서버에서 분리** — 외부 사이트 접근은 전부 Cloudflare Workers에서만 수행. Next.js는 대상 사이트에 직접 접근하지 않는다. | CLAUDE.md: Proxy/Scraper |
| P3 | **되팔이 방지는 서버 계약으로 강제** — "1회 1장", "분당 3회", "8~12초 연출"은 프론트 제약이 아니라 API 스키마와 서버 쿼터로 강제한다. | CLAUDE.md: Crawler Restrictions |
| P4 | **도메인 로직은 프레임워크에서 분리** — 시뮬레이터 · 확률 · 가격 정규화는 `src/lib/domain`의 순수 함수로 두어 TDD가 쉬운 형태로 만든다. | AGENT.md: TDD 우선 |
| P5 | **웹 ↔ 워커 계약은 zod 스키마 공유** — 두 런타임이 `src/lib/validation`의 동일 스키마를 import 하여 계약 드리프트를 차단한다. | CLAUDE.md: strict typing |
| P6 | **시세는 기준가 1개만 노출** — 시계열/차트 API를 애초에 만들지 않는다. 히스토리는 내부 집계용으로만 보관. | CLAUDE.md: Price Representation |

> **P1의 "동적이면 SSR"이 SEO를 깎지 않는다.** 봇은 어느 쪽이든 완성된 HTML을 받는다. 동적으로 돌려 잃는 것은 **캐시 히트와 DB 왕복 비용**뿐이고, 트래픽이 0에 가까운 지금 그 값은 0이다. 얻는 것은 **정확성**인데 그게 손입력(T1.14)의 전제다.
>
> **되돌릴 조건 — 트래픽이 생겨 DB 왕복 비용이 실제로 측정되는 시점.** 그때 ISR로 되돌리려면 셋 중 하나가 성립해야 한다: ⓐ `revalidateTag`가 fetch Data Cache에 닿는지 재실측(§2.7 — 현 버전에서는 닿지 않는다) ⓑ 관리자 쓰기를 Server Actions로 옮겨 read-your-own-writes 경로를 쓴다(§5.1 API 계약 재작성) ⓒ Supabase 조회를 `fetch` 직호출로 바꿔 캐시 옵션을 쿼리 단위로 제어한다. **셋 다 확인하지 않은 채 세그먼트 `revalidate`를 다시 붙이지 않는다** — 그것이 이번 사고의 재발 경로다.

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
| **커서 키 ≠ 유니크 키** | `cards`의 유니크는 `(game_id, code)`인데 커서를 `code` 하나로 잡았다. 게임 필터 없이 훑을 때 두 게임에 같은 코드가 있으면 **카드 한 장이 조용히 사라진다.** 에러도 빈 결과도 아니라 눈치채기 어렵다 | 커서는 **유니크 제약과 같은 폭**이어야 한다. `(code, id)` 튜플로 정렬·비교한다 (007) |
| **`generateMetadata` + 페이지 본문의 중복 조회** | 둘이 같은 인자로 같은 조회를 각각 한 번씩 한다. Next 15+ 의 `fetch` 기본은 캐시 안 함이라 **DB 왕복이 2배**가 되는데 화면은 멀쩡하다 | 조회 함수를 React `cache()`로 감싼다. 캐시 범위가 렌더 1회라 최신성은 그대로다 |
| **eslint flat config는 `.gitignore`를 안 본다** | `supabase start`가 만드는 `supabase/.temp/`를 린트가 스캔해 남의 번들 코드에서 오류 수백 개가 쏟아진다 | `eslint.config.mjs`의 `globalIgnores`에 명시한다 |
| **PostgREST `.or()` 문자열 필터** | `.or("name_ja.ilike.%q%,name_ko.ilike.%q%")`처럼 조건을 **문자열로 이어 붙이는** API다. `q`에 사용자 입력의 **쉼표·괄호**가 그대로 들어가면 필터 문법이 깨진다. 400이 나면 그나마 낫고, 운이 나쁘면 조건이 조용히 다른 뜻으로 파싱된다 | 조립 전에 `q`에서 `[,()]`를 제거하거나 이스케이프한다 (관리자 카드 검색이 첫 사용처) |
| **`server-only` + jsdom 단위 테스트** | `server-only`의 exports 맵이 `react-server → empty.js` / `default → index.js`이고 **`index.js`는 `throw`만 있는 파일**이다. vitest는 `environment: "jsdom"`이라 `react-server` 조건이 걸리지 않아 `src/lib/admin/**`을 import 하는 순간 터진다 | `vitest.config.mts`의 `resolve.alias`로 `server-only`를 빈 모듈에 매핑한다. 이 alias가 없으면 `src/lib/admin/**`은 단위 테스트 자체가 불가능하다 |
| **로그인 화면에서 시작되는 비로그인 프리페치** | `/admin/login`이 admin 라우트 그룹 안에 있어 **레이아웃의 nav가 로그인 화면에도 렌더된다.** 프로덕션 빌드의 Next는 그 `<Link href="/admin">`을 **비로그인 상태로 프리페치**하고, `proxy.ts`가 쿠키 부재로 내보낸 `/admin/login?next=%2Fadmin`이 라우터 캐시에 남는다. 로그인이 성공(POST 200 + 쿠키 발급)해도 직후의 `router.push("/admin")`이 그 캐시를 써서 **다시 로그인 화면으로 튕긴다.** dev는 프리페치를 하지 않아 드러나지 않는다 | 인증 성공 후에는 `router.refresh()`로 캐시를 **먼저 버린 뒤** 이동한다(`admin-login-form.tsx`). 인증 상태에 따라 결과가 갈리는 흐름은 **프로덕션 빌드로 확인한다** — dev와 dev 기준 E2E는 통과한다 |
| **E2E 단언 타임아웃 < 콜드 라우트** | dev 서버는 라우트를 첫 요청에 컴파일하고, 프로덕션 서버도 첫 요청에서 모듈 로드 · Supabase 최초 연결을 한다. **클릭 후 이동을 기다리는 단언은 `page.goto`(내비게이션 30초)가 아니라 expect 타임아웃(기본 5초)을 쓰므로** 그 지연에 그대로 걸린다. 실행할 때마다 "그때 처음 열린 라우트"의 테스트가 깨져 증상이 산발적으로 보인다 | `tests/e2e/global-setup.ts`가 상세 라우트까지 미리 두드려 워밍업하고, `expect.timeout`을 15초로 올렸다 (§7) |
| **ISR 상세 라우트에 `loading.tsx`를 두면 `notFound()`가 소프트 404가 된다** | `loading.tsx`는 Suspense 경계를 만들어 라우트를 **스트리밍**시킨다. 스트리밍은 200으로 시작하므로 그 뒤에 `notFound()`를 던져도 **상태 코드를 바꿀 수 없다**(Next 16 `loading.js` 문서 "Status Codes"). `/cards/[cardId]` · `/news/[slug]`가 여기 해당한다 | **그 두 라우트에 `loading.tsx`를 두지 않는다.** 없으면 `notFound()`가 정상 404를 낸다 — A/B/A로 실측 확인했다(추가 전 404 → 추가 후 200 → 제거 후 다시 404). ⚠️ **`proxy.ts`에서 존재 여부를 미리 조회해 우회하는 방법으로 가지 말 것** — T1.12에서 한 번 그 길로 갔다가 되돌렸다. 상세 조회마다 DB 왕복이 1회 붙어 SSG/ISR의 이득을 상쇄하고, 보안 민감 파일인 `proxy.ts`가 커진다 |
| **세그먼트 `revalidate`가 supabase-js의 fetch까지 Data Cache에 넣는다 — `revalidatePath`로는 그 항목이 지워지지 않는다** | 관리자 API가 무효화를 정상 호출하고 **라우트 캐시도 실제로 비워지는데**(무효화 직후 첫 요청이 `x-nextjs-cache: MISS`, 2회차부터 `HIT`) **화면 내용이 그대로다.** 새로고침·재방문을 아무리 반복해도 세그먼트 `revalidate` 값이 지나기 전에는 바뀌지 않는다 | 페이지의 `export const revalidate = N`은 **그 세그먼트 안에서 일어나는 모든 `fetch`에 적용된다.** supabase-js는 내부적으로 `fetch`를 쓰므로 **PostgREST 응답이 `tags: []`인 N초짜리 Data Cache 항목으로 저장된다.** `revalidatePath`는 **Full Route Cache만** 비우므로 이 항목에 손이 닿지 않고, **재생성이 낡은 Data Cache를 다시 읽어 같은 화면을 만든다.** ⚠️ **증상이 "무효화했는데 안 바뀐다"로 나타나 원인 지목이 어렵다** — 무효화 코드 · RLS · 쿼리 · 테스트 하네스를 차례로 의심하게 되는데 전부 정상이다. **진단은 두 가지로 한다: ⓐ 응답의 `x-nextjs-cache`가 `MISS`인가** — MISS인데 내용이 낡았다면 범인은 라우트 캐시가 아니라 데이터 캐시다 **ⓑ `.next/cache/fetch-cache`의 해당 항목이 `tags: []`인가.** ⚠️ **이 행은 T1.12-7이 쫓던 증상의 *증폭기*이지 원인이 아니다** — 원인은 아래 "RLS의 `now()`" 행이다. 캐시는 그 RLS 창이 만든 **빈 결과를 300초~1시간 얼려 두는** 역할이었고, 그래서 무효화를 어떻게 고쳐도 첫 실패가 없어지지 않았다. **다만 카드 쪽은 순수하게 이 캐시 문제다**(`cards_public_read`에는 시간 조건이 없다) — 수정·삭제 반영이 최대 1시간 지연됐고 동적 전환으로 약 1초가 됐다. **대응은 태그가 아니라 세그먼트를 동적으로 돌리는 것이다** — 태그를 붙여 `revalidateTag`로 비우는 길은 **이 버전에서 막혀 있다**(T1.12-7에서 실측으로 확인하고 철회했다). **영향 범위는 anon 클라이언트를 캐시 세그먼트에서 부르는 곳 전부다** — `/news`(300) · `/news/[slug]`(300) · 홈(600) · `sitemap.xml`(3600) · **`/cards/[cardId]`(3600 — 최대 1시간)**. Route Handler(`/api/cards` · `/api/cards/facets`)는 세그먼트 `revalidate`가 없어 Data Cache가 걸리지 않으므로 해당 없다. **새로 만든 글·카드도 해당 없다** — 그 URL로 조회한 적이 없어 캐시 항목 자체가 없다. **위험한 쪽은 언제나 "한 번 열어 본 뒤 고치거나 지운 것"이다** — 그래서 이 경로의 E2E는 **쓰기 전에 상세를 한 번 방문해야** 회귀를 잡는다 |
| **`revalidateTag`는 이 Next 버전에서 fetch Data Cache에 닿지 않는다 — 문서 안내대로 해도 안 된다** | 태그는 정상 기록된다(`.next/cache/fetch-cache` 항목에 `tags: ["news"]`). 그런데 `revalidateTag(tag, { expire: 0 })`을 불러도 **캐시 파일 mtime이 쓰기 이전 그대로**다 — 재생성이 낡은 항목을 그대로 재사용한다. deprecated 단일 인자 형태도 동일하다. 같은 큐(`store.pendingRevalidatedTags`)를 쓰는 **`revalidatePath`는 확실히 듣는다**(항상 `MISS`를 유발) | ⚠️ **`revalidateTag.md`가 "Route Handler에서 즉시 만료가 필요하면 `{ expire: 0 }`"이라고 명시적으로 안내하는데도 그렇다.** 문서를 읽고 그대로 구현한 뒤 실측하면 안 되는 유형이라, **다음 사람이 같은 문서를 읽고 같은 설계를 다시 한다.** 프로덕션 빌드 + curl로 T1.12-7에서 실측했다. 우회로도 전부 대가가 있다: `cache: "no-store"` 주입은 무효화를 해결하지만 라우트가 **동적(`ƒ`)으로 떨어지고**, `next: { revalidate: 1 }` 주입은 라우트를 정적으로 유지하는 대신 **fetch의 최저 revalidate가 세그먼트 값을 덮어 라우트 수명이 1초가 된다**(빌드 표에 `1s`로 뜬다 — 300/600/3600 계약이 조용히 폐기된다). **결론: 태그 기반 무효화를 이 스택에서 다시 설계하지 않는다.** 정확성이 필요한 라우트는 세그먼트를 **동적으로 선언**하고(T1.12-7), 되돌리려면 §1 P1 주석의 되돌릴 조건 ⓐ를 **실측으로** 다시 확인한다. 참고로 **이 사실이 T1.12-7 증상의 원인은 아니었다**(아래 "RLS의 `now()`" 행) — 그래도 사실이므로 남긴다 |
| **data-only 덤프 복원은 마이그레이션이 심은 참조 데이터와 반드시 충돌한다 — `ON_ERROR_STOP=1`을 쓰면 안 된다** | 백업 복원 중 `games_code_key` 중복 오류가 **한 번 난다.** psql 기본값은 그 문만 건너뛰고 나머지를 넣어 **결과가 옳지만**, `ON_ERROR_STOP=1`이면 **첫 문에서 전체 복원이 중단된다** | 마이그레이션 001이 `games` 2행을 심는데(애플리케이션이 의존하는 참조 데이터라 시드가 아니라 마이그레이션에 있다 — §4.0) `--data-only` 덤프에도 같은 2행이 들어간다. 즉 **구조상 반드시 겹친다.** ⚠️ **급할 때 이걸 모르면 "백업이 복원되지 않는다"고 오판한다** — 정작 백업은 멀쩡하다. 앞으로 **마이그레이션에서 행을 심을 때마다 같은 충돌이 하나씩 는다.** 복원 절차 자체는 `scripts/dump-catalog.ts`의 doc에 있다 (T1.13 실측) |
| **RLS의 `now()`는 DB 시계, 앱이 찍는 `published_at`은 앱 서버 시계다 — 그 차이만큼 "안 보이는 창"이 생긴다** ★ | 방금 발행한 글이 **anon 조회에서 잠깐 막힌다.** 실측: 시계 차이 **약 0.4~0.9초**, 가시화까지 **약 1.2초**. 발행 직후 조회 → 안 보임, 2초 뒤 → 보임. **사람 손으로는 재현되지 않는다** — E2E는 로그인+글 2개 작성+이동이 약 2초 안에 끝나서 정확히 이 창에 빠졌다 | `news_posts`의 공개 정책은 `using (published_at is not null and published_at <= now())`이고 그 `now()`는 **DB가 평가한다**(마이그레이션 006). 반면 `published_at`은 **앱이 `new Date()`로 계산해 보낸다.** 앱 시계가 조금이라도 앞서면 그만큼 자기 글이 자기에게 안 보인다. ⚠️ **증상이 캐시 문제와 구별되지 않는다** — "썼는데 목록에 없다"가 똑같고, 그래서 T1.12-7은 무효화 계층을 두 번 다시 설계하고서야 원인에 닿았다. **진단 2단: ⓐ 캐시가 아예 없는 동적 라우트에서도 재현되면 캐시가 아니다** (이 한 번의 확인이 위 두 행의 미로를 건너뛰게 해 준다) **ⓑ `published_at`과 `created_at`을 나란히 찍어 본다** — `created_at`은 DB가 찍으므로, 앱이 먼저 계산한 `published_at`이 오히려 뒤에 오면 그 차이가 곧 시계 차이다. **처방은 앱이 `now`가 아니라 `now - 5초`를 찍는 것이다**(`src/lib/news/publish.ts`, 마이그레이션 0건). 5초는 관측 차이의 5배 이상이면서 날짜 단위 표시·정렬에 무해하다. 예약 발행(미래 시각)은 기존 값이 보존되므로 이 마진을 타지 않는다. ⭐ **일반 규칙 — 시간 조건 RLS(`<= now()`)를 쓰는 곳은 앱이 찍는 시각에 반드시 마진을 준다.** `published_at`뿐 아니라 앞으로 들어올 예약 공개 · 시즌 · 쿼터 윈도우(T2.x)가 전부 같은 구조다. **그리고 "정확히 앱 시계를 찍는다"를 단언하는 단위 테스트를 쓰지 않는다** — 그런 테스트가 이 버그를 다시 불러들인다. 단언은 "현재보다 과거인가" · "마진이 날짜를 바꾸지 않는가"로 한다 |


### 2.8 비주얼 언어 (T1.10 확정)

목표는 **"돈 내고 쓰는 서비스처럼 보이는 것"**이 아니라 **믿고 볼 수 있어 보이는 것**이다. 시세를 다루는 서비스라 화려함은 오히려 신뢰를 깎는다.

**톤 — 조용한 아카이브/갤러리**

카드 일러스트가 화면에서 유일하게 채도가 높은 요소다. UI는 무채색으로 물러선다. `globals.css`에 토큰 3개를 추가했다.

| 토큰 | 용도 |
|------|------|
| `--surface` | 한 단계 눌린 바탕 (필터 패널 · 예고 섹션) |
| `--surface-raised` | 카드 타일 바탕 — 이미지 로드 전 깜빡임을 막는다 |
| `--hairline` | 구분선. `border`보다 옅게 |

유틸리티 3개도 `@layer components`에 둔다.

- `.aspect-card` — `63 / 88`. **실물 TCG 카드 비율**이다. 이미지 유무와 무관하게 그리드 높이가 흔들리지 않는다
- `.card-placeholder` — 이미지가 **없거나 로드에 실패한** 카드의 바탕 격자 패턴. 빈칸 대신 `code`를 얹어 정보로 만든다. **규칙 6의 폴백 프레임이 이 위에 올라간다**
- `.eyebrow` — 제목 위 소형 대문자 라벨. 페이지마다 위계의 첫 칸을 고정한다

**규칙**

1. **차트 금지** (CLAUDE.md). 기준가는 배지 하나. 산출 불가일 때도 배지 자리를 비우지 않고 "산출 불가"로 채워 *값이 없는 것*과 *기능이 없는 것*을 구분한다
2. **레어도 배지는 `bg-foreground/85` + `text-background`**. 반투명 배경(`bg-background/85`)은 밝은 일러스트 위에서 읽히지 않는다
3. **미완성 화면에 "준비 중"만 두지 않는다.** `ComingSoon`으로 무엇을 만들고 있는지 3개 항목으로 보이고, 지금 쓸 수 있는 곳(도감)으로 보낸다. **애드센스 심사라는 근거는 §0.1 ⓑ로 사라졌지만 규칙은 유지한다** — 이제 근거는 사용자 이탈이다
4. **호버는 그림자와 1.03 스케일까지.** 카드가 튀어오르면 목록을 훑기 어렵다
5. 대체 카드는 **텍스트 목록이 아니라 썸네일**이다. 어느 일러스트인지가 선택 기준이기 때문이다
6. **이미지가 없거나 로드에 실패한 카드는 "빈 상태"가 아니라 카드로 보인다.** 폴백은 **카드명 · 속성 · `code`**가 든 디지털 카드 프레임이고 `.aspect-card`를 그대로 써서 그리드 높이가 흔들리지 않는다. ★ **2026-08-28에 이 규칙의 성격이 올라갔다 — 시각 품질이 아니라 「방어 코드」다**(§9.4 ⓑ). **한 장이 깨졌을 때가 아니라 전부 깨졌을 때 서비스가 성립해야 한다.** 표시 항목이 DB 컬럼 단위로 확정된 표도 §9.4 ⓑ에 있다. **"이미지 없음"이라는 회색 자리표시로 보이면 안 된다** — 규칙 1과 같은 판단이다. *값이 없는 것*(URL이 아직 없다)이 *기능이 없는 것*(카드가 잘못됐다)으로 읽히면 안 된다. **URL 부재와 로드 실패는 같은 화면이다**(§9.4 ⓑ)
   - **원본 일러스트를 흉내 내는 요소를 넣지 않는다.** 틀 · 색은 우리 토큰(`--surface-raised` · `--hairline`)으로만 만든다. 폴백이 원본처럼 보이면 그것이야말로 §9.4가 피하려던 자리다
   - **게임 색 토큰(`--color-game-*`)은 쓰지 않는다** — `CardListItem`에 `game_id`가 없어(§4.1) 조회 폭을 넓혀야 하는데, 프레임 하나 물들이자고 낼 값이 아니다
   - **속성 값은 자유 텍스트다**(§4.1 · T1.14의 "표기 통일" 주의). **매핑에 없는 값과 null은 아이콘 없이 이름만 보인다** — 물음표 아이콘을 만들지 않는다. 매핑이 비어 있어도 프레임은 성립해야 한다

---

## 3. 전체 디렉토리 구조

`CLAUDE.md`가 `src/` 하위를 `app` / `components` / `lib` / `types` 4구획으로 고정했으므로 **이 4개 외의 최상위 구획을 `src/` 안에 만들지 않는다.** Zustand 스토어와 순수 도메인 로직은 `src/lib` 하위에 배치한다.

Cloudflare Worker는 Next.js 빌드 대상이 아니므로 `src/` 밖의 `workers/`에 둔다.

> ⚠️ **§3.1~§3.4의 트리는 "목표 구조"이고 아직 없는 파일이 섞여 있다.** 로드맵(§8)이 Phase 3까지 걸쳐 있어 그렇다. **주석이 붙은 항목은 대체로 이미 구현된 것이고, 없는 것은 `(T2.x)`처럼 만드는 태스크를 달았다.** 트리에 있다는 이유로 "이미 있다"고 읽지 않는다 — 확인은 파일을 여는 것이 가장 싸다.

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
│   └── proxy.ts                    # Next 16 미들웨어. /admin 경로 보호 + 카드·뉴스 상세 존재 확인(§2.7, T1.12)
├── supabase/
│   ├── migrations/
│   ├── seed/
│   └── config.toml
├── tests/
│   └── e2e/                        # Playwright 스펙 + global-setup.ts (§7). 단위 테스트는 소스 옆 *.test.ts
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

라우트 그룹으로 **콘텐츠(SEO) 영역**과 **앱(유틸리티) 영역**의 레이아웃을 분리한다.

```
src/app/
├── layout.tsx                            # 루트: Provider, 폰트, 메타데이터
├── page.tsx                              # 홈: 메타 요약 + 신규 카드 + 뉴스 피드
├── error.tsx                             # 전역 에러 경계
├── (content)/                            # ── SEO 대상 콘텐츠 레이아웃
│   ├── layout.tsx
│   ├── news/
│   │   ├── page.tsx                      # 기사 목록
│   │   └── [slug]/page.tsx               # 기사 상세 (ISR)
│   ├── privacy/page.tsx                  # 개인정보처리방침 (§0.1 ⓑ 이후에도 유지)
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
│   ├── sets/page.tsx · sets/[setId]/page.tsx          # 등록+목록 / 수정·삭제 (T1.15)
│   ├── keywords/page.tsx · keywords/[keywordId]/page.tsx
│   ├── cards/page.tsx                    # 목록 — 검색 · 페이지네이션 (T1.12)
│   ├── cards/new/page.tsx · cards/[cardId]/page.tsx   # 등록 / 수정·삭제
│   └── news/page.tsx · news/new/page.tsx · news/[postId]/page.tsx
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
│   ├── news/route.ts                     # (예정) — 지금 뉴스 목록은 RSC가 직접 조회한다
│   ├── admin/                            # 전 라우트 requireAdmin() 통과 후 service_role 사용
│   │   ├── session/route.ts
│   │   ├── sets/route.ts · sets/[setId]/route.ts
│   │   ├── keywords/route.ts · keywords/[keywordId]/route.ts
│   │   ├── news/route.ts · news/[postId]/route.ts
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
│   │   ├── card-filter-panel.tsx         # 검색어 · 게임 · 패싯 셀렉트 · 키워드 칩
│   │   ├── keyword-filter.tsx            # 효과 키워드 AND 조합 칩
│   │   ├── card-detail.tsx               # (예정) — 지금은 `/cards/[cardId]` 페이지가 직접 조립
│   │   ├── card-image.tsx                # 카드 1장 이미지 — 4곳 공용(T1.11 통합)
│   │   │                                 #   원본 URL 핫링크 `<img>` + `referrerPolicy="no-referrer"` — 값 확정 (§9.4 ⓑ · §0.1 ⓒ)
│   │   │                                 #   URL 부재 · onError → 폴백 프레임 = 방어 코드 (같은 화면, §2.8-6 · §9.4 ⓑ)
│   │   │                                 #   next/image를 쓰지 않는다 — 최적화본 캐시가 복제에 가깝다 (§9.4)
│   │   ├── base-price-badge.tsx          # 기준가 1개만 표기 (차트 금지)
│   │   ├── similar-cards.tsx             # 대체 카드 — 썸네일 그리드 (일러스트가 선택 기준)
│   │   └── use-card-search.ts
│   ├── decks/                            # (T2.4 · T2.5 — 아직 없다)
│   │   ├── deck-list.tsx  tier-table.tsx  deck-detail.tsx
│   │   ├── deck-builder.tsx
│   │   └── deck-source-link.tsx          # 필요 카드 → 매물 검색 진입
│   ├── simulator/                        # (T2.5 — 아직 없다. 로직은 §4.7의 도메인에 있다)
│   │   ├── opening-hand.tsx              # 첫 손패 표시 (ptcg 7장 / opcg 5장)
│   │   ├── mulligan-button.tsx
│   │   └── probability-panel.tsx
│   ├── market/                           # (T2.11 — 아직 없다)
│   │   ├── market-search-button.tsx      # 1장 단위 조회 트리거
│   │   ├── progressive-loader.tsx        # 8~12초 진행 단계 연출
│   │   ├── condition-filter.tsx          # All / A급·미개봉 / PSA·BGS
│   │   └── listing-list.tsx
│   ├── collection/                       # (T3.3~T3.5 — 아직 없다)
│   │   ├── binder-view.tsx               # 가상 3공 바인더
│   │   ├── binder-page.tsx
│   │   ├── wishlist-panel.tsx
│   │   ├── collection-value.tsx          # 총 가치
│   │   └── share-binder-dialog.tsx
│   ├── news/
│   │   ├── news-list.tsx
│   │   ├── news-article.tsx
│   │   └── markdown.tsx                  # react-markdown 매핑 (raw HTML 미허용)
│   └── admin/                            # 관리자도 도메인 묶음이다 — ui/features/common 3분할(CLAUDE.md) 준수
│       ├── field.tsx                     # Field · TextInput · TextArea · NativeSelect · StatusMessage
│       ├── use-admin-form.ts             # 등록·수정 폼 공통 제출·에러 처리 (method · resetOnSuccess · extra)
│       ├── admin-login-form.tsx
│       ├── admin-delete-button.tsx       # 확인 → 삭제 2단계. endpoint · redirectTo · label (T1.12)
│       ├── set-form.tsx
│       ├── card-form.tsx                 # 등록·수정 겸용 (cardId? · initial? · initialKeywordIds?)
│       ├── keyword-form.tsx
│       └── news-form.tsx                 # 작성·수정 겸용 (method + resetOnSuccess)
└── common/
    ├── header.tsx                        # 서버 컴포넌트. 내비 · 테마 토글 조립
    ├── main-nav.tsx                      # 데스크톱 내비 (client — usePathname)
    ├── mobile-nav.tsx                    # 모바일 시트 내비 (client)
    ├── footer.tsx                        # 4단 — 서비스/정보 내비 · 면책 · 정책 링크
    ├── theme-provider.tsx                # next-themes 래퍼 (client)
    ├── theme-toggle.tsx                  # 라이트 / 다크 전환 (client)
    │                                     # affiliate-carousel.tsx — 만들지 않는다. T3.6 폐기 (§0.1 ⓒ · §9.1)
    ├── pagination.tsx                    # 관리자 목록 페이지네이션 (T1.12)
    ├── error-boundary.tsx                # 기능 단위 클라이언트 에러 경계
    ├── ad-slot.tsx                       # 미사용 — §0.1 ⓑ 폐기. 제거 예정: 백로그 E-2 (§9.1)
    ├── coming-soon.tsx                   # 미완성 화면을 "예고"로 보이게 (§2.8)
    └── empty-state.tsx                   # icon · action 지원
```

### 3.3 src/lib — 로직

```
src/lib/
├── admin/
│   ├── session.ts                        # ADMIN_TOKEN 검증 · 쿠키 값 (server-only)
│   ├── guard.ts                          # requireAdmin() — 인증의 실제 판단 지점
│   ├── responses.ts                      # zod/Postgres 오류 → 응답 매핑
│   └── queries.ts                        # 관리자 화면 조회 — 목록 · 단건 · 집계 (service_role)
├── supabase/
│   ├── client.ts                         # 브라우저용 (anon key)
│   ├── server.ts                         # RSC/Route Handler용 (쿠키 세션)
│   └── admin.ts                          # service_role — 'server-only' import 필수
├── cards/                                # 공개 화면용 카드 조회 · 무효화 (anon 클라이언트)
│   ├── queries.ts                        #   관리자 조회와 합치지 않는다 — 아래 규칙 6
│   └── revalidate.ts
├── news/                                 # 뉴스 조회 · 발행 시각 계산 · 무효화
│   ├── queries.ts  revalidate.ts
│   └── publish.ts                        # published_at = now-5초 (§2.7 ★)
├── home/queries.ts                       # 홈 카탈로그 집계
├── seo/                                  # sitemap 조회 · 페이지네이션
│   ├── queries.ts  sitemap.ts
├── domain/                               # ★ React·Next·Supabase·카드 DB 타입 import 금지 (§4.7 ⓓ)
│   ├── rules.ts                          # 구조 룰 표 + composeGameRules — §4.7 ⓑ
│   ├── simulator/
│   │   ├── shuffle.ts                    # 시드 기반 Fisher-Yates (테스트 재현성)
│   │   ├── draw.ts                       # 라이브러리 전개 · 첫 손패 · 멀리건
│   │   └── probability.ts                # 초기 손패 하이퍼기하 확률 (산출 불가면 null)
│   ├── deck/
│   │   ├── validate.ts                   # 덱 크기 · 매수 제한 · 존 · 리더 색상
│   │   └── stats.ts                      # 분포 집계 (groupBy 주입)
│   ├── pricing/                          # (T2.12)
│   │   ├── base-price.ts                 # 단일 기준가 산출 (§5.3)
│   │   └── outlier.ts                    # 이상치 제거
│   └── collection/value.ts               # (T3.4) 컬렉션 총 가치 계산
├── validation/                           # ★ 워커와 공유 — next/* import 금지
│   ├── card.ts                           # 도감 검색 파라미터 · 관리자 입력
│   ├── admin.ts                          # 세트 · 키워드 · 카드 · 뉴스 입력 스키마
│   ├── deck.ts  listing.ts               # (T2.3 · T2.7)
│   ├── market-session.ts                 # (T2.9) cardId 단일 문자열 강제 (배열 불가)
│   └── collection.ts                     # (T3.2)
├── admin/                                # session · guard · responses · queries · input
├── supabase/                             # client · server · admin(service_role) · public(anon)
├── query/
│   ├── provider.tsx                      # 전역 staleTime 5분 — T1.14 확인 경로 주의
│   └── keys.ts                           # queryKey 팩토리 중앙화
├── stores/                               # (T2.5 · T3.3) deck-builder · market-search · binder-ui
├── hooks/                                # (예정) use-media-query.ts ...
├── navigation.ts                         # 주 내비게이션 정의 (헤더 데스크톱 · 모바일 공유)
├── env.ts                                # parseEnv 헬퍼 + 클라이언트 환경변수 (NEXT_PUBLIC_*)
├── env.server.ts                         # ★ 서버 시크릿 전용. 'server-only'로 브라우저 import 차단
└── utils/
    ├── cn.ts                             # 클래스 병합
    ├── form.ts                           # 폼 컨트롤 공용 클래스
    ├── date.ts                           # 표시용 날짜 포맷
    └── (예정) currency.ts  hash.ts
```

**모듈 규칙 (Reviewer 검증 항목)**

1. `src/app/**`은 얇게 유지 — 라우팅 · 데이터 페칭 · 조립만 담당하고 UI 구현은 `src/components/features/**`에 둔다.
2. `src/lib/domain/**`과 `src/lib/validation/**`은 React · Next · Supabase를 import 하지 않는다. 워커에서도 import 되기 때문이다. **도메인은 여기에 하나를 더 지킨다 — 카드 DB 타입(`@/types/database` · `@/types/card`)도 import 하지 않는다**(근거와 나머지 세 겹은 §4.7 ⓓ). **2026-08-28(T2.1)에 `no-restricted-imports`로 `eslint.config.mjs`에 걸었다 — 이제 `npm run lint`가 잡는다.** ⚠️ **차단 목록은 손으로 유지된다** — 새 프레임워크 패키지를 도입하면 이 목록에 함께 넣어야 하고, 넣지 않으면 규칙이 조용히 비어 간다.
3. `src/components/features/*` 간 직접 import 금지. 교차가 필요하면 `src/lib/domain` 또는 상위 라우트에서 조립한다.
4. `src/lib/supabase/admin.ts`는 `import 'server-only'`를 선언하며, 이 파일 외에서 `service_role` 키를 참조하지 않는다.
5. `NEXT_PUBLIC_` 접두사는 공개해도 무방한 값에만 붙인다.
6. **관리자 조회는 `src/lib/admin/queries.ts`에만 둔다.** 공개 화면용 `src/lib/cards/queries.ts`는 anon 클라이언트를 쓰고 키워드를 표시용(`{ code, label }`)으로 되돌리므로, `keyword_id`가 필요한 관리자 폼에는 **재사용할 수 없다.** 형태가 비슷해 보여도 두 계층을 합치지 않는다.

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

두 게임은 덱 구조와 첫 손패 규칙이 서로 다르므로, **덱 검증과 시뮬레이터는 게임별 룰 테이블을 주입받는 형태로 구현한다.** 규칙을 코드에 하드코딩하지 않는다. **주입의 구체적인 형태 — 어느 값이 DB에서 오고 어느 값이 코드에 남는지, 공개 함수 시그니처, 테스트 — 는 §4.7에서 확정했다 (2026-08-28).**

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
cards              (id, game_id, set_id→card_sets, code,
                    name_ja NOT NULL,      -- 크롤러 검색 키 (§4.4, 002에서 교정)
                    name_ko NULL,          -- 커버리지 부분적. 표기는 coalesce(name_ko, name_ja)
                    name_en NULL,
                    rarity, attribute, card_type, sub_type, image_url,
                    effect_text,
                    base_code GENERATED)   -- split_part(code, '_', 1). 대체 카드 판정 (§4.6)
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
                    -- ★ published_at은 앱이 찍고 RLS는 DB의 now()로 검사한다.
                    --   두 시계가 어긋나 "방금 발행한 글이 안 보이는 창"이 생기므로
                    --   앱은 now가 아니라 now-5초를 찍는다 (§2.7 · publish.ts).

── 운영/방어 ────────────────────────────────
market_sessions    (id, user_id NULL, ip_hash, card_id→cards,
                    status'pending|done|failed',
                    requested_at, completed_at, result_count)
                    -- 쿼터 감사 로그 겸 SSE 세션 레코드
```

> **`similar_groups` / `search_vector` 제거 (007)** — 둘 다 001에서 만들었지만 이후 설계가 바뀌어 앱이 한 번도 조회하지 않았다. `similar_groups`는 §4.6이 `base_code`로 대체했고, `search_vector`는 §2.7의 일본어 tsvector 문제로 `ilike`+`pg_trgm`에 자리를 내줬다. 특히 `search_vector`는 **insert/update마다 트리거가 돌고 GIN 인덱스가 갱신되는데 읽는 곳이 없었다.** `CLAUDE.md`의 `similar_group_id` 지정 문구도 함께 갱신했다.

**인덱스 / 검색**

- 부분일치 보강: `pg_trgm` GIN 인덱스를 `cards.name_ko`와 **`cards.name_ja`** 양쪽에 둔다. 실데이터 대부분이 일본어명에 쌓이므로 일본어 인덱스가 실질적으로 더 중요하다 (002).
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
| `games`, `card_sets`, `cards`, `keywords`, `card_keywords`, `card_prices`, `news_posts` | 익명 `SELECT` 허용, 쓰기는 `service_role`만 |
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

`docs/crawler-compliance.md`의 포켓몬·원피스 수집 관측은 이력으로만 남긴다. 일본 중고 매물 크롤러(T2.7)는 별개이며 그대로 유효하다.

**유지되는 제약**

| 컬럼 | 제약 | 사유 |
|------|------|------|
| `cards.name_ja` | `not null` | 크롤러가 메르카리·라쿠마·야후옥션을 검색하는 유일한 키(§5.3). 자체 입력에서도 필수다. **§4.4.1이 이 컬럼과 부딪힌다 — T1.14 블록의 주의 참조** |
| `cards.name_ko` | nullable | 한국 미발매 카드가 존재한다. 표기는 `coalesce(name_ko, name_ja)` |
| `cards.sub_type` | `basic_energy`면 매수 제한 면제 | §4.0 |

> ⚠️ **손입력이라고 해서 다 같지 않다.** §9.3의 약관 검토 결과, **재사용 금지 조항은 수집 방법을 조건으로 달지 않는다.** 자동 수집을 그만둔 것으로 벗어난 것은 **접근 규율 하나뿐**이고, 데이터 재사용·이미지·상업적 이용은 그대로 남는다. 조항들은 「このサイトに掲載されている」·「본 사이트의 콘텐츠」처럼 **사이트 게재물**을 대상으로 쓰여 있으므로 **어느 사이트를 보고 옮겨 적느냐가 갈린다.** 그래서 아래 §4.4.1을 결정했다.


#### 4.4.1 입력 원천 — **`onepiece-cardgame.kr` 하나로 고정 (2026-08-25 결정)**

§9.3 약관 검토를 받아 사용자가 정한 방침이다. **T1.14부터 적용된다.**

| # | 결정 |
|---|------|
| 1 | **손입력의 참조 원천은 `onepiece-cardgame.kr`(원피스 한국 공식) 하나다** |
| 2 | **일본 사이트 2곳(`onepiece-cardgame.com` · `pokemon-card.com`)의 게재물은 사용하지 않는다** |
| 3 | **포켓몬코리아(`pokemoncard.co.kr`)는 당장 원천이 아니다.** 포켓몬을 넣을 때 다시 판단한다 |
| 4 | **이미지는 핫링크 유지.** 2026-08-26에 **저장 경계와 실패 처리까지 확정**됐다 — **텍스트(코드 · 이름 · 효과 · 성능)는 우리 DB에 저장하고 이미지 바이트는 저장하지 않는다.** `<img>`에 `referrerPolicy="no-referrer"`를 붙이고, **URL 부재 · 로드 실패는 폴백 프레임 한 화면으로 받는다** (§9.4 ⓐ~ⓔ) |
| 5 | ~~배포는 광고 없이 먼저 한다. 애드센스는 허락을 받은 뒤에 붙인다~~ → ~~광고를 붙이지 않는다. 애드센스 폐기~~ (2026-08-26 · §0.1 ⓑ) → **수익화 자체를 하지 않는다. 광고 · 제휴(T3.6) · 후원 · 유료 기능 전부** (2026-08-28 · §0.1 ⓒ · §9.1) |
| 6 | ~~권리자 문의 메일은 §0.1 ⓐ 조사 뒤에 보낸다. 배포보다는 앞이다~~ → **보내지 않는다** (2026-08-28 · §0.1 ⓒ). 초안 4통은 `docs/permission-inquiry-drafts.md`에 **보관용**으로 남는다. 🚨 **이 결정이 아래 🚨 문단을 완화하지 않는다 — 강화한다.** 근거의 공백을 메울 수 있는 유일한 경로가 문의였고(§9.11 ⓑ), 그것을 닫았으므로 **공백이 영구화된다**(→ 아래 ⓓ) |
| 7 | **⑤축(공식 창구) 조사 결과 이 표의 어느 원천도 공식 창구로 열리지 않았다.** 결정 1~3을 **바꾸지 않는다.** 바뀐 것은 **근거의 성격**이다 — 아래 ⓒ (2026-08-26 · §0.1 ⓐ) |

**원천 표 — ⑤축 반영 (2026-08-26)**

| 원천 | 현재 상태 | ①~④ (§9.3 ⓐ) | **⑤ 공식 창구** (§10) | 이번 조사로 바뀐 것 |
|------|-----------|----------------|------------------------|---------------------|
| `onepiece-cardgame.kr` | **유일 원천** | 네 축 모두 **근거 없음** | **닫힘** — 사이트 자체 창구는 `card@xosoft.kr` 하나뿐이나, **푸터가 표기한 권리자 집영사·토에이가 개인 허락을 문서로 배제**(§10.3) | **①~④는 그대로. ⑤가 "근거 없음"에서 "닫힘"으로.** 공백에 인접 재료가 생겼고 **방향이 부정적이다** |
| `onepiece-cardgame.com` (반다이) | **배제** | ②③④ 높음 | **못 찾음** — 「事前許諾」의 신청 경로 부재(§10.2) | 배제 유지. **예외 창구가 있었다면 결정 2를 다시 열 재료였는데, 없었다** |
| `pokemon-card.com` (주식회사 포켓몬) | **배제** | ②③④ 높음 | **닫힘** — 「個人的な利用を超えた…利用を許諾するものではありません」(§10.1 ⓑ) | 배제 유지. **더 굳어졌다** |
| `pokemoncard.co.kr` (포켓몬코리아) | **보류** | ①낮음 ②중간 ③높음 ④중간 | **열림(조건 미기재)** — 「제휴안내」 `webmaster@pokemonkorea.co.kr`(§10.1 ⓓ) | **6곳 중 유일한 진전.** 결정 3을 다시 열 때 **묻는 곳이 어디인지는 이제 안다.** ⚠️ 단 **개인이 신청 대상인지는 미확인** |

> ⚠️ **TPCi 약관에서 ②축에 걸리는 새 문구를 찾았으나 이 표를 바꾸지 않는다.** `pokemon.com` Terms of Use 5(v) 「Download quantities of content to a database **for any reason**」는 문언이 매우 강하지만 **`pokemon.com`(TPCi) 문서**이고, `pokemoncard.co.kr`·`pokemon-card.com`에 그대로 적용된다고 **본문으로 확인하지 못했다.** §9.3 ⓐ 판정표를 이 문구로 고치지 않는다 — **적용 범위를 확인하지 않은 조항을 표에 올리는 것이 §4.4.1이 경계하는 바로 그 종류의 비약이다.** 기록은 `docs/crawler-compliance.md` §10.1 ⓒ에 있다.

> 🚨 **이 결정의 근거가 무엇인지 오해하지 말 것 — 가장 중요한 단서다.**
>
> `onepiece-cardgame.kr`을 고른 것은 **"검토했더니 문제가 없어서"가 아니다. "금지하는 근거를 찾지 못해서"다.** 이 사이트는 `robots.txt`가 404이고, 이용약관·개인정보처리방침·저작권 안내 **문서 자체를 찾지 못했으며**, 페이지 본문에 `무단`·`전재`·`복제`·`저작권` 어느 단어도 없다. 즉 §9.3의 4축 판정이 전부 **"근거 없음"**이다.
>
> **"근거 없음"은 "허용"이 아니다.** 판단할 재료가 없다는 뜻이다. 게다가 같은 상품의 일본 원본(`onepiece-cardgame.com`)은 「すべての画像・テキスト・データの無断転用、転載をお断りします」를 명시하고, 한국 사이트의 저작권 표기 주체(`©Eiichiro Oda/Shueisha`)와 푸터 로고(BANDAI CARD GAMES · BANDAI)는 일본 원본과 동일하다.
>
> **따라서 이 결정은 안전을 확인한 결과가 아니라 불확실성을 안고 가는 선택이다.** `docs/crawler-compliance.md`가 명시한 대로 그 검토는 **법률 자문이 아니다.** 이 문단을 지우지 마라 — 나중에 이 결정을 읽는 사람이 "검토 결과 문제없음"으로 오해하면 결정의 성격이 통째로 바뀐다.
>
> **🚨 2026-08-28 추가 — 이 공백은 이제 닫히지 않는다.** 위 문단은 「금지 근거를 찾지 못함」이라는 **잠정 상태**를 전제로 쓰여 있었다. 그것을 메울 수단으로 문서가 걸어 둔 것은 둘이었고 **둘 다 소진됐다**: ⓐ **공식 창구** — 2026-08-26 조사에서 6곳 중 열린 곳 0곳(§0.1 ⓐ) ⓑ **권리자 문의** — 2026-08-28에 **보내지 않기로 결정**(§0.1 ⓒ · 결정 6). **따라서 "지금은 재료가 없지만 곧 생긴다"가 아니라 "재료를 만들 경로가 없다"가 현재 상태다.** ⚠️ **이것을 "그러므로 괜찮다"로 읽지 마라** — 상태가 나빠졌지 좋아지지 않았다. 되돌릴 조건 1·3은 그대로 살아 있고(아래), **그 둘은 우리가 만드는 것이 아니라 상대가 움직여야 성립하는 조건이다.**

**왜 일본 2곳은 아예 뺐는가 — 광고를 떼도 해소되지 않기 때문이다.**

이것이 이 결정의 핵심 근거다. 두 곳은 기준선을 「영리목적」이 아니라 **사용 목적 그 자체**로 그었다.

| 사이트 | 허용 범위를 긋는 문구 | 무광고 배포로 해소되는가 |
|--------|----------------------|--------------------------|
| pokemon-card.com | 「データは、**個人的に楽しむ場合に限って**使用を許諾される」 + 「これらのデータを、**他のインターネットなどの公衆ネットワーク上で利用することはできません**」 | **아니다.** 뒤 문장이 **공개 배포 자체**를 막는다. 광고와 무관하다 |
| onepiece-cardgame.com (반다이) | 「**私的使用**その他法令等によって認められる範囲を超えて、掲載情報を使用…禁止いたします」 | **아니다.** 공개 서비스는 광고가 없어도 「私的使用」이 아니다 |
| pokemoncard.co.kr | 「**영리목적**으로 이용하거나」(제14조③) · 「**상업적으로 이용하는 행위**」(제16조 3-1) | **그렇다.** 조건이 영리성이므로 무광고 배포로는 이 조항에 닿지 않는다 |

**즉 포켓몬코리아만 "광고를 떼면 조건이 풀리는" 구조이고, 일본 2곳은 무엇을 해도 문언상 남는다.** 그래서 3번 결정(포켓몬코리아는 보류)과 2번 결정(일본 2곳은 배제)의 성격이 다르다 — 포켓몬코리아는 **미룬 것**이고 일본 2곳은 **닫은 것**이다.

> 포켓몬코리아에는 남는 조건이 하나 더 있다. §9.3 판정이 "중간"이었던 이유 — **재사용 금지 조항의 주어가 "회원"이라 비회원에게 그대로 걸리는지가 문언상 불명확하다.** 포켓몬을 넣기로 할 때 이 점을 다시 본다.
>
> **2026-08-28 — 위 표의 "그렇다"가 가정에서 사실이 됐다.** §9.1이 수익화를 폐기해 **광고도 제휴도 없다.** 즉 포켓몬코리아 제14조③·제16조 3-1의 **「영리목적」·「상업적으로 이용하는 행위」라는 조건이 우리 상태에 닿지 않는다.** ⚠️ **그러나 이것이 결정 3(포켓몬코리아 보류)을 풀지 않는다** — 위에 적은 ②축의 "회원" 문제가 남고, **③축(이미지)은 「무단 복제 및 도용을 금하며」 + 워터마크 이미지로 "높음"이며 영리성과 무관하다**(§9.3 ⓐ). **④축 하나가 풀린 것이 네 축이 풀린 것이 아니다.**

**~~문의 메일은 배포를 기다리지 않는다 (결정 6).~~ → 이력이다. 2026-08-28에 발송 자체가 폐기됐다(ⓓ).** 아래 ⓐⓑ는 **"언제 보내는가"에 대한 근거**였고, **"보내는가"가 아니오가 되어 적용 대상이 없어졌다.** 지우지 않는 이유는 **되돌릴 때 그대로 다시 쓰이기 때문이다** — 발송을 다시 결정하면 ⓑ("배포 뒤에 물으면 협상 위치가 나빠진다")가 **그 시점에 즉시 유효해진다.**

- ⓐ **답이 오는 데 몇 주가 걸릴 수 있다.** 배포와 직렬로 묶으면 그 대기가 통째로 일정에 얹힌다. 병행이 낫다
- ⓑ **배포 뒤에 물으면 "이미 운영 중인데 허락해 달라"가 된다.** 같은 질문이라도 협상 위치가 나빠지고, 상대가 취할 수 있는 선택지가 "허락/거절"에서 "허락/거절/중지 요구"로 늘어난다. **묻는 시점이 답의 성격을 바꾼다**

**ⓒ 결정 7 — 결정 1~3을 바꾸지 않는 이유, 그리고 바뀐 것 (2026-08-26 · §0.1 ⓐ)**

⑤축 조사가 끝났고 **6곳 중 열린 창구가 0곳이다.** 그래서 **원천 선택 자체는 그대로다.** 다만 두 가지가 달라졌다.

**첫째 — 이 결정의 근거가 "공백"에서 "공백 + 부정적 정황"으로 바뀌었다.**

지금까지 §4.4.1의 근거는 **"금지 근거를 찾지 못함"** 하나였고, 그것은 판단 재료가 **없다**는 뜻이었다. 이제는 재료가 **하나 생겼는데 우리에게 불리하다.** `onepiece-cardgame.kr` 푸터의 저작권 표기 주체(집영사 · 토에이 애니메이션) 둘 다가 공개 FAQ에 이렇게 적어 두었다.

> 「個人の方に対してキャラクター・作品利用の許諾は行っておりません。また、個別のお問い合わせへの回答や判断・審査はいたしません。」 (집영사)
> 「非営利であっても画像の使用許可や素材の提供は行っておりません。」 (토에이 애니메이션)
> — 원문·URL·확인일은 `docs/crawler-compliance.md` §10.3

**둘째 — 그럼에도 이것이 "카드게임 사이트의 약관"은 아니다. 선을 정확히 긋는다.**

두 회사 FAQ는 **원작 IP(만화·애니)의 캐릭터·이미지 이용**에 대한 답이다. **카드 고유 정보(코드 · 레어도 · 효과 텍스트)에 그대로 적용되는지는 이 문서가 판단하지 않는다** — §9.3 말미의 유보(사실 정보와 표현물의 취급 차이는 법적 판단)가 그대로 살아 있다.

**→ 그래서 결론은 "원천을 바꾼다"가 아니라 "🚨 문단을 더 강하게 유지한다"이다.** 위 🚨가 「안전을 확인한 결과가 아니라 불확실성을 안고 가는 선택」이라고 적었는데, **이번 조사는 그 불확실성의 크기를 키웠지 줄이지 않았다.** 이 결정을 나중에 읽는 사람이 "조사까지 했으니 검증됐다"로 오해하면 안 된다 — **조사의 결론은 "열린 문이 없다"였다.**

> **되돌릴 조건에 하나도 추가되지 않는다.** 아래 1~4가 그대로다. ⑤축이 열린 곳이 없으므로 **"공식 창구로 갈아탄다"는 새 갈래가 생기지 않았다.** → ⚠️ **2026-08-28에 조건 2·4가 바뀌었다(ⓓ).** 추가된 것이 아니라 **줄었다** — 문의 폐기로 2번이 무효가 됐다.

**ⓓ 결정 6 개정 — 문의를 보내지 않는다 (2026-08-28 · §0.1 ⓒ)**

**초안 4통은 `docs/permission-inquiry-drafts.md`에 보관용으로 남는다** — 지우지 않는다. 되돌릴 때 다시 쓰이고, **무엇을 물으려 했는지가 이 결정의 성격을 설명하는 기록이기 때문이다.** 그 문서 머리말에 발송 폐기 사실과 되돌릴 조건을 적었다.

**없어진 것 / 남은 것 / 옮겨간 것**

| | 내용 |
|---|---|
| **없어졌다** | **회신을 전제로 한 모든 것.** ⓐⓑ의 발송 시점 근거 · 무응답 기한(§9.11 ⓐ) · 자기소개 문구 A/B 선택(§9.11 ⓕ-3) · 반다이 발송 창구 선택 · 발송 기록 표 · **§8 사용자 일감 5번** |
| **남았다** | **근거의 성격.** 위 🚨가 그대로이고 **더 강해졌다.** 그리고 §9.11 ⓑ(묻는 데에는 비용이 있다) · ⓓ(전부 막혔을 때의 세 갈래) · ⓔ(모든 갈래에서 살아남는 T2.1·T2.2) — 셋 다 회신과 무관하게 성립한다(§9.11 ⓖ) |
| **옮겨갔다** | **되돌릴 조건 2번(거절 회신)이 조건에서 빠지고, 그 자리를 "발송을 다시 결정한다"가 받는다** — 아래 표 |

**왜 보내지 않기로 했는가 — 근거는 사용자가 댄 것이고, 이 문서가 검증한 것이 아니다.** 다만 이 문서가 이미 기록해 둔 재료 중 이 방향과 맞물리는 것이 둘 있어 적어 둔다: **집영사·토에이는 「個別のお問い合わせへの回答や判断・審査はいたしません」·「お答えはいたしかねます」를 문서로 밝혔고**(§9.11 ⓕ-1), **TPCi는 「our policy is to decline」을 약관에 적었다**(§9.11 ⓕ-2). ⚠️ **그러나 이 둘은 "회신 확률이 낮다"는 재료이지 "묻지 않아도 된다"는 근거가 아니다** — 네 통 중 가장 중요한 `card@xosoft.kr`(원피스 한국 운영사)은 **이 방침들과 층이 다르고 어떻게 답할지는 미지수였다**(§9.11 ⓕ-1의 ⚠️). **그 미지수는 이제 영구히 미지수로 남는다.**

**이 결정을 되돌려야 하는 조건**

| # | 조건 | 2026-08-28 이후 상태 |
|---|------|----------------------|
| 1 | `onepiece-cardgame.kr`에 이용약관·저작권 안내가 새로 게시된다 | **살아 있다.** §9.3 ⓓ 재확인 절차가 잡는다 — **문의를 안 보내기로 한 뒤로 이것이 유일하게 남은 "새 재료가 들어오는 경로"다** |
| 2 | ~~문의에 **거절** 회신이 온다~~ | **무효 — 보내지 않으므로 회신이 없다.** 대신 **"발송을 다시 결정한다"**가 이 자리에 온다. 그때는 §4.4.1 ⓐⓑ가 즉시 유효해지고 **배포 이후라면 협상 위치가 이미 나빠져 있다** |
| 3 | 권리자로부터 중지 요청을 받는다 | **살아 있다. 그리고 상대적 비중이 커졌다** — 우리가 먼저 묻지 않으므로 **접촉이 상대 쪽에서 시작될 가능성만 남는다.** 되돌릴 수단은 T1.13 덤프와 §9.4 ⓓ(`image_url` 비우기) |
| 4 | ~~영리 요소를 붙이려는 시점~~ | **§9.1이 닫혀 "붙이지 않는다"가 확정됐다.** 조건 자체는 남지만 트리거는 **§9.1의 되돌릴 조건 셋**으로 옮겨간다 |


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

> **`similar_group_id`는 007에서 제거했다.** 행이 하나도 없었고 등록 화면도 없었다. 효과가 비슷한 **다른 이름의 카드**를 묶을 필요가 생기면 효과 키워드 태그(`card_keywords`)로 커버하고, 그래도 부족하면 그때 다시 설계한다. `CLAUDE.md`의 지정 문구도 함께 갱신했다.

### 4.5 관리자 화면 (T1.6-A)

> **절 번호가 §4.6 뒤에 온다 — 순서가 아니라 번호가 뒤늦게 붙은 흔적이다.** 참조가 코드(`tests/e2e/admin-cards.spec.ts`)와 `docs/`에까지 퍼져 있어 **번호를 바꾸지 않는다.** 읽는 순서는 §4.4.1 → §4.5 → §4.6이 자연스럽다.

| 항목 | 내용 |
|------|------|
| 인증 | `ADMIN_TOKEN` 환경변수 + httpOnly 쿠키(해시 저장, 12시간). **T3.1 계정 권한 전까지 임시.** 토큰 규격 · 보관 · 회전은 §9.2 ⓐ |
| 회전 = 즉시 무효화 | 쿠키에 든 값이 `sha256(ADMIN_TOKEN)`이고 `isValidAdminCookie()`가 매 요청 **현재 토큰의 해시**와 비교한다. 따라서 토큰을 바꾸는 순간 발급된 쿠키가 전부 불일치한다 — **세션 무효화 목록을 만들지 않는다** |
| 경로 보호 | `src/proxy.ts`가 `/admin/*`에서 쿠키 존재를 확인해 로그인으로 보낸다 |
| 값 검증 | 각 API가 `requireAdmin()`으로 쿠키 값을 직접 검증한다. proxy만 믿지 않는다 |
| 쓰기 권한 | `service_role`(RLS 우회)이므로 인증 뒤에서만 호출한다 |
| 화면 | `/admin`(대시보드) · `/admin/sets` · `/admin/keywords` · `/admin/cards`(목록 — 검색 · 페이지네이션) · `/admin/cards/new`(등록) · `/admin/cards/[cardId]`(수정 · 삭제) |
| API | `POST /api/admin/session` · `POST /api/admin/sets` · `POST /api/admin/cards` · `PATCH·DELETE /api/admin/cards/[cardId]` |

> **카드 도달 경로는 목록(`/admin/cards`) 하나로 모은다.** 대시보드 표의 각 행도 같은 상세로 링크한다. 등록만 되고 다시 찾을 수 없는 상태가 T1.12 이전의 실제 문제였다(§8 T1.12).

> ⚠️ **토큰 1개 = 전체 쓰기 권한**이다. 유출되면 카탈로그 전체를 조작할 수 있고, T1.12에서 삭제 화면이 생겨 그 범위가 "등록·수정"에서 **하드 삭제**(§9.10)까지 넓어졌다. **2026-08-25에 토큰 방식을 T3.1까지 유지하기로 결정했고, 그 대신 전제 3가지를 붙였다 — §9.2.** 그중 하나가 **관리자 API의 파괴 표면 동결**이다: 일괄 삭제 · 전량 덮어쓰기 엔드포인트를 늘리지 않는다.


### 4.7 덱 · 시뮬레이터 도메인 계약 (T2.1 · T2.2 — 2026-08-28 확정)

§4.0은 **"게임별 룰 테이블을 주입받는 형태로 구현한다. 규칙을 코드에 하드코딩하지 않는다"**까지만 정했다. 이 절이 **그 주입의 형태 · 공개 함수 시그니처 · 타입 위치 · 카드 DB 비의존을 강제하는 방법**을 확정한다. **구현은 Developer가 §7 TDD로 받는다 — 이 절은 코드가 아니라 계약이다.**

**왜 지금 착수하는가.** §9.11 ⓔ가 못박았다 — **문의 회신이 어느 쪽으로 오든 버려지지 않는 유일한 작업**이고, 카드 DB를 호스팅하지 않는 갈래(§9.11 ⓓ-2)에서도 그대로 쓰인다. 순수 함수라 **카탈로그가 0행인 것이 제약이 아니고**(§9.8), **T1.14와 자원이 겹치지 않는다** — T1.14는 사용자가 손으로 하고 이쪽은 에이전트가 한다.

#### ⓐ 모듈 경계

```
src/types/game.ts                     # GameCode · DeckZone · GameRules · DeckSlot  (타입 전용)
src/lib/domain/
├── rules.ts                          # 구조 룰 표 + composeGameRules()
├── simulator/                        # T2.1
│   ├── shuffle.ts                    # 시드 기반 Fisher-Yates
│   ├── draw.ts                       # 라이브러리 전개 · 첫 손패 · 멀리건
│   └── probability.ts                # 초기 손패 하이퍼기하 확률
└── deck/                             # T2.2
    ├── validate.ts                   # 덱 크기 · 매수 제한 · 존 · 리더 색상
    └── stats.ts                      # 분포 집계
```

**이 범위 밖 — 이번에 만들지 않는다.** ⓐ `games` 행을 읽어 `GameRules`로 바꾸는 조회부(`src/lib/games/*`) ⓑ `cards` 행을 `DeckSlot`으로 바꾸는 어댑터 ⓒ Zustand 스토어 · UI. 셋 다 **T2.4 · T2.5의 몫**이고, **셋 다 도메인 밖에 둔다**(아래 ⓓ).

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
2. **멀리건 결과가 3갈래다.** ptcg 멀리건은 「기본 포켓몬 0장」이 조건인데 **그 판정에 필요한 값이 우리 스키마에 없다**(ⓗ-1). **모든 슬롯의 `roles`가 `undefined`면 `undecidable`을 돌려준다 — 조용히 `false`를 주지 않는다.** 이것이 ⓗ의 공백을 화면까지 끌고 나오는 장치다.
3. **`drawOpeningHand`는 덱이 `handSize`보다 작아도 던지지 않는다.** 있는 만큼 뽑고 `library`가 빈다. 덱 크기 판정은 **`validateDeck`의 일**이고 두 곳에서 같은 것을 검사하지 않는다.

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

1. **위반을 전부 모아서 돌려준다. 첫 번째에서 멈추지 않는다.** 덱 빌더는 목록으로 보여 줘야 하고, 하나씩 고치게 하면 60장 덱에서 왕복이 수십 번이 된다.
2. **매수 제한은 `cardKey`로 합산한다.** 같은 카드가 두 슬롯에 나뉘어 있어도(2 + 3 = 5) 걸린다 — **나눠 넣으면 통과하는 검증은 검증이 아니다.**
3. **색을 모르면 통과가 아니라 `color_unknown`이다.** `colors`가 `undefined`인 슬롯을 조용히 넘기면 **"검증했다"는 화면이 아무것도 검증하지 않은 상태를 덮는다.** ⚠️ 이것은 §4.4.1이 경계하는 **"못 찾음을 허용으로 읽는"** 것과 같은 실수다.
4. **`leader` 존이 없거나 둘 이상인 것은 `deck_size` 위반으로 표현한다**(`zone: "leader"`, `expected: 1`). 리더 전용 코드를 따로 만들지 않는다 — 존 크기 규칙 하나로 덮인다.

#### ⓖ 테스트 케이스 (§7 필수 목록에 이어 붙인다)

**`rules.ts`** — ⓑ의 재하드코딩 방지가 여기 있다.
- 넘긴 수치가 그대로 나온다(99 · 3 · 1) ★ **이 케이스가 이 절의 핵심 장치다**
- `opcg`는 `extraZones`에 `leader`(1) · `don`(10)을 갖고 `leaderColorMatch === true`
- `ptcg`는 `extraZones`가 빈 배열이고 `leaderColorMatch === false`

**`shuffle.ts`**
- 같은 시드 → 같은 순열(2회 호출 결과 동일) / 다른 시드 → 다른 순열(고정 시드 2개로 단언해 flaky를 피한다)
- **입력 배열이 변하지 않는다**
- **다중집합 보존** — 정렬하면 원본과 같다(카드가 사라지지도 늘지도 않는다)
- 경계: 길이 0 · 1

**`draw.ts`**
- `buildLibrary`: `count: 3` → 같은 `cardKey` 3개 / `count: 0` → 0개 / **`count: -1` → 0개(던지지 않는다. 판정은 `validateDeck`)** / 다른 존은 섞이지 않는다
- 첫 손패 매수가 **`rules.handSize`를 따른다** — ★ **`handSize: 3`인 가짜 룰로 3장이 나오는지 단언한다.** 7·5를 직접 단언하면 그 테스트가 숫자를 코드에 다시 심는다(§2.7의 `toBe(NOW)` 사고와 같은 유형)
- 덱이 `handSize`보다 작으면 있는 만큼 뽑고 `library`가 빈다
- **멀리건 후에도 손패+라이브러리의 다중집합이 덱과 같다**(§7 "멀리건 후 덱 상태 불변")
- opcg: 2회째 멀리건 → `not_allowed / limit_reached`
- ptcg: 손패에 `basic_pokemon` 역할이 **있으면** `not_allowed / condition_not_met`, **없으면** `redrawn`
- ptcg: **모든 슬롯의 `roles`가 `undefined`면 `undecidable`** ★
- 시드 고정 시 `drawOpeningHand` 결과가 재현된다

**`probability.ts`** — **손으로 검산되는 소형 값으로 단언한다.** 60장 덱 값을 넣으면 기댓값을 계산기로 만들어야 하고, 그러면 테스트가 구현을 베낀 것이 된다.
- `N=4, K=2, n=2` → `atLeast(minHits 1) = 5/6` · `exactly(hits 2) = 1/6` (부동소수 비교는 허용오차를 둔다)
- 경계: `K=0` → 0 / `K=N` → 1 / `n=0` → 0 / `minHits > K` → 0
- **산출 불가**: `n > N` · `K > N` · 음수 · 비정수 → `null`
- 큰 입력(`N=300, K=40, n=60`)에서 **유한하고 0..1 범위** — 조합수 오버플로로 `NaN`/`Infinity`가 나오지 않는지 본다(이 유형은 작은 값 테스트만으로는 안 잡힌다)

**`validate.ts`**
- ptcg 메인 60 → ok / **59 · 61 → `deck_size`**(경계 양쪽)
- 매수 **정확히 4 → ok / 5 → `copy_limit`**(경계)
- **같은 `cardKey`가 두 슬롯에 2 + 3 → `copy_limit`** ★
- `copyLimitExempt: true`인 슬롯은 8장이어도 ok(기본 에너지)
- opcg: `leader` 0장 · 2장 → 위반 / 1장 → ok / `don` 10 → ok
- ptcg 덱에 `leader` 슬롯이 있으면 `zone_not_allowed`
- opcg 색상: 리더 `["red"]` · 메인 `["red"]` → ok / 메인 `["green"]` → `leader_color_mismatch` / 메인 `["red","green"]` → **불일치**(리더 색의 부분집합이어야 한다) / `colors` 없음 → `color_unknown`
- **위반이 여러 개면 여러 개가 다 담긴다**(첫 개에서 끊지 않는다) ★
- 빈 덱 → `deck_size` 위반 1건, 예외 없음

**`stats.ts`**
- 빈 덱 → 전 존 0
- `groupBy` 미지정 → `groups`가 빈 배열
- `groupBy`가 `null`을 반환하는 슬롯은 **`key: null` 버킷으로 모인다**(버려지지 않는다)
- `byZone`은 슬롯 수가 아니라 **`count` 합**이다

#### ⓗ 이 설계가 드러낸 스키마 공백 **2건 — T2.1 · T2.2를 막지는 않는다**

**둘 다 도메인이 호출부에서 값을 받는 구조라 지금 착수에는 지장이 없다. 막히는 것은 어댑터를 만드는 T2.5다.**

| # | 공백 | 지금 어떻게 되나 |
|---|------|------------------|
| 1 | **ptcg 「기본 포켓몬」을 식별할 값이 없다.** `cards.sub_type`은 §4.0이 `basic_energy` 판정 전용으로 못박았고, `card_type`은 자유 텍스트다 | `DeckSlot.roles`가 비면 멀리건이 **`undecidable`**을 돌려준다(ⓔ-2). 화면에 "판정 불가"로 나오고 **조용히 통과하지 않는다** |
| 2 | **opcg 다색 카드를 표현할 수 없다.** `cards.attribute`가 **단일 텍스트 컬럼**인데 원피스에는 2색 카드가 있다(§4.1 · T1.14의 "표기 통일" 주의) | `DeckSlot.colors`가 **배열**이라 도메인은 이미 다색을 받는다. **못 채우는 것은 어댑터 쪽이다** |

> **두 건 모두 지금 마이그레이션을 만들지 않는다.** §9.4가 코스트·파워를, T1.14가 `sub_type`(원피스 特徴)을 **같은 자리에서 미결로 걸어 두었고**, 넷은 「카드의 게임 성능을 어떤 모양으로 저장할 것인가」라는 **하나의 질문**이다. **T1.14의 "실데이터에서 무너진 지점" 표가 그 판단의 재료**이므로 **한 마이그레이션에서 함께 결정한다.** 지금 넷을 따로 정하면 컬럼이 네 번 늘고 그중 몇 개는 §4.1의 `search_vector`처럼 아무도 읽지 않게 된다.


---

## 5. API 명세

### 5.1 Route Handlers (`src/app/api`)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/cards` | 도감 검색. `q, game, set, rarity, attribute, cardType, keywords[], cursor, cursorId, limit`. **키워드는 AND(모두 보유)**. 커서는 `(code, id)` 튜플 (007) | — |
| GET | `/api/cards/facets` | 필터 선택지(레어도 · 속성 · 종류 · 세트 · 키워드). `game`으로 좁힌다 | — |
| GET | `/api/cards/:cardId` | 상세 + 최신 기준가 1건 | — |
| GET | `/api/cards/:cardId/alternatives` | 동일 `base_code` 카드 목록 (현재는 상세 RSC가 직접 조회) | — |
| GET | `/api/decks` | 레시피 목록. `game, tier, sourceType, cursor` | — |
| GET | `/api/decks/:deckId` | 레시피 상세(카드 구성 포함) | — |
| POST | `/api/decks` | 사용자 덱 저장 | ✅ |
| PATCH / DELETE | `/api/decks/:deckId` | 소유자만 | ✅ |
| GET | `/api/collection` | 내 컬렉션 + 총 가치 | ✅ |
| POST | `/api/collection` | 카드 추가(소장 / 위시리스트) | ✅ |
| PATCH / DELETE | `/api/collection/:itemId` | 수량 · 상태 변경 | ✅ |
| POST | `/api/binder/share` | 공유 슬러그 발급 / 토글 | ✅ |
| GET | `/api/binder/:slug` | 공개 바인더 조회 | — |
| GET | `/api/news` | 기사 목록 — **아직 만들지 않았다.** 현재 `/news`는 RSC가 직접 조회한다 | — |
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
| POST | `/api/admin/cards` | 카드 등록 (`keyword_ids` 포함. 연결 실패 시 카드를 되돌린다) |
| PATCH / DELETE | `/api/admin/cards/:cardId` | 카드 수정 · 삭제. **PATCH는 `keyword_ids`를 받아 태그를 전량 교체한다**(T1.12 이전에는 400으로 거부). 삭제는 하드 삭제 — §9.10 |

> **키워드 재태깅은 앱 레벨 보상 트랜잭션이다.** 이전 `keyword_id` 목록을 읽어 두고 → `delete` → `insert` 하며, insert가 실패하면 읽어 둔 목록을 되돌려 넣는다. `POST /api/admin/cards`가 카드를 되돌리는 것과 같은 패턴으로, 되돌릴 대상이 **카드가 아니라 이전 태그 목록**이라는 점만 다르다. DB 트랜잭션(RPC)을 쓰지 않으므로 마이그레이션이 필요 없고, `service_role`의 `card_keywords` DELETE 권한은 마이그레이션 001에 이미 있다.

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

ADMIN_TOKEN=                      # 관리자 화면. 코드 하한은 16자, 운영 규격은 43자 난수 — §9.2 ⓐ
NEXT_PUBLIC_ADSENSE_CLIENT=       # **폐기 (§0.1 ⓑ). 비워 둔다** — 값을 넣는 순간 광고가 렌더된다
                                  # 제거 예정: 백로그 E-2 (§0.1 ⓒ — 수익화하지 않기로 확정)

SUPABASE_DB_PASSWORD=             # 로컬 CLI 전용(link / db push). 앱 런타임 미사용

# T2.9에서 활성화
# CRAWLER_WORKER_URL=
# CRAWLER_SHARED_SECRET=
# IP_HASH_SALT=
```

* `src/lib/env.ts`가 클라이언트 변수를, `src/lib/env.server.ts`가 서버 시크릿을 부팅 시 검증한다.
* 시크릿은 **추적되는 파일(`.gitignore` 포함)에 절대 적지 않는다.**
* 시크릿 보관처는 **로컬 `.env.local`과 배포 플랫폼의 환경변수 UI 두 곳뿐이다.** 비밀 관리자 도구는 도입하지 않는다 (근거 §9.2 ⓐ).

---

## 7. 테스트 전략 (TDD)

단위 테스트는 소스 옆에 `*.test.ts`로 두고, E2E만 `tests/e2e`에 둔다.

| 레벨 | 도구 | 대상 | 필수 케이스 |
|------|------|------|-------------|
| 단위 | Vitest | `src/lib/validation` | 검색 파라미터 정규화 · limit 상한, 관리자 입력의 선택 항목 null 정규화 · `name_ja` 필수 |
| 단위 | Vitest | `src/lib/domain` | 시드 셔플 재현성, 멀리건 후 덱 상태 불변, 하이퍼기하 확률값, 기준가 이상치 제거, `sample_size<3` 시 산출 불가, 컬렉션 총액. **T2.1 · T2.2의 케이스 전량(경계값 포함)은 §4.7 ⓖ** |
| 단위 | Vitest | `src/components/common` | 에러 경계 폴백 · reset |
| 단위 | Vitest | `workers/crawler/src/adapters` | 픽스처 HTML → `Listing` 정규화, 파싱 실패 시 graceful skip |
| 통합 | vitest-pool-workers | 워커 | 토큰 재사용 거부, 만료 토큰 거부, 잘못된 서명 거부 |
| E2E | Playwright | 앱 셸 | 홈 렌더 · 내비 이동 · 타이틀 템플릿 · 다크 모드 토글 |
| E2E | Playwright | 도감 | 검색어 URL 동기화 · URL 복원 · 빈 결과 안내 · 게임 필터 |
| E2E | Playwright | 관리자 | 미인증 접근 차단 · 잘못된 토큰 거부 · API 401 · **세트→카드 등록→도감 반영** · 중복 코드 차단 |

**데이터 의존 금지.** 도감 E2E는 카드가 몇 장 있는지를 전제하지 않는다. 카탈로그는 관리자가 직접 채우므로 양이 고정되지 않는다. 등록 후 반영은 관리자 E2E가 자기 데이터를 만들어 검증한다.

**E2E 기준선은 `CI=1`(프로덕션 빌드) 기준으로 잡는다.**

`playwright.config.ts`는 `CI`가 있으면 `npm run build && npm run start`로, 없으면 `next dev`로 서버를 띄운다. **두 모드는 결과가 다를 수 있다** — 프리페치 · 정적 프리렌더처럼 프로덕션에만 있는 동작은 dev E2E를 전부 통과해도 그대로 남는다(§2.7의 관리자 로그인 프리페치가 실제 사례이며, 배포 환경의 사용자도 겪던 버그였다). 따라서 §8에 "몇 건 ✅"을 적을 때는 **`CI=1` 실행 결과만** 쓴다. `webServer.timeout`이 300초인 것도 이 경로가 빌드를 포함하기 때문이다(120초로는 빌드 도중 끊긴다).

- **`tests/e2e/global-setup.ts`** — 홈 · 도감 · 뉴스 · 관리자 로그인과 **상세 라우트**(존재하지 않는 id/슬러그)를 미리 요청해 첫 컴파일 · 최초 DB 연결 비용을 스펙 밖으로 밀어낸다. 404가 나도 라우트는 로드되므로 목적을 달성한다. **라우트를 추가하면 워밍업 목록에도 넣는다.**
- **serial describe는 통과 건수를 왜곡한다.** 자기 데이터를 만들어 쓰는 spec 4개(`card-detail` · `news` · `cursor` · `filters`)가 `test.describe.configure({ mode: "serial" })`라, **앞의 1건이 깨지면 뒤가 통째로 "did not run"** 이 된다. 실패 1건이 실제로는 여러 건의 미검증을 뜻하므로 통과 건수만 보고 판단하지 않는다.

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
- [x] **T1.7b** 필터 확장 — 마이그레이션 004(`search_cards` · `card_facets` SQL 함수 + EXECUTE 권한). 레어도 · 속성 · 종류 · 발매 팩 셀렉트(건수 표기) + **효과 키워드 AND 조합** 칩. 관리자에 `/admin/keywords` 등록과 카드 폼 태깅 추가
- [x] **T1.8** 카드 상세 `/cards/[cardId]` — 마이그레이션 005(`base_code` 생성 컬럼 + `(game_id, base_code)` 인덱스, §4.6). **DB 타입 생성 도입**(`src/types/database.ts` — §2.7 "DB 타입 미생성"). `card_prices`가 아직 없어(T2.8) 기준가는 항상 "산출 불가"다
- [x] **T1.9** 뉴스 · SEO · 애드센스 요건 — 마이그레이션 006(`news_posts`, **초안 차단은 RLS가 한다**). `react-markdown`+`remark-gfm` · `sitemap.ts`(1000행 페이지네이션) · `robots.ts` · OG · 개인정보처리방침 · 면책 · `AdSlot`(ID 없으면 미렌더). 부수로 `/cards/[cardId]`를 익명 클라이언트로 전환 (§2.7 "`cookies()` → 강제 동적 렌더링")
- [x] **T1.10** 비주얼 정리 (§2.8) — 갤러리 톤 토큰 3개 + 유틸 3개, 홈 전면 재작성, 카드 그리드 재설계(실물 비율 · 레어도 배지 대비), `/decks`·`/binder`를 `ComingSoon`으로
  - **주의**: 푸터에 목록이 생겨 `getByRole("listitem")`이 전역에서 6개를 잡았다. 뉴스 마크다운 E2E는 `getByRole("article")`로 범위를 좁혔다 — 전역 셀렉터가 두 번째 사용처를 만나면 깨진다
- [x] **T1.11** 리팩토링 — 마이그레이션 007(`search_vector` · `similar_groups` 제거, §4.1). **커서 버그 수정**(§2.7 "커서 키 ≠ 유니크 키"). `CardImage` 통합 · 상세 조회 React `cache()` · `requireAdminInput()` · `revalidateNews()` · `db:clean`/`db:sample` 등록 · `CLAUDE.md`의 `similar_group_id` → `base_code`
  - **`CI=1`(프로덕션 빌드) 전수 검증을 여기서 처음 했다**(§7). 그전 수치는 serial describe의 미실행분이 섞여 실측된 적이 없었고, 그 과정에서 관리자 로그인 프리페치(제품 버그)와 콜드 라우트 타임아웃(하네스) 두 건을 잡았다 (§2.7)

- [x] **T1.12** 관리자 운영 최소 완결 + 404 (§4.5, §5.1) — 백로그 **A-1~3 · B-1~2 · D**를 묶었다. **마이그레이션 0건.** `feat/t1-12-admin-ops` → `main` `--no-ff` 머지(`cff265d`)
  - **착수 근거:** 등록한 카드에 **다시 도달할 경로가 0개**였다. 게다가 `name_ja`(§4.4 — 크롤러의 유일한 검색 키)와 `code`(§4.6 — `base_code`의 원천)의 오타를 고칠 화면이 없었다. 병목이 코드가 아니라 카탈로그인 상황에서 입력 도구를 고치는 것이 이후 전 작업의 처리량을 올린다
  - **T1.12-1** `/admin/cards` 목록(검색 · 페이지네이션) — **`search_cards` RPC를 쓰지 않는다**: ⓐ `code`가 검색 대상에서 빠져 있고 ⓑ `security invoker`라 anon RLS 기준이며 ⓒ total을 주지 않는다. admin 클라이언트로 직접 조회하고 입력은 `sanitizeSearchTerm`으로 거른다(§2.7 "PostgREST `.or()` 문자열 필터"). **공용 `AdminTable`을 만들지 않았다** — 사용처 2곳, 추상화가 이르다
  - **T1.12-2** `/admin/cards/[cardId]` 수정 · 삭제 — `CardForm`을 등록·수정 겸용으로 확장, `AdminDeleteButton`을 `news-delete-button`에서 일반화(`endpoint` · `redirectTo` · `label`). **삭제 영역은 `<form>` 밖 형제로 둔다**(danger zone)
  - **T1.12-3** 키워드 재태깅 — `PATCH`의 400 제거. 앱 레벨 보상 트랜잭션(계약은 §5.1). `service_role`의 `card_keywords` DELETE 권한이 001에 이미 있어 **권한 마이그레이션 불필요**
  - **T1.12-4** `not-found.tsx` — **루트 하나면 충분하다**(루트 레이아웃 안에서 렌더되므로 상세의 `notFound()`와 미매칭 URL을 모두 덮는다). **상세 `loading.tsx`는 만들었다가 제거했다** — §2.7 "ISR 상세 라우트에 `loading.tsx`". 백로그 B-2가 이 판단으로 닫혔다
  - **T1.12-5** 관리자 인증 단위 테스트 17건 — `session.ts`는 인터넷과 `service_role` 쓰기 사이의 **유일한 방벽**인데 E2E 401 1건으로만 간접 검증되고 있었고, T1.12-1~3이 그 쓰기 표면을 넓혔다. 선행으로 `vitest.config.mts`의 `server-only` alias가 필요했다 (§2.7)
  - **T1.12-6** 문서 갱신
  - **T1.12-7** 발행 직후 가시성 — **원인 1겹 + 증폭 1겹.** 진단이 세 번 바뀐 끝의 결론만 남긴다. 중간 가설의 잔재는 §2.7의 함정 행 3개에 있다
    - **원인 — RLS 가시화 창 (§2.7 ★).** `published_at`은 **앱 시계**, 공개 RLS의 `now()`는 **DB 시계**다. 발행 직후 약 1.2초 자기 글이 자기에게 안 보인다. **처방: `resolvePublishedAt`이 `now - 5초`를 찍는다**(마이그레이션 0건). 단위 테스트의 `toBe(NOW.toISOString())`도 함께 갈았다 — **"정확히 앱 시계를 찍는다"를 못박아 이 버그를 다시 불러들이는 테스트**였다
    - **증폭 — Data Cache (§2.7).** 세그먼트 `revalidate`가 supabase-js fetch까지 캐시에 넣어 그 **빈 결과를 300초~1시간 얼렸다.** 무효화를 두 번 다시 설계하고도 첫 실패가 사라지지 않은 이유다. `revalidateTag`로 비우는 길은 **이 버전에서 막혀 있다**(§2.7 — 실측 후 철회)
    - **처방 2 — 쓰기 직후 정확성이 필요한 라우트를 동적으로.** `/news` · `/news/[slug]` · `/cards/[cardId]`에 `force-dynamic` + `revalidate` 제거 + `generateStaticParams` 제거. **홈과 sitemap은 ISR로 남긴다**(관리자가 확인하는 경로가 아니고, 홈은 트래픽과 심사원의 첫 화면이라 ISR 가치가 가장 크다). 판정 기준은 **P1에 올렸다**
      - `/cards/[cardId]`의 `generateStaticParams`는 `return []`이라 **포기한 프리렌더가 애초에 없었다** — 빌드 표의 `●`는 "빌드에 프리렌더됨"이 아니라 "첫 요청에 생성 후 캐시됨"이고, 그 캐시가 카드 수정·삭제 지연의 본체였다. `/news/[slug]`만 실제 프리렌더를 포기했고, 대가는 요청당 DB 왕복 1회 · 덤으로 빌드가 DB에 의존하지 않게 됐다
      - **`revalidate` 제거만 하지 않고 `force-dynamic`을 명시한다** — 설정이 텅 빈 라우트는 "왜 비어 있지?"로 읽혀 **누군가 ISR을 다시 붙인다.** 덤으로 `generateStaticParams`와 공존 불가라 프리렌더 재도입을 빌드가 막아 준다
    - **카드 쪽은 순수하게 캐시 문제였다**(`cards_public_read`에 시간 조건 없음). 수정·삭제 반영이 **최대 1시간 → 약 1초**
    - **계약 변경 — `revalidateNews`/`revalidateCards`가 인자를 잃었다.** `slug`·`cardId`를 받던 이유는 그 경로의 라우트 캐시를 비우기 위해서였는데 **그 라우트들이 동적이라 비울 캐시가 없다.** 남은 대상은 홈과 sitemap 둘뿐이다
    - **태그 인프라는 전량 폐기했다**(`cache-tags.ts` 등) — 동적 렌더에서 아무 일도 하지 않는 **"동작하지 않는 안전장치"**가 되기 때문이다. 007의 `search_vector` 제거와 같은 판단
    - **E2E 회귀 기준(계속 유효):** 쓰기 직후 반영을 단언하는 spec은 **쓰기 *전에* 상세를 한 번 방문해야 한다.** 방문하지 않으면 캐시 항목이 애초에 없어 **우연히 통과한다** — 카드 수정·삭제 spec이 실제로 그 상태였다. "발행 취소 → 즉시 404"도 이때 신설했다(기존 "초안은 주소를 알아도 404"는 *처음부터 초안인 글*이라 이 경로를 덮지 못한다)

  - **주의(전역 셀렉터):** `data-testid="form-error"`를 `field.tsx` · `admin-delete-button.tsx` · `admin-login-form.tsx` 세 곳이 공유하는데 **카드 수정 화면은 폼과 삭제 버튼이 공존**한다. 둘이 동시에 에러를 내면 Playwright strict mode가 "resolved to 2 elements"로 실패한다. `AdminDeleteButton`은 항상 `data-testid="admin-delete-zone"`인 `<section>` 안에서만 렌더하므로 E2E는 `page.locator("form")` / `getByTestId("admin-delete-zone")`으로 범위를 좁힌다 — T1.10의 `listitem` 사고와 **같은 유형**이다
  - **최종 검증:** `lint`·`typecheck` ✅ / `test` **94건** ✅ / `test:e2e` **`CI=1`(프로덕션 빌드) 46건** ✅ / 빌드 렌더 모드 — `/` `○ 10m` · `/sitemap.xml` `○ 1h` · `/news` · `/news/[slug]` · `/cards/[cardId]` · `/admin/**` 모두 `ƒ`

> **Phase 1 종료 (2026-08-25).** T1.1~T1.12가 모두 닫히고 **`main`에 머지됐다**(`--no-ff` `cff265d`). 기반(스캐폴딩 · 스키마/RLS/GRANT · 도감 · 상세 · 뉴스/SEO · 비주얼 · 리팩토링 · 관리자 운영)은 서 있고, **남은 병목은 코드가 아니라 그 위에 올릴 데이터다** — §9.8 실측으로 카탈로그는 0행이다. 다음은 §8 맨 뒤 "다음 작업".

### Phase 1.5 — 데이터 착수 (2026-08-25 신설)

코드가 아니라 **그 위에 올릴 데이터**를 다루는 묶음이다.

> **실행 순서는 번호순이 아니었다 — `T1.13 → T1.15 → T1.14`.** T1.14(손입력)가 먼저 설계돼 번호를 가져갔고, 두 선행 태스크를 그 앞에 놓았다. **둘 다 "실현되면 이미 늦는" 위험을 받는다:**
> - **T1.13이 없으면** T1.14의 결과물이 클릭 한 번에 사라진다 (§9.2 ⓑ)
> - **T1.15가 없으면** 손입력 도중 세트명 오타를 발견해도 고칠 수 없다 — 그때는 카드가 이미 걸려 있어 **세트 삭제가 `on delete restrict`로 막힌다**
>
> **T1.13 · T1.15 · T1.12-7(반영 지연 최대 1시간 → 약 1초)이 모두 닫혔다. 남은 것은 T1.14뿐이다.**

- [x] **T1.13** 카탈로그 로컬 덤프 — `npm run db:dump` · S
  - **§9.2 ⓑ의 실행이다.** 무료 플랜에 자동 백업이 없으므로 이것이 유일한 되돌릴 수단이다
  - **확정된 명령: `supabase db dump --linked --data-only --schema public`** (dry-run 통과). `scripts/dump-catalog.ts`가 감싸고 `npm run db:dump`로 노출한다. 결과는 `backups/`(`.gitignore` 등록 완료)
  - **비밀번호는 자식 프로세스 환경으로만 넘긴다** — `--env-file=.env.local`이 넣어 준 `SUPABASE_DB_PASSWORD`를 그대로 전달한다. **명령줄 인자로 쓰지 않는다**(프로세스 목록에 그대로 노출된다). **0바이트 파일은 실패로 처리한다** — 조용히 빈 백업이 남는 것이 가장 나쁜 결과다
  - ~~폴백(PostgREST 직호출 + `Range` 페이지네이션)~~ — **Docker가 뜨므로 이 분기는 닫는다.** 되살릴 조건은 "Docker를 쓸 수 없는 환경으로 옮길 때" 하나뿐이다
  - `pg_dump`가 `--column-inserts`를 쓰므로 **`base_code` 생성 컬럼이 자동 제외된다** — 직접 걷어낼 필요가 없다(§4.6)
  - `.env.example`의 `ADMIN_TOKEN` 주석을 §9.2 ⓐ 생성 명령으로 갱신 — 완료
  - **복원 순서는 FK를 따른다** — `games → card_sets → cards → keywords → card_keywords → news_posts`(`cards.set_id`가 `on delete restrict`다)
  - **운영 규칙**: 손입력 세션이 끝날 때마다 1회, 그리고 **`npm run db:clean` 실행 직전에 반드시 1회**(§9.9 — 드라이런이 없다)
  - **복원 리허설 실측 완료 (완료 기준 충족).** 표본 → 덤프(7,859 bytes) → `db:reset` → psql 복원에서 **다섯 테이블 행 수가 원격과 일치**했고, **생성 컬럼 `base_code`도 정상 계산됐다**(`SMPL-OP-001_p1` → `SMPL-OP-001`) — **대체 카드 판정(§4.6)이 복원을 견딘다**는 뜻이다. 덤프 파일에 `base_code` 참조는 0건이고 `backups/`는 `git status`에 뜨지 않는다
    - ⚠️ **리허설 전에 표본을 먼저 넣는다(`npm run db:sample`), 끝나면 `db:clean`으로 되돌린다.** 카탈로그가 0행이라 그냥 돌리면 **"0 = 0"을 확인하는 무의미한 리허설**이 되어 덤프가 깨져 있어도 통과한다. 이번엔 이 방법으로 피했고 **다음 리허설에도 같은 함정이 있다**
    - ⚠️ **복원에 `ON_ERROR_STOP=1`을 쓰지 않는다** — §2.7의 해당 행. 절차는 `scripts/dump-catalog.ts`의 doc에 있다

- [ ] **T1.14** 실제 카드 손입력 1배치 — 원피스 ST-01 · ST-02 (34종) · M
  - **선행 T1.13(되돌릴 수단) · T1.15(오타를 고칠 화면) 모두 완료. 실행은 사용자가 직접 한다.** 목표는 카탈로그를 채우는 것이 아니라 **측정하는 것**이다 — 아래 "측정 기록"을 채우는 것이 산출물이고, 그 값이 A-5 · B-4 · B-5의 순위를 정한다
  - **왜 이 세트인가** — 기준을 먼저 세우고 후보를 걸렀다

    | 기준 | 원피스 **ST-01 + ST-02** (채택) | 원피스 OP-01 일부 | 포켓몬 일본판 확장팩 1종 |
    |------|------|------|------|
    | 30~50종에 **완결 단위**로 맞는가 | ✅ 17 + 17 = **34종. 두 세트가 통째로 다 들어간다** | ❌ 121종 중 일부 — "반쯤 찬 세트"가 남아 어디까지 넣었는지 기억에 의존 | ❌ 60~100종 |
    | `code` 체계의 규칙성 (§4.6) | ✅ `ST01-001`~`ST01-017` 연번. 밑줄 없음 | ✅ `OP01-###` | ⚠️ 공식 표기가 컬렉터 넘버(`001/187`)라 **세트 접두사를 우리가 창작해야 한다.** `base_code`가 `code`에서 파생되므로 나중에 코드 규칙을 바꾸면 대체 카드 판정이 통째로 흔들린다 |
    | 키워드 태깅 난이도 | ✅ 효과 텍스트가 짧고 정형적. 종류가 `LEADER`/`CHARACTER`/`EVENT`/`STAGE` 4종뿐이라 필터 표본으로도 좋다 | ✅ 동일 | ❌ 효과 텍스트가 길고 레어도 축이 10종 이상 |
    | `name_ja` 확보 (§4.4 · 크롤러 유일 키) | ✅ 공식 일본어명 그대로 | ✅ | ✅ |
    | 덤으로 얻는 것 | ✅ **ST-01은 리더 1장 + 메인 50장짜리 완성 덱이다** — §4.0의 opcg 덱 구조(리더/메인/DON)를 Phase 2에서 실데이터로 처음 돌려볼 최소 단위가 그대로 생긴다 | — | — |

    > **알고 감수하는 공백: 이 배치에는 파라렐이 없어 `_p1` 접미사 규칙(§4.6)을 실데이터로 밟지 못한다.** 그 때문에 OP-01에서 파라렐 카드 몇 장만 골라 넣는 유혹이 있는데 **하지 않는다** — "반쯤 찬 세트"를 만들지 않는 것이 더 중요하고, `base_code` 규칙은 다음 배치(OP-01 전량)에서 밟으면 된다. 이번 배치에서는 `base_code == code`가 된다
    > **외부 사이트 연동은 여전히 금지다(§4.4).** 위 세트 정보는 **사람이 보고 옮겨 적기 위한 참고**일 뿐이고, 어떤 사이트도 앱·스크립트가 자동으로 읽지 않는다

  - 🚨 **참조 원천은 `onepiece-cardgame.kr`(원피스 한국 공식) 하나다 — §4.4.1 결정 (2026-08-25).** 세트 선정(ST-01 · ST-02)은 그대로 유효하고, 바뀐 것은 **"어느 화면을 보고 옮겨 적는가"**다

    | 원천 | 이번 배치에서 | 근거 |
    |------|---------------|------|
    | `onepiece-cardgame.kr/cardlist.do` | ✅ **여기만 본다** | §4.4.1 결정 1 |
    | `onepiece-cardgame.com`(일본 공식) | ❌ **열지 않는다** | 「無断転用、転載をお断りします」 — §4.4.1 결정 2 |
    | `pokemon-card.com` | ❌ 이번 배치는 포켓몬이 아니라 애초에 해당 없음 | §4.4.1 결정 2 |
    | 카드 실물 | ✅ 병행 가능 | 사이트 약관 범위 밖 (§9.3 ⓑ) |

    > ⚠️ **`name_ja`가 이 결정과 부딪히는 유일한 필드다.** 한국 사이트는 **한국어 카드명**을 보여주는데 `name_ja`는 `not null`이고 **T2.7 매물 검색의 유일한 키**다(§4.4). 일본 공식 사이트를 열어 베끼는 것은 §4.4.1 결정 2에 걸리므로 **그 경로를 쓰지 않는다.** 대신 이번 배치에서 다음 순서로 채운다.
    >
    > 1. **카드 실물의 일본어명** — ST-01 · ST-02는 일본판 실물이 있으면 그대로 옮긴다. 사이트 약관 범위 밖이다
    > 2. **한국 사이트가 일본어명을 함께 표기하는 경우** — 있으면 그것을 쓴다
    > 3. **둘 다 안 되면 그 카드는 이번 배치에서 보류한다** — `name_ja`에 추측값을 넣지 않는다. **여기 오타가 나면 T2.7 매물 조회가 통째로 빗나가는데 화면에서는 멀쩡해 보인다**(아래 필드 표)
    >
    > **몇 장이 3번으로 빠지는지가 이번 배치의 측정 항목 중 하나다.** 34장 중 상당수가 빠지면 그것 자체가 "문의 회신(§4.4.1 결정 6)을 기다려야 한다"는 신호이고, A-5보다 먼저 판단할 사항이 된다

  - **이미지는 핫링크로 넣는다 (§9.4 확정).** 자체 저장소로 복제하지 않는다. URL도 `onepiece-cardgame.kr`에서 얻는다. **URL을 구하지 못한 카드는 비운 채 넘어간다** — 폴백 프레임(§9.4 ⓑ · 백로그 B-6)이 그 자리를 받으므로 입력이 막히지 않는다. **몇 장이 그렇게 되는지가 측정 항목이다**(§9.4 ⓔ)

  - **필드별 입력 출처** — `/admin/sets`에서 세트 2개, `/admin/keywords`에서 opcg 키워드를 **먼저** 만든 뒤 카드를 넣는다

    | 컬럼 | 필수 | 무엇을 넣는가 | 주의 |
    |------|------|---------------|------|
    | `game_id` | ✅ | 폼의 게임 셀렉트 = 원피스 | 마이그레이션 001이 넣어 둔 2행 중 하나 |
    | `set_id` | 선택(사실상 필수) | 먼저 만든 `ST-01` / `ST-02` | 카드와 **같은 게임**이어야 한다(복합 FK). 비우면 도감의 발매 팩 필터에서 빠진다 |
    | `code` | ✅ | 공식 카드 넘버 그대로 — `ST01-001` … `ST01-017` | **밑줄 금지**(§4.6 — 인쇄본 접미사 전용). `(game_id, code)` 유니크라 중복은 409로 막힌다 |
    | `base_code` | — | **입력하지 않는다.** 생성 컬럼이라 폼에 칸이 없다 | 이번 배치에서는 `code`와 같아진다 |
    | `name_ja` | ✅ | 공식 일본어명 (`モンキー・D・ルフィ`) | **크롤러의 유일한 검색 키(§4.4).** 중점(`・`)·장음 표기를 공식대로. 여기 오타가 나면 T2.7 매물 조회가 통째로 빗나가는데 **화면에서는 멀쩡해 보인다** |
    | `name_ko` | 선택 | 한국 정식 발매명이 있으면, 없으면 비운다 | 표기는 `coalesce(name_ko, name_ja)` |
    | `name_en` | 선택 | **이번 배치는 비운다** | `search_cards`가 아직 `name_en`을 보지 않는다(백로그 C-1). 넣어도 검색되지 않아 입력 시간만 든다 |
    | `rarity` | 선택 | `L` · `C` · `SR` (ST-01 기준) | 도감 레어도 필터의 **선택지 자체가 된다.** 표기를 통일할 것 — `SR`과 `スーパーレア`가 섞이면 필터가 둘로 갈라진다 |
    | `attribute` | 선택 | 원피스는 **색**을 넣는다 — ST-01 적 / ST-02 녹 | 한글/일본어/영문 중 하나로 통일. 위와 같은 이유 |
    | `card_type` | 선택 | `LEADER` · `CHARACTER` · `EVENT` · `STAGE` | 4종뿐이라 필터 표본으로 적합 |
    | `sub_type` | 선택 | **비운다** | 이 컬럼은 `basic_energy` 판정 전용이다(§4.0). 원피스의 特徴(`麦わらの一味` 등)은 **한 카드에 여러 개**라 단일 텍스트 컬럼에 맞지 않는다 — 넣지 말고 아래 측정에 미결로 올린다 |
    | `image_url` | 선택 | **`onepiece-cardgame.kr`의 이미지 URL을 핫링크** (§9.4 확정 · §4.4.1 결정 4) | `z.url()`만 통과하면 저장된다. `CardImage`가 `<img>`라 `remotePatterns` 설정은 불필요. **파일을 내려받아 우리 저장소에 두지 않는다** — 그것이 4곳 약관이 첫 번째로 지목한 「복제」다(§9.4). **핫링크라 원본이 사라지면 이미지도 사라진다** — 이번 배치는 그 상태를 그대로 겪어 보는 것이 목적이다. 그때 엑박이 아니라 **폴백 프레임**이 뜨게 하는 것이 B-6이다(§9.4 ⓑ) |
    | `effect_text` | 선택 | 공식 텍스트 그대로 | 키워드 태깅의 근거이자 향후 C-2 검색 대상 |
    | `keyword_ids` | 선택 | 폼의 키워드 칩 | 키워드 `code`는 `^[a-z0-9_]+$`(§2.7 nuqs 쉼표 직렬화 방어) |

    `card_sets`는 `code` · `name_ja`(필수) · `name_ko`(선택) · `released_at`(`YYYY-MM-DD`)이다. **세트 코드는 공식 표기 `ST-01`, 카드 코드는 공식 카드 넘버 `ST01-001`** — 접두사가 서로 다르지만 **공식이 그렇게 쓰므로 우리가 통일하지 않는다.** 임의로 맞추면 실물·판매 사이트와 대조가 안 된다

  - ⚠️ **"방금 넣은 카드가 안 보인다"에 속아 같은 카드를 두 번 넣지 말 것.** `/cards` 도감은 ISR이 아니라 클라이언트가 `/api/cards`를 조회하므로 §2.7의 재생성 지연은 **없다.** 대신 **TanStack Query의 전역 `staleTime`이 5분**(`src/lib/query/provider.tsx`)이라 **같은 탭에서 같은 필터로 다시 열면 최대 5분간 이전 결과가 그대로 나온다.** 원인은 다르지만 화면 증상은 §2.7의 `/news`와 똑같다. **입력 확인은 `/cards`가 아니라 `/admin/cards`에서 한다** — `force-dynamic` RSC라 항상 최신이고 코드로 검색되므로 중복을 `(game_id, code)` 유니크(409)에 부딪히기 전에 눈으로 잡는다. 카드 **수정**을 `/cards/{id}` 상세에서 확인하는 것은 **T1.12-7 이후로는 믿을 수 있다**(약 1초). 이 라우트는 이제 `ƒ`이며, **여기에 다시 `revalidate`를 붙이면 T1.14의 확인 경로가 통째로 무너진다**(§2.7)
  - **완료 기준:** 34종(§4.4.1로 `name_ja`를 못 구해 보류한 장수는 제외)이 `/admin/cards`에서 코드로 검색되고, `/cards`의 원피스 필터·레어도·종류 필터에 잡히고, 상세가 열린다. **보류한 장수와 그 사유가 기록된다.** 아래 **측정 기록이 채워진다.** 마무리로 `npm run db:dump` 1회

  **측정 기록** — 반나절 뒤 이 표들이 A-5 · B-4 · B-5의 순위를 정한다. **집계값만 남기고 장별 원자료는 남기지 않는다**(§0: 이력은 여기 두지 않는다).

  | 항목 | 값 |
  |------|-----|
  | 대상 / 종수 | ST-01 · ST-02 / 34종 |
  | 시작 · 종료 · 총 소요 | |
  | 장당 중앙값 | |
  | 첫 5장 평균 → 마지막 5장 평균 | (숙련 효과. 차이가 작으면 손입력은 **줄지 않는 비용**이라는 뜻이고 A-5의 근거가 된다) |
  | 세트 · 키워드 사전 준비에 든 시간 | |

  | 필드 | 값이 어디서 왔나 | 막힌 지점 / 소요 비중 |
  |------|------------------|------------------------|
  | `name_ja` | | |
  | `rarity` · `attribute` · `card_type` | | (표기 통일을 지켰나. 무엇으로 정했나) |
  | `image_url` | | (§9.4 ⓔ 판단 재료 — **장당 URL 확보 시간**과 **폴백 발생률**(34장 중 URL을 못 구했거나 링크가 죽은 장수)을 여기 적는다) |
  | `effect_text` · 키워드 | | |
  | `sub_type`(特徴 미결) | | |

  | 실데이터에서 무너진 지점 | 화면 / 증상 | 영향 | 대응 후보 |
  |---|---|---|---|
  | | | | |

  | 그래서 다음은 | 판단 | 근거(위 수치 중 무엇) |
  |---|---|---|
  | **A-5** CSV 일괄 등록 | | (⚠️ 착수 시 §9.2 ⓒ 전제 3 재검토) |
  | **B-4** 도감 결과 건수 | | |
  | **B-5** 도감 정렬 | | |

- [x] **T1.15** 세트 · 키워드 수정 · 삭제 (백로그 A-4) — **마이그레이션 0건.** `937d147`(a 세트) · `727c1ff`(b 키워드)
  - **왜 T1.14보다 앞으로 당겼나:** 오타를 발견하는 시점이 문제다. 카드를 넣기 *전*이라면 지우고 다시 만들면 되지만, **넣는 도중이면 `cards.set_id`의 `on delete restrict`가 세트 삭제를 막는다.** 수정 화면이 없으면 그 세트는 영영 그 이름으로 남는다
  - 구성은 카드(T1.12-2)를 그대로 따랐다 — `PATCH·DELETE /api/admin/{sets,keywords}/[id]` · `/admin/{sets,keywords}/[id]` 수정 화면 · 폼 등록/수정 겸용 · 기존 zod 스키마 재사용. **별도 목록 라우트를 만들지 않았다** — 두 페이지가 이미 폼 아래 전체 목록을 렌더하므로 항목을 상세로 링크하면 끝이고, **수십 개 규모라는 전제가 유효하다**(카드가 `/admin/cards`를 따로 가진 이유는 수백 장이 되기 때문이다)

  **⚠️ 세트와 키워드는 세 가지가 서로 반대다. 한쪽을 복사해 다른 쪽을 만들면 조용히 틀린다.**

  | | **세트** | **키워드** |
  |---|---|---|
  | 삭제 시 DB | `on delete restrict` — **실패한다** | `on delete cascade` — **조용히 성공한다** |
  | 사전 카운트의 역할 | **차단**(409를 먼저 준다). 단 **경합은 막지 못한다** — 카운트와 삭제 사이에 카드가 붙을 수 있고 그때는 제약이 최종 판정한다 | **경고 문구 전용.** 막을 제약이 없으므로 차단하지 않는다 (`fetchKeywordCardCount`의 doc에 명시) |
  | 게임 잠금의 중요도 | 복합 FK `(set_id, game_id)`가 **막아주기라도 한다** | **더 중요하다.** 게임 FK가 없어 **에러 없이 저장되고**, 다른 게임 카드에 태그가 붙은 채 남아 필터가 조용히 어긋난다 |
  | `revalidateCards()` | **붙인다** — 홈(`○ 10m`)의 `fetchCatalogStats`가 `card_sets`를 센다 | **붙이지 않는다** — ISR 페이지 어디서도 키워드를 읽지 않는다. 라우트 doc에 "세트를 복사하며 이 줄까지 가져오지 말 것"을 적어 두었다 |

  - **`databaseError`에 `overrides?`가 붙었다** — `23503`의 기본 문구(`"선택한 세트가 이 게임에 속하지 않습니다."`)는 **insert 상황의 말**이라 세트 삭제 실패에 나오면 뜻이 통하지 않는다. **같은 PG 코드가 두 상황을 가리키므로** 호출부가 문구를 덮는다. 사전 카운트는 UX용이고 **진짜 방벽은 여전히 DB 제약**이다
  - **`AdminDeleteButton`에 `description?`이 붙었다**(확인 단계 경고 한 줄, `data-testid="admin-delete-warning"`). 둘 다 **가산 변경이라 안 넘기는 기존 호출부는 종전과 동일**하다 — 새 컴포넌트를 만들지 않았다
  - **캐시:** §2.7의 "쓰기 전에 방문" 규칙은 **여기 해당 없다** — `/admin/**`은 `ƒ`이고 공개 쪽도 `/cards/[cardId]`가 `ƒ`, 목록·패싯은 Route Handler라 **ISR로 세트·키워드를 읽는 곳이 없다.** 대신 **TanStack Query**(검색 5분 · 패싯 60초)가 같은 증상을 만들므로 확인은 **새 `page.goto()`**로 한다
  - **검증:** `lint`·`typecheck` ✅ / `test` **97건** ✅ / `test:e2e` **`CI=1` 49건** ✅. §9.9 규칙 1대로 새 접두사(`SX`·`SY`·`kx`·`KX`)를 **같은 커밋에서** `cleanup-sample.ts`에 등록했다 — 전 spec이 스스로 지우므로 그 패턴은 안전망이다

**T1.11 리팩토링에서 확인한 백로그**

**A-1~3 · B-1~2 · D는 T1.12에서 닫혔다.** 아래는 **남은 항목과 T1.12에서 뺀 이유**다.

**A. 관리자 운영** (T1.6-A 미포함분)

- [x] **A-1~3** 카드 목록 · 수정/삭제 UI · 키워드 재태깅 → T1.12-1~3
- [x] **A-4** 세트 · 키워드 수정 · 삭제 → **T1.15에서 닫혔다.** T1.12에서 뺀 근거("개수가 적고 다시 못 찾는 문제가 아니다")는 맞았지만, **손입력 도중이면 `on delete restrict`가 세트 삭제를 막아 되돌릴 방법이 없어진다**는 점이 T1.14 직전에 드러나 앞으로 당겼다
- [ ] **A-5** CSV 일괄 등록 · **L** — 수백 장을 폼 하나씩은 비현실적이지만 중복 처리 · 부분 실패 · 드라이런 · 게임/세트 매핑 설계가 먼저다. **잘못 만들면 카탈로그를 덮어쓴다** — §4.4가 시드 스크립트를 삭제한 것과 같은 위험이라 별도 설계 태스크로 분리한다. **선행 2가지: T1.13**(되돌릴 수단) · **T1.14**(입력 표본). 임포터가 upsert로 기존 행을 덮게 되면 관리자 API의 파괴 표면이 넓어지므로 **§9.2 ⓒ 전제 3을 함께 재검토한다**

**B. 사용자 화면 — 없어서 티가 나는 것**

- [x] **B-1** `not-found.tsx` → T1.12-4
- [x] **B-2** `loading.tsx` — **철회하고 닫는다.** 상세 라우트에 두면 `notFound()`가 200이 되어 소프트 404가 된다(§2.7). 남은 이득은 도감 → 상세 클라이언트 내비게이션 구간뿐이었고 색인·애드센스(§9.1)가 우선이다. **상세 로딩 체감을 다시 다루려면 `loading.tsx`가 아닌 방법이어야 한다 — 이 경로는 막혀 있다**
- [ ] **B-3** `global-error.tsx` — 루트 레이아웃 자체가 터진 경우만 잡아 빈도가 낮고 `<html>`/`<body>`를 직접 렌더해야 해 검증이 번거롭다
- [ ] **B-4** 도감 결과 건수 표시 — `search_cards`가 total을 주지 않는다. count를 따로 받을지 커서 방식을 유지할지 판단 필요
- [ ] **B-5** 도감 정렬 옵션 (지금은 코드순 고정) — 정렬 키를 바꾸면 **커서 튜플도 바꿔야 하는데**(§2.7 "커서 키 ≠ 유니크 키") 007에서 방금 고친 곳이다. 하루에 끼워 넣을 일이 아니다
- [x] **B-6** `CardImage` — `referrerPolicy="no-referrer"` + 폴백 프레임 (2026-08-28 완료) · §9.4 ⓑ · §2.8-6. 단위 **10건** 추가, 빌드 렌더 모드 무변경(`/` `○ 10m` 유지 — 클라이언트 경계가 홈을 동적으로 끌어내리지 않았다)
  - ⚠️ **사양에서 하나 벗어났다 — `iconClassName` prop을 지웠다.** B-6은 「호출부 4곳을 건드리지 않는다 · props는 가산 변경만」이었는데, **새 폴백에 아이콘이 없어져 그 prop의 소비자가 사라졌다**(§2.8-6이 「이미지 없음」 회색 자리표시를 금지했고, 그것이 옛 `ImageOff` 아이콘이었다). **죽은 prop을 남기면 다음 사람이 살아 있는 API로 읽는다**고 판단해 호출부 2곳(`/cards/[cardId]` · `similar-cards`)에서 함께 뗐다. `lint`가 `no-unused-vars`로 먼저 잡아 준 자리다
  - 🚨 **실측하지 않은 것 — 진짜 죽은 URL에 대한 브라우저 동작.** 사양이 「구현자가 프로덕션 빌드로 확인한다」고 요구한 항목이다. **빌드가 통과하는 것은 확인했으나 실제 깨진 이미지로 확인하지 못했다 — 카탈로그가 0행이라 넣을 URL이 없다**(§9.8). 특히 **SSR로 내려간 `<img>`가 하이드레이션 전에 실패하는 경로**는 `ref`에서 `complete && naturalWidth === 0`을 보는 코드로 막아 뒀지만 **그 코드가 실제로 발동하는 것을 본 적이 없다.** → **T1.14가 첫 `image_url`을 넣는 날 이것부터 확인한다**(§9.4 ⓔ 측정 1·2와 같은 자리)
  - **왜 지금인가:** §9.4가 되돌릴 수단으로 걸어 둔 "`image_url`이 없어도 서비스가 동작하는 상태"를 **문서상의 약속에서 상시 코드 경로로 바꾸는 작업이다**(§9.4 ⓓ). **T1.14가 이미지 URL을 넣기 시작하는 순간부터 폴백 발생률이 측정되므로 T1.14와 가까이 두는 것이 이득이다** — 지금은 카탈로그가 0행이라 폴백이 곧 기본 화면이다
  - ★ **2026-08-28에 근거가 셋 더 붙었다.** ⓐ **사용자가 폴백을 「방어 코드」로 규정했다** — 요건이 "한 장이 깨져도 흉하지 않다"에서 **"전부 깨져도 서비스가 성립한다"**로 올라갔다(§9.4 ⓑ) ⓑ **`referrerPolicy` 값이 `no-referrer`로 확정됐다**(§0.1 ⓒ) — 고를 것이 없어졌다 ⓒ **§9.4 ⓔ에 측정 항목이 하나 늘었고**(`no-referrer` 적용/미적용 실패율) **그 측정은 이 컴포넌트가 있어야 가능하다**
  - ⚠️ **미루던 유일한 근거가 소멸했다.** 「T2.1 · T2.2와 한 세션에 몰면 검증이 얕아진다」였는데 **둘 다 2026-08-28에 닫혔다**
  - **표시 항목은 DB 컬럼 단위로 확정됐다 — §9.4 ⓑ의 표를 그대로 따른다.** 요약: `name_ko ?? name_ja`(필수 · `not null`이라 항상 있다) · `code` · `attribute`(nullable · 자유 텍스트). **`effect_text` · 코스트 · 파워는 쓰지 않는다** — 앞은 `CardListItem`에 없고 뒤 둘은 **컬럼 자체가 없다**
  - **대상 파일은 `src/components/features/cards/card-image.tsx` 하나.** 호출부 4곳(홈 쇼케이스 · `card-grid` · `similar-cards` · `/cards/[cardId]`)은 **건드리지 않는다** — T1.11이 네 곳의 중복을 이 컴포넌트로 합쳐 둔 이유가 정확히 이것이다
  - **컴포넌트 계약 — props는 가산 변경만 한다** (기존 호출부가 그대로 컴파일돼야 한다)

    | props | |
    |---|---|
    | `card` | 현재 `Pick<CardListItem, "code" \| "image_url" \| "name_ko" \| "name_ja">`에 **`"attribute"`를 더한다.** 폴백이 속성을 그린다(§2.8-6). `game_id`는 **더하지 않는다** — `CardListItem`에 없고 게임 색을 쓰지 않기로 했다 |
    | `showCode` · `iconClassName` · `hoverClassName` · `priority` | 그대로 둔다. 폴백에서도 `showCode`는 그대로 코드 노출 여부를 가른다 |

  - **폴백 진입 조건은 둘, 화면은 하나다** — ⓐ `card.image_url`이 null ⓑ `<img>`의 `onError`. **두 경우를 같은 컴포넌트로 렌더한다**(§9.4 ⓑ). 분기를 나누면 ⓑ가 드물게만 실행돼 **깨져도 모르는 코드**가 된다
  - **`<img>`에 `referrerPolicy="no-referrer"`를 붙인다.** `next/image`로 바꾸지 않는다 — 근거는 §9.4 ⓓ이고, 이 파일의 기존 doc 주석(`원격 호스팅 방침이 정해지면 next/image 전환은 이 파일만 고치면 된다`)은 **그 전환이 닫혔으므로 함께 고친다**
  - ⚠️ **`onError`를 붙이는 순간 이 파일은 `"use client"`가 된다.** 지금은 서버 컴포넌트이고 호출부 중 **홈 · 상세 · `similar-cards` 셋이 RSC**라 그 셋에 클라이언트 경계가 새로 생긴다. props가 전부 직렬화 가능한 값이라 계약 자체는 성립한다. `CLAUDE.md`의 "RSC 기본, 필요할 때만 `'use client'`"에 대한 예외이므로 **파일 doc에 근거를 남긴다**
  - ⚠️ **SSR로 내려간 `<img>`는 하이드레이션 전에 실패하면 `onError`를 놓칠 수 있다** — 리스너가 붙기 전에 error 이벤트가 끝난다. 마운트 시 `naturalWidth === 0`을 한 번 확인하는 경로가 필요하다. **이 동작은 실측하지 않았다 — 구현자가 프로덕션 빌드로 확인한다.** §2.7의 "dev와 dev 기준 E2E는 통과해서 놓친다" 유형이다
  - **완료 기준:** ⓐ 죽은 URL을 가진 카드가 **도감 · 상세 · 대체 카드 · 홈 네 곳 모두** 프레임으로 보인다 ⓑ 그 화면이 `image_url`이 null인 카드와 **같다** ⓒ 렌더된 `<img>`에 `referrerpolicy="no-referrer"`가 실제로 실려 있다 ⓓ 진입 조건 두 가지를 각각 단언하는 단위 테스트가 있다 ⓔ 속성이 null이거나 매핑에 없어도 프레임이 성립한다

**C. 검색·데이터** — `search_cards` 재작성은 마이그레이션 008 + `db:types` 재생성을 부르는데, 카탈로그가 거의 비어 있어 지금 체감 이득이 0에 가깝다

- [ ] **C-1** `name_en`이 검색에서 빠져 있다 — `search_cards`는 `name_ja`/`name_ko`만 본다
- [ ] **C-2** `effect_text` 검색 — "카드를 뽑는다"로 찾고 싶은 수요가 크고, **키워드 수작업 태깅도 줄여준다**(입력 비용과 직결)

**D. 테스트 공백** — [x] `session.ts` · `responses.ts` 무테스트 → T1.12-5에서 해소

**E. 운영**

- [ ] **E-1** `db:types`가 **로컬 Docker DB**를 가리킨다. 원격에만 적용하고 타입을 뽑으면 스키마와 조용히 어긋난다 — **마이그레이션을 만드는 태스크는 `db:reset` → `db:migrate` → `db:types` 순서를 지킨다**
- [ ] **E-2** **애드센스 잔재 제거 · S** (2026-08-28 신설 · §0.1 ⓒ · §9.1) — `src/components/common/ad-slot.tsx` 삭제 · `NEXT_PUBLIC_ADSENSE_CLIENT`를 `.env.example`과 `src/lib/env.ts`에서 제거 · 호출부가 있으면 함께 정리
  - **왜 이제 할 수 있나:** §0.1 ⓑ가 「수익 모델이 정해진 뒤 한 번에 지운다」고 미뤄 뒀고 **2026-08-28에 "수익화하지 않음"으로 정해졌다**(§9.1). 미룬 근거였던 「T3.6 판단에 따라 비슷한 것을 다시 만들 수 있다」는 **T3.6이 폐기돼 사라졌다**
  - **왜 급하지 않나:** `AdSlot`은 ID가 없으면 `null`을 렌더하고 그 환경변수는 빈 값이라 **동작상 이미 죽어 있다.** 위험이 아니라 **혼선**이 이유다 — 코드가 남아 있으면 다음 사람이 "수익화 계획이 있다"고 읽는다
  - ⚠️ **지우기 전에 §9.1의 되돌릴 조건 셋을 다시 읽는다.** 지우는 것 자체가 그 조건의 마지막 방벽을 **강화**하는 방향이라 문제는 없지만, **되돌릴 조건이 문서에 남아 있어야 나중에 판단이 가능하다** — 코드를 지우면서 §9.1의 서술까지 지우지 않는다
  - **완료 기준:** ⓐ `rg -n "ADSENSE|AdSlot" src/ .env.example`가 0건 ⓑ `lint` · `typecheck` · `test` · `test:e2e` 통과 ⓒ §3.2 트리에서 `ad-slot.tsx` 줄 제거
- [ ] 나머지는 §9 참조 (사이트 URL · Node 22 · E2E 데이터 누적)

### Phase 2 — 핵심 유틸리티

- [x] **T2.1** `src/types/game.ts` + `src/lib/domain/{rules,simulator/*}` — 계약은 §4.7 ⓔ 그대로. **`no-restricted-imports`를 `src/lib/domain/**`에 걸어 §3.3 규칙 2를 `npm run lint`로 옮겼다**(완료 기준 ⓒ). 마이그레이션 0건 · E2E 0건
  - **설계에 없던 결정 셋을 여기 남긴다.** ⓐ **ptcg `maxRedraws`는 `Number.POSITIVE_INFINITY`다** — 실제 룰에 재시도 상한이 없어 유한한 수를 적으면 그것이 근거 없는 룰이 된다 ⓑ **확률은 로그 공간에서 계산한다** — `C(300,60)`이 배정밀도 밖이라 비율로 직접 계산하면 `Infinity/Infinity` → `NaN`이 된다. **§4.7 ⓖ의 큰 입력 케이스가 정확히 이것을 잡는 케이스이고, 작은 값 테스트만으로는 잡히지 않는다** ⓒ **`no-restricted-imports`는 `import type`도 잡는다** — 프로브 파일로 실제 확인했다(타입 전용 import가 빠져나가면 규칙이 반쪽이 된다)
- [x] **T2.2** `src/lib/domain/deck/{validate,stats}.ts` — 계약은 §4.7 ⓕ 그대로. 위반을 모아서 내고, 매수 제한은 `cardKey`로 합산한다. 마이그레이션 0건
  - ⚠️ **테스트 픽스처의 함정 — opcg 덱을 만들 때 메인 슬롯에 `colors`를 주지 않으면 `color_unknown`이 걸린다.** 존·매수만 보려던 케이스가 색상 위반으로 실패하고, 그때 **구현이 틀린 것처럼 보인다.** 이것은 버그가 아니라 §4.7 ⓕ-3(모르면 통과가 아니다)이 의도대로 동작한 것이다. opcg 픽스처 헬퍼는 색을 받게 만든다
- [ ] **T2.3** 마이그레이션 002 — decks / deck_cards + RLS + GRANT
- [ ] **T2.4** 덱 레시피 목록 · 티어표 · 상세
- [ ] **T2.5** 덱 빌더 UI + 첫 손패 드로우 · 멀리건
- [ ] **T2.6** `workers/crawler` 스캐폴딩 (Hono + wrangler)
- [ ] **T2.7** 어댑터 3종 (메르카리 · 라쿠마 · 야후옥션) — ~~착수 전 §9.2 약관 검토 필수~~ → **§9.3 ⓒ에서 2026-08-26 검토 완료.** 결과: **세 곳 다 공식 API 경로 없음. 라쿠마·야후옥션은 `robots.txt`가 검색·낙찰이력을 Disallow.** 착수 전 남은 것은 `faq.fril.jp` 재확인 하나이고, **에이전트 도구로는 2026-08-28에 두 번 다 403이라 사람이 브라우저로 여는 수밖에 없다** (§9.3 ⓒ 말미)
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
- ~~**T3.6** 제휴 링크 캐러셀~~ → **폐기 (2026-08-28 · §0.1 ⓒ · §9.1).** 수익화하지 않기로 정해 **살아 있는 작업 목록에서 뺀다.** 번호는 재사용하지 않는다 — T3.7이 그대로 T3.7이다. **되살리려면 §9.1의 되돌릴 조건 셋을 먼저 통과한다**
- [ ] **T3.7** E2E 시나리오 확장 + GitHub Actions CI

### 다음 작업 (2026-08-28 기준)

> **08-27에는 세션이 없었다.** 직전 세션은 08-26(§0.1 ⓐ 공식 창구 조사)이고, 그 산출물(`docs/crawler-compliance.md` §10 · plan.md 개정)은 **08-28 시작 시점까지 커밋 전이었다.** 이력은 git에 있으므로 여기서 되풀이하지 않는다 — **이 절은 "지금부터 무엇을 하는가"만 담는다.**

**일감 분류 — 누가 하는가로 가른다.** 세부 근거는 각 항목이 가리키는 절에 있다.

| 구분 | 항목 |
|------|------|
| **에이전트가 오늘 끝낸 것** | ① **plan.md 구조 정리** — §0.1 ⓐ를 닫힌 절로 압축(가설 본문 + 판정의 이중 구조 제거), §9.3 제목 · §8 헤딩 등 미갱신 지점 정정 ② **문의 메일 초안 수정** — §9.11 ⓕ의 1·2 반영, 3은 두 안을 남겨 사용자에게 넘김 ③ **`faq.fril.jp` 403 재시도** — 두 경로 모두 실패, 결과를 `docs/crawler-compliance.md` §10.5 ⓒ · §10.7에 기록 ④ **T2.1 · T2.2 설계 확정 — §4.7 신설** ⑤ **T2.1 · T2.2 구현 — TDD로 닫았다** ⑥ **사용자 결정 3건 문서 반영 — §0.1 ⓒ 신설**(문의 폐기 · 수익화 포기 · `no-referrer` 확정). 개정 절: §0 결정표 · §0.1 ⓑ · §2.8-6 · §3.2 · §4.4.1(결정 5·6 · 🚨 · ⓓ) · §8 · §9.1 · §9.4 ⓑⓒⓔ · §9.11 ⓖ + `docs/crawler-compliance.md` §0·§6.1·§7.1·§10.3 ⓓ + `docs/permission-inquiry-drafts.md` 머리말. **코드 무변경** |
| **T2.1 · T2.2 실측** | 도메인 단위 **56건 추가**(`rules` 3 · `shuffle` 6 · `draw` 13 · `probability` 11 · `validate` 16 · `stats` 7). **전체 97 → 153건**, `lint` · `typecheck` ✅. **마이그레이션 0건 · 화면 0개 · E2E 0건** — 순수 함수라 `test`로 끝났다. 설계에 없던 결정 셋과 픽스처 함정 하나는 로드맵 T2.1 · T2.2 항목에 남겼다 |
| **사용자가 직접 해야 하는 것** | 아래 「사용자 일감」 표 |
| **다음 세션 1순위 (에이전트)** | ★ **B-6** — 오늘 미루기로 했다가 **§0.1 ⓒ로 판정이 뒤집혔다.** 근거는 아래 표의 B-6 행. 그다음이 **E-2**(저비용 · 독립) |
| **오늘 미루는 것** | **T2.6 · T2.7** · **A-5 · B-4 · B-5** · **C-1 · C-2** — 아래 「미루는 것」 |

> **오늘은 코드가 바뀌었다 — 08-25 이후 처음이다.** 추가: `src/types/game.ts` · `src/lib/domain/**`(구현 6 + 테스트 6) · `eslint.config.mjs`(도메인 import 차단). **`supabase/` · `scripts/` 무변경**이고 기존 `src/`도 건드리지 않았다 — 도메인은 아무도 아직 import 하지 않는다(호출부는 T2.4 · T2.5). 문서는 **`.claude/plan.md` · `docs/crawler-compliance.md` · `docs/permission-inquiry-drafts.md`** 셋이 바뀌었다.
>
> ⚠️ **아직 커밋하지 않았다.** 08-26 문서 작업 · 08-28 문서 정리 · T2.1 · T2.2가 한 트리에 섞여 있다. **운영 메모의 커밋 순서 규칙이 말한 "압축 전 상태를 먼저 커밋"은 이번 건에는 이미 쓸 수 없다** — 08-28 세션이 워킹 트리에서 직접 고쳐 압축 전 `plan.md`가 남아 있지 않다. **실질 손실은 없다**(결과 전문이 `docs/crawler-compliance.md` §10에 있다). 지금 나눌 수 있는 축은 **파일과 주제**뿐이다: ①문서(`plan.md` · `crawler-compliance.md` · `permission-inquiry-drafts.md`) ②T2.1 ③T2.2. **규칙은 다음 번을 위해 남는다.**

**에이전트 후보를 어떻게 갈랐나 — 판정과 근거.** 후보를 "할 수 있는가"가 아니라 **"오늘 하지 않으면 무엇이 나빠지는가"**로 갈랐다.

| 후보 | 판정 | 근거 |
|------|------|------|
| **문의 메일 초안 수정** | ✅ **오늘** | 08-26에 "본문 수정은 이번 범위 밖"이라고 미룬 것은 **그날의 범위를 말한 것이지 미룰 근거가 아니었다.** 반대로 미룰 때의 위험이 분명하다 — **발송은 되돌릴 수 없는데** 초안에 폐기된 방침(광고 게재)을 사실처럼 묻는 문단이 남아 있었다. **실현되면 이미 늦는 유형**이라 T1.13 · T1.15를 앞으로 당긴 것과 같다. 고칠 항목이 §9.11 ⓕ에 이미 특정돼 있어 **새 판단이 필요 없는 부분(1·2)만** 했고, **대외 커뮤니케이션 어조인 3번은 손대지 않았다** |
| **`faq.fril.jp` 403 재시도** | ✅ **오늘 (그리고 결과가 판단을 바꿨다)** | "T2.6 착수 전에 다시 연다"는 트리거의 근거는 **"T2.6 전에 알면 된다"**였지 **"지금 하면 비싸다"**가 아니었다. 실제 비용은 WebFetch 2회다. **결과: 서로 다른 두 경로가 모두 403** → 경로 제한이 아니라 **호스트·도구 단위 차단으로 보인다(추정).** 그래서 **이 공백은 "에이전트가 나중에 다시 연다"에서 "사람이 브라우저로 여는 수밖에 없다"로 성격이 바뀌었고, 사용자 일감으로 옮겼다.** ⚠️ **검색 요약에 금지행위 목록이 일부 보였으나 원문 미확인이라 인용하지 않았다** — §10.7의 야후옥션 「クローラー」와 같은 규칙 |
| **T2.1 · T2.2 (시뮬레이터 · 덱 검증)** | ✅ **오늘 착수 — 설계와 구현을 같은 날 닫았다** | §9.11 ⓔ가 **"어떤 회신이 와도 버려지지 않는 유일한 작업"**이라 못박았고, §9.11 ⓓ-2 갈래에서도 그대로 쓰인다. **T1.14와 자원이 겹치지 않는다** — T1.14는 사용자 손, 이쪽은 에이전트. 카탈로그 0행이 제약이 아니다(순수 함수). **설계(§4.7)를 먼저 확정하고 그 계약을 그대로 구현했다.** ⚠️ **설계와 구현이 같은 날 같은 손에서 나오면 계약이 구현에 맞춰 조용히 휘어질 수 있다** — 그래서 §4.7을 먼저 쓰고 고정한 뒤 테스트를 작성했고, 실제로 어긋난 것은 **구현이 아니라 테스트 픽스처 하나**였다(로드맵 T2.2의 ⚠️) |
| **§9.3 ⓓ 약관 재확인** | ⏸ **오늘 아님 — 사용자의 T1.14 첫 단계로 옮긴다** | §9.3 ⓓ가 요구한 시점은 **"새 입력 배치를 시작하기 전"**이다. 오늘 확인하고 며칠 뒤 입력을 시작하면 **다시 해야 하므로 오늘 하는 것은 값이 없다.** 게다가 `onepiece-cardgame.kr` 푸터는 08-26(§10.3)에 확인돼 이틀밖에 지나지 않았다. **→ T1.14 착수 당일의 첫 단계로 못박는다** |
| **B-6 (`CardImage` 폴백 프레임)** | ~~⏸ 오늘 아님. 단 조건부다~~ → ★ **판정 뒤집힘 → ✅ 같은 날 구현까지 끝냈다 (2026-08-28 · §0.1 ⓒ)** | **미루는 근거가 순서 하나뿐이었고 그것이 소멸했다.** 원문은 「T2.1 · T2.2가 §9.11 ⓔ의 보증을 받는 데 반해 B-6은 그렇지 않고, 한 세션에 셋을 몰아 주면 검증이 얕아진다」였는데 **T2.1 · T2.2가 같은 날 닫혔다.** 걸어 둔 조건(「사용자가 T1.14를 먼저 시작하면 앞선다」)도 **T2.1보다 앞서는 것이 이제 자동으로 성립한다.**<br>**그리고 근거가 셋 더 붙었다.** ⓐ **사용자가 폴백을 「방어 코드」로 규정** — 요건이 "미관"에서 **"이미지가 전부 없어도 서비스가 성립한다"**로 올라갔다(§9.4 ⓑ). **성격이 백로그 항목에서 서비스 요건으로 바뀌었다** ⓑ **§9.4 ⓔ에 측정 항목이 늘었다**(`no-referrer` 적용/미적용 실패율) — **그 측정은 이 컴포넌트가 있어야만 가능하다** ⓒ **T1.14가 URL을 넣기 시작한 뒤에 구현하면 측정이 오염된다** — 폴백이 없는 동안 죽은 링크는 엑박으로 나오고, 그 구간의 발생률은 세지 못한다.<br>⚠️ **여전히 "차단을 우회한다"는 태스크가 아니다.** `no-referrer`는 값이 확정된 것이지 효과가 확인된 것이 아니다(§9.4 ⓒ).<br>**결과 — 단위 10건 · 빌드 렌더 모드 무변경. 사양 이탈 1건(`iconClassName` prop 제거)과 실측하지 못한 것 1건(진짜 죽은 URL에 대한 브라우저 동작)은 백로그 B-6에 적었다.** |
| **머지된 브랜치 `refactor/t1-11-cleanup` 정리** | ⏸ **사용자 몫** | 오늘 세션의 제약이 **"커밋하지 않는다"**였고 원격 브랜치 삭제는 그 경계 밖이다. 저비용이므로 다음 브랜치를 만들 때 함께 지운다(운영 메모) |

**사용자 일감 — 우선순위 순. 2026-08-28에 두 건이 없어져 다시 매겼다.**

> **없어진 것 — 옛 5번(문의 메일 발송) · 옛 6번(수익 모델 결정).** 둘 다 **사용자가 §0.1 ⓒ로 직접 결정해 닫았다.** ⚠️ **"해결됐다"가 아니라 "결정으로 닫혔다"다** — 특히 옛 5번이 답하려던 질문(§4.4.1의 근거 공백)은 **답 없이 닫혔다**(§4.4.1 ⓓ · §9.11 ⓖ). 목록에서 사라진 것과 문제가 사라진 것을 섞지 않는다.

| # | 항목 | 왜 사용자인가 · 왜 이 순서인가 |
|---|------|------------------------------|
| 1 | **`ADMIN_TOKEN`을 43자 난수로 교체** (§9.2 ⓐ의 명령 그대로) | **자격증명.** **데이터가 들어가기 전에** 끝내야 하고 지금이 마지막 기회다 — 실데이터가 들어간 뒤에는 잃을 것이 생긴다 |
| 2 | **`npm run db:dump` 1회** | **원격 DB 접근.** 0행 상태의 기준점을 남긴다. ⚠️ `db:clean`을 돌릴 일이 생기면 **그 직전에도 반드시 1회**(§9.9 — 드라이런이 없다) |
| 3 | **§9.3 ⓓ 재확인 1회** — `onepiece-cardgame.kr`의 URL을 다시 열어 인용문과 대조 | **T1.14 착수 당일의 첫 단계다.** 약관은 바뀌고, **새로 게시되면 §4.4.1의 되돌릴 조건 1번에 걸린다.** ★ **2026-08-28 이후 비중이 올랐다 — 문의를 폐기해 이것이 "새 재료가 들어오는 유일한 경로"가 됐다**(§4.4.1 ⓓ) |
| 4 | **T1.14 손입력 (ST-01 · ST-02 34종)** | **사람이 보고 옮겨 적는 것** — §9.3 ⓑ대로 이것이 ①축(접근)을 피하는 유일한 경로다. 목표는 카탈로그가 아니라 **측정 기록을 채우는 것**. ⚠️ **측정 항목이 하나 늘었다**(§9.4 ⓔ의 `no-referrer` 적용/미적용 실패율) — **B-6이 먼저 들어가 있어야 셀 수 있다** |
| 5 | **`faq.fril.jp` 「ラクマのルール」를 브라우저로 열어 본다** | 에이전트 도구로는 두 번 막혔다(위 표). **T2.6 전이면 되므로 급하지 않다.** 열리면 금지행위 목록을 §10.5에 원문으로 옮긴다 |
| 6 | **머지된 브랜치 `refactor/t1-11-cleanup` 삭제** | 저비용. 다음 브랜치를 만들 때 함께 |

> **B-6은 이 표에 들어가지 않는다 — 에이전트 일감이다**(다음 세션 1순위). 다만 **4번과 순서가 얽힌다: B-6이 T1.14보다 먼저 들어가야 §9.4 ⓔ의 측정 셋이 온전히 채워진다.** 사용자가 T1.14를 먼저 시작해도 입력 자체는 막히지 않지만, **그 구간의 폴백 발생률과 `no-referrer` 비교는 세지 못한다.**

**T1.14의 위험은 두 가지로 줄었다.** 오타는 T1.15가, 소실은 T1.13이 받는다. 남은 것은 **입력 확인을 `/cards`가 아니라 `/admin/cards`에서 한다**는 것(TanStack Query `staleTime` 5분 — T1.14 블록의 주의)과 **측정 기록을 실제로 채우는 것**이다.

> **T1.14는 08-25 · 08-26 두 번 다음 순번이었고 두 번 다 착수되지 않았다.** 08-25는 발행 직후 가시성 추적에 반나절이 들어갔고(T1.12-7 — 얻은 것은 §2.7의 함정 3개와 P1 개정), 08-26은 §0.1 ⓐ 조사가 하루를 썼다. **둘 다 "지금이 가장 싼 시점"이라는 근거가 있었지만, 같은 근거가 세 번째로 나오면 그때는 미루는 이유가 아니라 미루는 습관이다.** ⚠️ 이 태스크는 **에이전트가 대신할 수 없다** — 아무도 대신 시작해 주지 않는다.

**왜 도구(A-5 CSV)가 아니라 손입력이 먼저인가.** A-5는 중복 처리 · 부분 실패 · 드라이런 · 게임/세트 매핑을 먼저 설계해야 하는 L짜리다. **카드를 한 장도 넣어 보지 않은 상태**에서 그 설계를 하면 전부 추측이 되고, 잘못 만든 임포터는 카탈로그를 덮어쓴다 — §4.4가 시드 스크립트를 삭제한 것과 같은 위험이다. 반대로 손입력 반나절은 그 설계의 입력값을 만든다. **34장을 넣어 보고도 견딜 만하면 A-5는 아예 필요 없을 수도 있다.**

**A-5 · B-4 · B-5의 순위는 T1.14의 측정값이 정한다.** 지금 고르면 추측이다.

| 손입력에서 이런 일이 나오면 | 다음은 이것 |
|---|---|
| ~~세트명 · 키워드 오타를 고칠 화면이 없어 막힌다~~ | **해소됨 — T1.15.** 이 분기는 실현되면 이미 늦어서 앞으로 당겼다. 이제 입력 도중에 고칠 수 있다 |
| 장당 입력이 견디기 어렵고 열이 반복적이다 | **A-5** 설계 태스크(번호는 그때 딴다). T1.13이 전제이고, upsert를 하게 되면 §9.2 ⓒ 전제 3을 다시 판단한다 |
| 30장 넘게 쌓이자 도감의 총 건수 · 정렬 부재가 걸린다 | **B-4 · B-5**. 단 B-5는 커서 튜플을 다시 건드린다(§2.7) |

**미루는 것 — 근거를 붙여 남긴다.**

- **C-1 · C-2 검색 확장** — 마이그레이션 008 + `db:types` 재생성 사이클(백로그 E)을 부른다. 이득이 **카드 수에 비례**하는데 34장 수준에서는 `ilike` 하나로 다 찾힌다. 수백 장이 되는 시점에 재평가한다
- **Phase 2의 나머지(T2.3~T2.12)** — "카드가 없으니 코드나 짜자"는 유혹이 가장 센 자리지만 **그쪽이 데이터에 더 굶주려 있다.** T2.4·T2.5는 카드가 있어야 화면이 성립하고, 검색 키인 `name_ja`를 가진 카드가 0장이면 T2.7의 조회 대상 자체가 없다.
  - **T2.7의 선행이던 §9.3 ⓒ는 2026-08-26에 닫혔다 — 그런데 그것이 T2.7을 당기는 근거가 되지 않는다.** 검토 결과가 **"공식 경로 없음 + `robots.txt`가 우리 용도를 지목해 Disallow"**였기 때문이다. **막힌 문을 확인한 것이지 문이 열린 것이 아니다.** T2.7은 여전히 미룬다
  - **T2.1 · T2.2는 예외였고, 2026-08-28에 착수했다.** 순수 함수라 DB도 데이터도 필요 없다는 것에 더해 **§9.11 ⓔ가 근거를 하나 더 줬다 — 문의 회신이 어느 쪽으로 오든 버려지지 않는 유일한 작업이다.** 카드 DB를 호스팅하지 않는 갈래(§9.11 ⓓ-2)에서도 그대로 쓰인다. **"손입력이 견디기 어려울 때의 피신처"가 아니라 "회신을 기다리는 동안 하는 작업"이고, T1.14와 경쟁하지 않는다** — T1.14는 사용자 손, 이쪽은 에이전트. **설계는 §4.7에 확정했고 구현도 같은 날 끝났다**(도메인 56건 · 전체 153건). ⚠️ **"회신을 기다리는 동안"이라는 표현은 같은 날 무효가 됐다**(§0.1 ⓒ) — **그러나 판단은 옳았던 것으로 남는다.** 회신 대기가 아니라 **"어떤 갈래에서도 버려지지 않는다"**가 진짜 근거였고, 그 성질은 회신 폐기와 무관하다(§9.11 ⓔ · ⓖ)
  - ⚠️ **T2.3(`deck_cards` 마이그레이션)을 T2.2에 딸려 오게 하지 않는다.** §4.7은 도메인이 DB를 모르게 설계돼 있어 **T2.2는 마이그레이션 0건으로 끝난다.** T2.3을 같이 열면 §4.7 ⓗ의 미결 4건(성능 컬럼)이 함께 딸려 오고, 그 판단의 재료는 **T1.14의 측정 기록**이라 아직 없다
- **§9.1 수익 모델 — 미루는 항목이 아니라 닫힌 항목이다.** 애드센스는 §0.1 ⓑ로, **수익화 자체는 §0.1 ⓒ로 닫혔다.** 이 자리에 남는 미결은 **없다.** 부수 효과 셋: **기사 발행은 심사 요건에서 풀려 순수한 콘텐츠 작업이 되었으므로 우선순위가 내려간다** · 도메인 교체(옛 ②)만 **SEO 근거로** 남는다(`sitemap.xml`·OG·정규 URL이 `NEXT_PUBLIC_SITE_URL`을 쓴다) · **코드 잔재 제거가 백로그 E-2로 세워졌다**
- **문의 메일 — 미루는 항목이 아니라 폐기된 항목이다(§0.1 ⓒ).** ⚠️ **그러나 §9.11 전체가 없어진 것은 아니다** — ⓑ · ⓓ · ⓔ가 남고, 무엇이 남았는지는 §9.11 ⓖ에 갈라 적었다. **"닫힌 절"로 읽지 않는다**

**운영 메모**

- `.claude/agents/*.md`의 `model` 값을 고쳐도 **실행 중인 세션은 시작 시점의 정의를 캐시한다.** 바꾼 값은 새 세션부터 적용된다
- **머지된 브랜치는 지운다.** `feat/t1-12-admin-ops`는 로컬·원격 모두 정리했다. **`refactor/t1-11-cleanup`이 같은 성격으로 남아 있다** — 다음에 브랜치를 만들 때 함께 지운다
- ⚠️ **커밋 전 문서를 압축하면 원문이 어디에도 남지 않는다 (2026-08-28에 실제로 그럴 뻔했다).** 08-26의 §0.1 ⓐ 작업은 커밋되지 않은 상태였고, 08-28 세션이 그 위에서 같은 절을 압축했다. **그대로 한 번에 커밋하면 압축 전 원문은 git 이력에 없다.** 되돌릴 근거가 필요한 종류의 글이면 **압축 전 상태를 먼저 커밋하고 압축을 두 번째 커밋으로 올린다.** 이번 건은 **결과 전문이 `docs/crawler-compliance.md` §10에 따로 있어 실질 손실이 없다** — 그래서 사고가 아니라 규칙으로 남긴다

---

## 9. 미해결 — 결정이 필요한 사항

1. **수익 모델 — 결정 완료 (2026-08-28). 미해결이 아니다.** 두 번에 걸쳐 닫혔다: 애드센스 폐기(2026-08-26 · §0.1 ⓑ) → **수익화 자체를 하지 않음**(2026-08-28 · §0.1 ⓒ). 아래는 **애드센스 폐기분**(원문 유지)이고, **수익화 포기분은 그 뒤의 ★ 항목**에 있다.

   **없어진 것 — 준비물 ①~④.** ①기사 5~10편 발행 ②`NEXT_PUBLIC_SITE_URL` 도메인 교체 ③`ads.txt` 배치와 퍼블리셔 ID ④EEA용 인증 CMP. 넷 다 **애드센스 쪽 요건**이라 애드센스와 함께 사라진다. 단 **②는 SEO 근거로 살아남는다**(`sitemap.xml` · OG · 정규 URL이 전부 이 값을 쓴다), ①은 **순수한 콘텐츠 작업으로 성격이 바뀌어 우선순위가 내려간다**, ④는 **분석 도구를 붙이는 시점에 다시 본다**(광고와 별개로 동의 요건이 생길 수 있다), ③은 불필요.

   **없어지지 않고 옮겨간 것 — ⑤ 권리자 회신.** 이것만 성격이 달랐다. 문제는 애초에 애드센스가 아니라 **"약관이 재사용을 허락하지 않은 데이터를 우리가 싣고 있다"**는 것이었고, **그건 광고를 떼도 남는다.** ⑤는 §0.1 ⓐ(공식 창구 조사)와 §9.11(회신별 갈래)로 이관됐다. → ⚠️ **2026-08-28: 그 두 경로가 모두 닫혔다** — ⓐ는 열린 창구 0곳으로 끝났고, 문의는 보내지 않기로 했다(§0.1 ⓒ). **⑤가 가리키던 문제는 그대로 남고 해결 경로만 없어졌다**(§4.4.1의 🚨 2026-08-28 추가분).

   **순서 사슬 — 2026-08-28에 아래쪽 가지가 잘렸다.**

   ```
   §0.1 ⓐ 조사 [완료 08-26] ─┬─→ T1.14 손입력 ──→ 배포 (수익화 없음 · 영구)
                             └─→ ~~문의 메일 ──→ 회신 ──→ §9.11~~  [폐기 08-28 · §0.1 ⓒ]
   ```

   **→ 사슬에 분기가 없어졌다. 남은 것은 한 줄이고, 그 줄 어디에도 "근거가 확정되는 지점"이 없다.** 이 사실을 사슬 그림으로 보이려고 잘린 가지를 지우지 않고 남긴다.

   **§2.7 데이터 캐시가 심사에 미치는 영향은 논점 자체가 사라졌다.** 색인 쪽 결론은 그대로 유효하다 — `/news/[slug]`·`/cards/[cardId]`는 T1.12-7 뒤 **동적이라 항상 최신**이고, 지연이 남는 곳은 `sitemap.xml`(3600) 하나이며 **알고 남긴 것**이다. **조치 없음.** 재평가는 Search Console에서 실제 지연이 관측되면 한다.

   **~~★ 진짜 미해결 — 운영비를 무엇으로 대는가.~~ → ★ 결정됨 (2026-08-28): 수익화하지 않는다.** 후보는 **T3.6(제휴 링크) · 후원 · 유료 기능 · 수익화하지 않음** 넷이었고 **사용자가 넷째를 골랐다.** 「완전 팬 사이트」로 간다. 운영비는 자비 부담이며, **이 항목은 미해결에서 결정으로 옮긴다.**

   **없어진 것 — T3.6과 그 딸린 것들.** 로드맵 Phase 3에서 **T3.6(제휴 링크 캐러셀)을 뺐고**, §3.2 트리의 `affiliate-carousel.tsx`도 지웠다. **폐기 사실과 근거는 여기 남기고 살아 있는 작업 목록에서만 뺀다** — 되살리려면 아래 되돌릴 조건을 통과해야 하므로 근거가 없으면 판단할 수 없다. 함께 없어진 것: **§8 사용자 일감 6번(수익 모델 결정)** · **§9.11 「조건부 허락(비영리 한정)」 갈래의 T3.6 판단**(→ §9.11 ⓖ).

   **남은 것 — 코드.** `AdSlot`(`src/components/common/ad-slot.tsx`)과 `NEXT_PUBLIC_ADSENSE_CLIENT`는 아직 저장소에 있다. **동작상으로는 이미 죽어 있다**(ID가 없으면 `null` 렌더 · `.env.example`에 빈 값). §0.1 ⓑ가 「수익 모델이 정해진 뒤 한 번에 지운다」고 미뤄 뒀고 **이제 정해졌으므로 백로그 E-2로 세웠다.** ⚠️ **이 세션에서는 코드를 건드리지 않았다** — 문서만 고쳤다.

   **★★ 이것이 §9.3의 ④축에 실제로 미치는 영향 — 사이트별로 갈린다. 뭉뚱그리면 틀린다.**

   지금까지 문서는 **「T3.6이 남아 있으니 "비영리"라고 쓰지 않는다」**를 §0.1 ⓑ · §9.11 ⓕ-1 · 초안 「공통 원칙」에서 반복해 왔다. **그 제약이 풀린다.** 광고도 제휴도 없으면 **④축에 걸릴 미래 시제가 사라진다.** 다만 **얼마나 풀리는지는 §9.3 ⓐ·ⓒ의 판정표가 ④축에 실제로 무엇을 적었는가로만 판정한다.**

   | 사이트 | ④축 판정과 그 조건 (§9.3) | 수익화 포기로 바뀌는가 |
   |--------|---------------------------|------------------------|
   | **`onepiece-cardgame.kr`** (현 유일 원천) | **근거 없음** — 약관 문서 자체를 찾지 못했다 | **아무것도 바뀌지 않는다.** 조건을 건 조항이 없으므로 조건을 없애도 움직일 것이 없다. ★ **이 결정이 현 원천에 대해서는 실익이 0이라는 뜻이다** |
   | `pokemoncard.co.kr` (보류) | **중간** — 「**영리목적**으로 이용하거나」 · 「**상업적으로 이용하는 행위**」 | **바뀐다 — 여기 하나뿐이다.** 조건이 영리성이므로 우리 상태가 그 문언에 닿지 않게 된다(§4.4.1 말미). ⚠️ 단 **②(중간, "회원" 문제) · ③(높음, 「무단 복제」 + 워터마크)는 그대로** |
   | `onepiece-cardgame.com` (배제) | **높음** — 「**私的使用**その他…を超えて」 | **바뀌지 않는다.** 기준선이 영리성이 아니라 **사용 목적**이다. 공개 서비스는 광고가 없어도 「私的使用」이 아니다 |
   | `pokemon-card.com` (배제) | **높음** — 「**個人的に楽しむ場合に限って**」 + 「公衆ネットワーク上で利用することはできません」 | **바뀌지 않는다.** 뒤 문장이 **공개 배포라는 결과 상태**를 직접 막는다 |
   | 야후옥션 (T2.7) | **중간** (공통규약 제15조(11)) | 문언상 완화 방향이나 **판정을 바꿀 만큼이 아니다** — 이 대상의 무게중심은 ①(`robots.txt`가 `/closedsearch/`를 통째로 Disallow, **높음**)이다 |
   | 메르카리 · 라쿠마 (T2.7) | **근거 없음** | 바뀌지 않는다 |

   **→ 정리: ④축은 6곳 중 1곳(포켓몬코리아)에서만 실제로 움직이고, 그곳은 지금 원천이 아니다.** 현 유일 원천에서는 **0**이다.

   > **⚠️⚠️ 가장 중요 — "팬 사이트니까 괜찮다"로 미끄러지지 않는다. `docs/crawler-compliance.md`가 정확히 반대를 실측했다.**
   >
   > **1) ②축(데이터 재사용) 금지 조항은 영리성을 조건으로 달지 않는다.** §6.1의 판정표가 네 곳의 문구를 나란히 놓고 「방법을 조건으로 다는가」를 물었고 **전부 "아니다"였다.** 같은 표가 영리성에 대해서도 성립한다 — 「すべての画像・テキスト・データの**無断転用、転載**をお断りします」 · 「**복제, 송신, 출판, 배포, 방송 기타 방법에 의하여**」 · 「他のインターネットなどの公衆ネットワーク上で**利用することはできません**」 어디에도 "영리일 때만"이 없다.
   >
   > **2) 토에이 애니메이션은 비영리를 명시적으로 배제했다** (`docs/crawler-compliance.md` §10.3 ⓑ).
   >
   > > 「**非営利であっても**画像の使用許可や素材の提供は行っておりません。また、非営利にあたるかについて、お問い合わせをいただきましても、お答えはいたしかねます。」
   >
   > **3) 그 토에이가 `onepiece-cardgame.kr` 푸터의 저작권 표기 주체다**(§10.3 ⓒ · §4.4.1 ⓒ).
   >
   > **→ 비영리가 되어도 ②축과 ③축은 그대로 남는다.** 이 결정이 낮추는 것은 ④축 하나이고 그마저 현 원천에서는 0이다. **어떤 문서·화면·커밋 메시지에도 「팬 사이트라서 허용된다」는 취지를 쓰지 않는다** — 근거가 없다. 쓸 수 있는 것은 **사실**뿐이다: 「광고를 게재하지 않는다」 · 「제휴 링크를 두지 않는다」. **이 검토는 법률 자문이 아니다.**

   > **"비영리"라는 단어는 이제 써도 되는가 — 조심스럽게 그렇다. 단 용도가 다르다.** §0.1 ⓑ가 그 단어를 막은 이유는 **"나중에 T3.6을 붙이면 그 말이 우리를 묶는다"**는 것이었고 **그 이유는 사라졌다.** 그러나 **"비영리"를 우리 행위의 *정당화*로 쓰는 것은 여전히 금지다** — 위 ⚠️⚠️의 셋이 그 자리를 막는다. **사실 서술로는 쓸 수 있고, 근거로는 쓸 수 없다.**

   **되돌릴 조건 — 셋 다 성립해야 한다.** ①§0.1 ⓐ의 ⑤축(공식 창구)이 채워져 있을 것 ②그 시점 원천 사이트들의 ④축이 **"허용" 또는 "해당 없음"**일 것 ③**②축이 그때도 남아 있는지를 먼저 판정할 것** — ④를 풀어도 ②가 남으면 영리 요소를 붙이는 것은 위험을 **더하는** 쪽이다(위 ⚠️⚠️). **셋을 확인하지 않은 채 `NEXT_PUBLIC_ADSENSE_CLIENT`에 값을 넣지 않는다** — 값이 들어가는 순간 §3.2의 `AdSlot`이 광고를 렌더한다. **E-2가 그 코드를 지우면 이 방벽은 "환경변수를 비워 두기"에서 "코드가 없다"로 강해진다.**

2. **관리자 토큰 — 결정 완료 (2026-08-25).** 손입력 데이터가 들어가기 전에 정해야 했던 항목이다. 결론은 **T3.1까지 토큰 방식을 유지하되 전제 3가지를 붙인다**이며, 아래 ⓐⓑⓒ가 그 내용이다.

   **ⓐ `ADMIN_TOKEN` 규격 · 보관 · 회전**

   값은 **256비트 난수를 base64url로 인코딩한 43자**로 둔다. 생성은 명령 하나로 끝난다 — 프로젝트가 이미 Node를 요구하므로 새 도구가 붙지 않는다.

   ```
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   base64url을 고른 이유는 `+ / =`가 나오지 않아 `.env` 인용과 URL 인코딩에서 사고가 없기 때문이다. PowerShell만 쓸 수 있는 환경이면 아래를 쓴다. **`Get-Random`은 암호학적 난수원이 아니므로 토큰 생성에 쓰지 않는다.**

   ```
   $b=[byte[]]::new(32); [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```

   **`session.ts`의 16자 하한은 그대로 둔다.** 그 하한의 역할은 `ADMIN_TOKEN=changeme` 같은 **설정 실수를 부팅 시 잡는 것**이지 강도를 보장하는 것이 아니다(`a`×32도 통과한다). 하한을 32로 올리면 `session.test.ts`의 16자 경계값 케이스를 함께 고쳐야 하는데 **그렇게 얻는 방어력은 0**이다 — 강도는 하한이 아니라 위 생성 명령이 만든다.

   보관은 **로컬 `.env.local`과 배포 플랫폼의 환경변수 UI 두 곳뿐이고, 두 값은 서로 다르게 둔다.** 값을 나누는 비용은 0인데 유출 시 어느 쪽이 샜는지 좁혀지고, 터미널 히스토리 · 스크린샷처럼 새기 쉬운 쪽이 프로덕션이 아니게 된다. **비밀 관리자(1Password 등)는 도입하지 않는다** — 시크릿이 3종(`SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_DB_PASSWORD` · `ADMIN_TOKEN`)이고 보관처가 2곳인데다, `ADMIN_TOKEN`은 **우리가 만드는 값이라 잃어버리면 새로 만들면 된다.** 백업할 가치가 없는 시크릿에 관리 도구를 붙이면 표면만 는다.

   **회전 절차**: 새 값 생성 → 배포 환경변수 교체 → `.env.local` 교체 → dev 서버 재시작. **기존 세션은 자동으로 죽는다**(§4.5의 "회전 = 즉시 무효화"). 회전 시점은 ① **지금 1회**(손입력 착수 전) ② 유출 의심 시 즉시 ③ T3.1에서 폐기. **정기 회전은 두지 않는다** — 단독 개발이고, 회전 자체가 "로컬만 바꾸고 배포를 잊는" 실수의 유입 경로다.

   **ⓑ 되돌릴 수단 — 로컬 덤프(`npm run db:dump`, T1.13). Supabase 자동 백업에 의존하지 않는다.**

   | 안 | 실제로 보장되는 것 | 판단 |
   |----|--------------------|------|
   | Supabase 자동 백업 | **무료 플랜에는 자동 백업이 없다.** 공식 문서가 무료 플랜 프로젝트에 `supabase db dump`로 직접 내보내 오프사이트 백업을 유지하라고 안내한다. 일간 백업은 Pro(7일)부터이고 PITR은 그 위의 유료 애드온이다 | **기각** — 지금 없는 것에 기댈 수 없다 |
   | 로컬 덤프 스크립트 | 원격 데이터를 개발자 머신의 파일로 받는다. 기존 `db:*` 계열과 같은 자리 | **채택** |

   > **플랜은 저장소에서 확인할 수 없어 무료 플랜을 가정한다.** Pro 이상이면 일간 백업 7일이 덧붙지만, 그것도 **프로젝트 전체를 한 시점으로 되돌리는 큰 망치**라 카드 몇 장을 되살리는 용도로는 여전히 로컬 덤프가 낫다. 근거: <https://supabase.com/docs/guides/platform/backups> · <https://supabase.com/docs/reference/cli/supabase-db-dump>

   **관리자 전용 "내보내기 API"는 만들지 않는다.** §5.1의 금지 엔드포인트에 `GET /api/cards/export`가 있고 §5.4가 CSV 내보내기 미제공을 되팔이 방지의 한 층으로 세워 두었다. 내보내기를 API로 만들면 **토큰 1개가 카탈로그 전량 반출 권한까지 갖게 되어 ⓐ가 지키려는 것을 스스로 깎는다.** 덤프는 **로컬 스크립트**여야 한다 — service_role 키를 가진 개발자 머신에서만 돌고 네트워크 표면이 늘지 않는다.

   **ⓒ 토큰 방식 유지 (T3.1까지).** 조기 이전을 기각한 근거는 하나다 — **위험의 소재가 인증 방식이 아니라 복구 불가능성이었다.** 토큰을 계정으로 바꿔도 관리자 본인이 실수로 지운 카드는 그대로 사라진다. 반대로 ⓑ가 있으면 토큰이 새어 카탈로그가 지워져도 되돌아온다. 즉 **같은 돈으로 살 수 있는 안전이 ⓑ 쪽이 훨씬 크다.**

   조기 이전은 규모도 맞지 않는다. T3.1을 앞당기면 OAuth 프로바이더 등록 · `profiles` 마이그레이션 · `proxy.ts` 세션 갱신 · 관리자 클레임 RLS까지 Phase 3 한 덩어리가 통째로 앞으로 온다. 관리자가 1명인 지금 그 값으로 줄어드는 위험은 "토큰 유출" 하나인데, 그 토큰은 이제 43자 난수 + 12시간 httpOnly 쿠키다. 한편 **"임시 인증이라 검증도 얇다"는 지적(§2.7 프리페치 버그)은 이미 상당 부분 해소됐다** — T1.12-5가 `session.ts`·`responses.ts`에 단위 17건을 붙였고 관리자 경로는 `CI=1` E2E 46건에 포함된다.

   **전제 — 하나라도 깨지면 ⓒ를 다시 판단한다.**
   1. **ⓐ 교체 완료** — 43자 난수로 바꾸고 저장소 밖에 둔다
   2. **ⓑ 복원 리허설 1회 성공** — 손입력 착수 **전**. 리허설하지 않은 백업은 백업이 아니다
   3. **관리자 API의 파괴 표면 동결** — 일괄 삭제 · 전량 덮어쓰기 엔드포인트를 늘리지 않는다. **A-5(CSV 일괄 등록)가 upsert로 기존 행을 덮게 되면 이 전제가 깨지므로, A-5 착수 시점에 ⓒ를 재검토한다**
3. **외부 사이트 약관 — 7곳 전수 검토 완료.** 카드 정보 4곳(2026-08-25 · ⓐ) · 중고 매물 3곳(2026-08-26 · ⓒ). **남은 공백은 `docs/crawler-compliance.md` §8.2와 §10.7에 목록으로 있다** — "검토가 끝났다"가 "공백이 없다"는 뜻이 아니다.

   **ⓐ 검토 완료 — 카드 정보 사이트 4곳.** `pokemoncard.co.kr` · `onepiece-cardgame.kr` · `onepiece-cardgame.com` · `pokemon-card.com`의 `robots.txt`와 약관 본문을 전수 확인해 `docs/crawler-compliance.md`에 원문 인용과 함께 기록했다. **결과를 ① 접근 ② 데이터 재사용 ③ 이미지 ④ 상업적 이용의 4축으로 나눠 적었다.** 법률 자문이 아니며 위험 수준과 근거만 남겼다 — 판단은 사용자가 한다.

   | 사이트 | ① 접근 | ② 데이터 재사용 | ③ 이미지 | ④ 상업적 이용 |
   |--------|--------|-----------------|----------|----------------|
   | pokemoncard.co.kr | **낮음** (`Allow: /`) | 중간 (조항 주어가 "회원") | 높음 | 중간 |
   | onepiece-cardgame.kr | 근거 없음 | 근거 없음 | 근거 없음 | 근거 없음 |
   | onepiece-cardgame.com | 근거 없음 | **높음** | **높음** | **높음** |
   | pokemon-card.com | 근거 없음 | **높음** | **높음** | **높음** |

   **`robots.txt`만 보면 정확히 거꾸로 간다.** 접근이 가장 열린 곳(포켓몬코리아, 전체 허용)이 데이터 재사용도 가장 느슨하고, 접근 신호가 없는 일본 2곳이 재사용을 가장 강하게 막는다. **"금지 문구를 못 찾았다"는 "허용"이 아니다** — 원피스 한국 사이트는 약관 문서 자체를 찾지 못해 네 축 모두 판단 재료가 없다.

   **ⓑ 가장 중요한 결과 — 손입력이 피해 주는 축은 ① 하나뿐이다.** §4.4가 "사람이 보고 옮겨 적는 것"을 허용한 것은 **접근 규율을 벗어난 것이지 ②를 푼 것이 아니다.** 인용한 재사용 금지 조항 어디에도 수집 방법이 조건으로 들어 있지 않다 — 「他のインターネットなどの公衆ネットワーク上で利用することはできません」(포켓몬 일본) · 「無断転用、転載」(원피스 일본) · 「복제, 송신, 출판, 배포, 방송 **기타 방법에 의하여**」(포켓몬코리아 제14조③). **즉 pokemon-card.com은 손입력이든 자동화든 문언상 동일하게 막힌다.**

   그래서 손입력에서도 **원천을 구분해야 한다.** 인용 조항은 모두 「このサイトに掲載されている」·「본 사이트의 콘텐츠」처럼 **사이트 게재물**을 대상으로 쓰여 있다 — **카드 실물을 보고 입력하는 것은 이 4곳의 약관 범위 밖이다**(실물에 대한 별도 권리 문제는 남지만 사이트 약관은 아니다).

   **→ 이 결과를 받아 사용자가 원천을 정했다. 방침은 §4.4.1에 있다** — `onepiece-cardgame.kr` 하나로 고정, 일본 2곳 배제, 포켓몬코리아 보류. **§9.3은 검토 결과를 담는 곳이고 결정문은 §4.4.1이다.** 둘을 같이 읽어야 한다: **결정의 근거가 "허용 확인"이 아니라 "금지 근거를 찾지 못함"이라는 점**이 이 절의 판정표에서 나온다.

   > 사실 정보(카드 번호 · 레어도)와 표현물(효과 텍스트 · 일러스트)의 취급 차이는 **법적 판단이라 문서에서 다루지 않았다.** 약관 본문이 「すべてのコンテンツデータ」라고 쓴 사실만 기록했다.

   **ⓒ 메르카리 · 라쿠마 · 야후옥션 — 검토 완료 (2026-08-26). 결과는 `docs/crawler-compliance.md` §10.4~§10.6.** ~~미검토~~. §0.1 ⓐ(대상 4~6번)로 당겨져 카드 정보 4곳과 같은 4축 + ⑤ 공식 창구 축으로 기록했다.

   | 대상 | ① 접근 | ② 데이터 재사용 | ③ 이미지 | ④ 상업적 이용 | ⑤ 공식 창구 |
   |------|--------|-----------------|----------|----------------|-------------|
   | 메르카리 | **중간** — `/item/`·`/search/`는 열려 있으나 **내부 API `/v1/`·`/v2/`가 전 UA Disallow**. 규약 제8조가 금지사항을 가이드에 위임하고 판단을 회사에 유보 | 중간 (제21조) | 중간 | **근거 없음** | **스코프 불일치** — Shops API는 자기 상점 전용 |
   | 라쿠마 | **높음** — `robots.txt`가 **`/search/`와 검색 파라미터 전량 Disallow** | 중간 (제17조) | 중간 | **근거 없음** | **없음** — 라쿠텐 API 카탈로그에 부재 |
   | 야후옥션 | **높음** — **`/closedsearch/`(낙찰 이력) 통째로 Disallow** + 細則 A-33/E-1(6) 대량 접근 금지 | **높음** — 공통규약 제14조 「当社サービスやそれらを構成するデータを、その提供目的を超えて利用することができません」 | 중간 | 중간 (제15조(11)) | **닫힘** — 옥션 Web API **2020년 1월 종료** |

   **읽어야 할 것 — 셋이다.**

   1. **예상은 맞았고, 걸린 곳이 달랐다.** ⓒ의 옛 서술은 「자동화 금지 조항이 명시돼 있을 가능성이 높다」였는데, 실제로 더 강하게 걸린 것은 **조항이 아니라 `robots.txt`다.** ⚠️ **이 프로젝트에서 `robots.txt`발 "높음"이 나온 것은 처음이다** — 카드 4곳은 404 셋 + 전체 허용 하나였다.
   2. **위험의 무게중심이 카드 4곳과 반대다.** 카드 4곳은 ①이 비고 ②가 강했다. 거래 3곳은 **①이 가장 강하다.** §9.3 ⓐ의 「`robots.txt`만 보면 정확히 거꾸로 간다」가 **이쪽에서는 반대로 성립한다** — 여기서는 `robots.txt`가 가장 정확한 신호다.
   3. **🚨 우리가 쓰려는 바로 그 데이터가 지목돼 있다.** 야후옥션의 `/closedsearch/`는 **낙찰 이력**이고 **§4.3 기준가 산출이 가장 원하는 값(실제로 팔린 가격)이 정확히 거기다.** 진행 중 호가가 아니라.

   **→ T2.7의 설계 전제가 확정됐다: 공식 경로로 갈아탈 수 없다.** 이 절을 T2.6 앞으로 당긴 근거가 「공식 API가 있으면 어댑터 3종이 API 호출로 바뀐다」였는데, **세 곳 모두 공식 경로가 없어 그 전환은 일어나지 않는다.** **스캐폴딩 전에 답을 받았다는 점에서 순서 판단은 옳았다** (`docs/crawler-compliance.md` §10.8 ⓐ).

   > ⚠️ **라쿠마 「ラクマのルール」 가이드(`faq.fril.jp`)는 여전히 못 봤다 — 그리고 2026-08-28 재시도로 성격이 바뀌었다.** 메르카리가 **규약 → 가이드 위임** 구조였으므로 라쿠마도 같을 수 있고, **그렇다면 지금 "자동화 금지 조항 못 찾음"으로 적힌 판정이 뒤집힌다.** 08-26에 "T2.6 착수 전에 다시 연다"로 미뤄 뒀던 것을 **08-28에 당겨 시도했고, 두 경로(`/hc/ja` 루트 · 기사 URL 1건)가 모두 HTTP 403이었다.** 경로가 아니라 **호스트·도구 단위 차단으로 보이며(추정)**, **에이전트 도구로 여는 길은 남지 않았다 — 사람이 브라우저로 여는 경로만 남았다.** 기록은 `docs/crawler-compliance.md` §10.5 ⓒ · §10.7. ⚠️ **검색 결과 요약에 라쿠마 금지행위 목록이 일부 보였으나 원문을 열지 못했으므로 인용하지 않는다** — §10.7의 야후옥션 「クローラー」 문구와 **같은 규칙**이다. 나머지 공백은 §10.7에 10건으로 정리했다.

   > ⚠️ **아키텍처와 스치는 조항이 하나 있다 — ヤフオク! 細則 A-34/E-1(7).** 「外部のサーバーまたはブラウザ等を経由して自らのIPアドレスを偽る行為」를 부정 접근으로 든다. **목적어가 "IP 주소 위장"이라 §1 P2(Cloudflare Workers 경유)가 곧 위반이라고 읽히지는 않지만, 판단 주체가 「当社が合理的に判断する」다.** P2 옆에 이 사실을 기록해 둔다 — **P2를 바꾸지는 않는다**(그 근거는 앱 서버 격리이고 은닉이 아니다).

   **ⓓ 재확인 의무.** 약관은 바뀐다. `docs/crawler-compliance.md` §9에 확인 URL과 날짜 표를 뒀다. **새 입력 배치를 시작하기 전에 그 표의 URL을 다시 열어 인용문과 대조한다.**
4. **카드 이미지 — 결정 완료. 두 번에 걸쳐 닫혔다: 저장 방식(2026-08-25) → 저장 경계와 실패 처리(2026-08-26, 아래 ⓐ~ⓔ).** 관리자가 외부 URL을 직접 입력하는 현재 방식을 그대로 둔다(§4.4.1 결정 4). 원래 질문은 "핫링크냐 자체 호스팅(Supabase Storage / R2)이냐"였고 판단 재료를 T1.14가 만들기로 했는데, **그 재료는 운영 측면(URL을 안정적으로 구할 수 있는가)이었다.** §9.3 약관 검토가 다른 축의 재료를 줬고 결론이 뒤집혔다.

   | 방식 | 걸리는 문구 | 위험 |
   |------|-------------|------|
   | 자체 호스팅 | 「データの**コピー、複製**…固くお断りします」 · 「複製、改変、掲示、頒布」 · 「무단 **복제**」 | **가장 높다.** 4곳 모두가 "복제"를 첫 번째로 지목하고, **파일을 우리 저장소에 두는 것이 문언상 정확히 복제다** |
   | 핫링크(현행) | 명시적 복제는 아니다. 단 포켓몬 일본은 「著作物を複製、使用してのリンク設定はご遠慮いただきます」 「必ずテキストリンクで」 | 중간 |
   | 싣지 않는다 | 해당 없음 | 가장 낮다 |

   **자체 호스팅은 운영 편의를 올리는 대신 위험을 명확히 키우는 방향이므로, 허락을 받은 뒤에만 검토할 선택지로 내린다**(§4.4.1 결정 6의 회신이 그 허락이다). → ⚠️ **2026-08-28: 그 회신이 오지 않게 됐다(§0.1 ⓒ). 자체 호스팅은 사실상 영구 기각이다 — ⓔ 셋째 행.** 그리고 **원래 §9.4에 없던 세 번째 선택지를 남겨 둔다: "이미지를 싣지 않는다".** ③이 4축 중 위험이 가장 집중된 곳인데 **덱 구성 · 기준가 · 키워드 검색은 이미지 없이도 성립한다.** 최소한 **`image_url`이 선택적이고 없어도 서비스가 동작하는 상태**는 유지한다 — 이것이 이 결정의 되돌릴 수단이다.

   > ~~**미결로 남는 것은 "핫링크냐 자체 호스팅이냐"가 아니라 "핫링크냐 아예 빼느냐"다.**~~ → **2026-08-26에 닫혔다. 둘 중 하나를 고르는 대신 둘 다 코드에 넣는 방식으로 닫았다** — 핫링크가 되는 동안 원본을 보이고, 안 되면 폴백 프레임으로 떨어진다. 아래 ⓐ~ⓔ가 결정문이다.

   **자체 호스팅이 기각된 근거는 그대로 유효하고, 이번 결정이 그것을 더 굳힌다.** 위 표대로 **4곳 약관이 모두 "복제"를 첫 번째로 지목**했고, 파일을 우리 저장소에 두는 것이 문언상 정확히 그것이다. 아래 ⓐ는 그 선을 **"안 한다"에서 "구조상 할 수 없다"로** 옮긴다 — 이미지 바이트를 받아 두는 코드 경로 자체를 만들지 않는다.

   **ⓐ 저장 경계 — 텍스트는 저장하고 이미지는 저장하지 않는다.**

   | 대상 | 우리 DB | 근거 |
   |------|---------|------|
   | 카드 코드 · 이름 · 효과 텍스트 · 레어도 · 속성 · 종류 | **저장한다** (`cards` — §4.1) | 검색 · 패싯 필터 · 키워드 태깅 · 덱 검증 · 크롤러 검색 키(`name_ja`)가 전부 이 값 위에 서 있다. **저장하지 않으면 서비스가 성립하지 않는다** |
   | **코스트 · 파워 등 수치 성능** | **저장한다 — 단 아직 둘 곳이 없다** | §4.1의 `cards`에 `cost` · `power` 컬럼이 **없다.** 방침은 "저장한다"이고 **컬럼은 미생성**이다 — 아래 주 참조 |
   | 이미지 바이트 | **저장하지 않는다.** `cards.image_url`에 **원본 URL만** 둔다 | 위 표 — 「コピー、複製」 · 「複製、改変、掲示、頒布」 · 「무단 복제」 |

   > ⚠️ **코스트 · 파워는 방침만 정해졌고 스키마가 따라오지 않았다 — 지금 태스크로 만들지는 않는다.** §4.1의 `cards`가 가진 성능 컬럼은 `effect_text` 하나이고, 원피스의 코스트 · 파워 · 카운터는 들어갈 자리가 없다. **T1.14가 그 값을 만나기는 하지만 이번 배치의 완료 기준에 들어 있지 않으므로 입력이 막히지는 않는다.** 컬럼을 지금 만들지 않는 이유는 §4.4.1 결정 3(포켓몬 보류)과 같다 — **게임마다 성능 축이 달라 `cards`에 평평하게 눕힐지 게임별로 나눌지가 정해지지 않았고, 카드 34장으로 그 판단을 하면 추측이 된다.** T1.14의 "실데이터에서 무너진 지점" 표가 이 판단의 재료다. ⚠️ **같은 자리에 미결이 셋 더 있다** — `sub_type`(원피스 特徴, T1.14) · **ptcg 「기본 포켓몬」 식별 값의 부재** · **opcg 다색 카드를 단일 `attribute` 컬럼으로 표현할 수 없는 것**(뒤의 둘은 2026-08-28에 §4.7 ⓗ가 드러냈다). **넷은 「카드의 게임 성능을 어떤 모양으로 저장할 것인가」라는 하나의 질문이고, 한 마이그레이션에서 함께 판단한다.**

   > ⚠️ **이 경계가 ②(데이터 재사용)를 해결하지는 않는다.** 텍스트를 우리 DB에 두는 것은 §9.3 ⓑ가 "손입력이든 자동화든 문언상 동일하게 막힌다"고 적은 바로 그 축에 그대로 남아 있고, 그래서 원천이 `onepiece-cardgame.kr` 하나로 좁혀져 있다(§4.4.1). **이번 결정이 낮추는 것은 4축 중 ③(이미지) 하나다.** ~~나머지는 §0.1 ⓐ 조사와 §4.4.1 결정 6의 문의가 받는다.~~
   >
   > 🚨 **2026-08-28 — 「나머지를 받는다」던 둘이 다 없어졌다.** §0.1 ⓐ는 **열린 창구 0곳**으로 끝났고, §4.4.1 결정 6의 문의는 **보내지 않기로 했다**(§0.1 ⓒ). **즉 ②축을 받아 줄 것이 이제 없다.** ⚠️ **수익화 폐기도 이 자리를 대신하지 못한다** — ②축 조항은 영리성을 조건으로 달지 않는다(§9.1의 ⚠️⚠️). **이 문단을 "③만 낮추면 된다"로 읽지 않는다. ②는 낮아진 적이 없고, 낮출 경로가 사라졌다.**

   **ⓑ 프론트엔드 안전장치 둘.** 핫링크는 우리가 통제하지 못하는 호스트에 화면 한 칸을 맡기는 것이다. **그 칸이 비었을 때 무엇이 보이는지를 미리 정해 둔다.**

   | 장치 | 무엇을 한다 | 성격 |
   |------|-------------|------|
   | **`<img referrerPolicy="no-referrer">`** — **값 확정 (2026-08-28 · §0.1 ⓒ)** | 원본 서버에 우리 도메인(`Referer`)을 넘기지 않는다 | ⚠️ **완화책도 아니고 우회도 아니다. 효과가 미실측이고 양방향이라 "측정 항목"이다** → ⓒ · ⓔ |
   | `onError` 폴백 프레임 | 로드 실패 시 엑박 대신 텍스트 기반 카드 프레임을 그린다 (표시 항목은 아래, 시각 규칙은 §2.8-6) | ★ **2026-08-28에 성격이 올라갔다 — 「방어 코드」다** → 아래 |

   **`image_url`이 애초에 null인 경우와 로드 실패는 같은 화면으로 간다.** 사용자에게 둘은 구분할 이유가 없는 상태이고, 분기를 나누면 **실패 경로가 드물게만 실행돼 깨져도 모르는 코드**가 된다. 한 화면으로 합치면 카탈로그가 비어 있는 지금(§9.8 — 전 테이블 0행) 그 경로가 매일 실행된다.

   **★ 폴백의 격상 — "보기 좋은 빈칸"에서 "방어 코드"로 (2026-08-28 · §0.1 ⓒ).**

   지금까지 이 문서에서 폴백의 근거는 **§2.8-6(엑박이나 회색 자리표시로 보이면 안 된다)**, 즉 **시각 품질**이었다. 사용자가 이것을 **「핫링크 차단 시의 방어 코드」**로 규정했다. **요건이 바뀐다.**

   | | 격상 전 | 격상 후 |
   |---|---|---|
   | 무엇을 보증하나 | **한 장**이 깨졌을 때 화면이 흉하지 않다 | **전부** 깨져도 **서비스가 성립한다** |
   | 판정 기준 | 폴백이 예쁜가 | **이미지를 전부 끈 상태에서 도감 · 검색 · 상세 · 대체 카드가 제 기능을 하는가** |
   | 없을 때의 결과 | 미관 저하 | ⚠️ **핫링크가 막히는 날 서비스가 못 쓰게 된다** — 그날 고치는 것은 늦다 |

   **→ 이것이 B-6의 우선순위를 바꾼다**(§8). 그리고 **§9.4 ⓔ의 되돌릴 조건 첫 행("폴백을 기본 화면으로 삼는다")이 비상 대응이 아니라 상시 가능한 상태여야 한다**는 뜻이 된다.

   **텍스트 기반 카드 프레임이 무엇을 표시하는가 — 우리 DB에 실제로 있는 값만 쓴다.**

   ⚠️ **없는 값을 전제로 설계하지 않는다.** 근거는 `src/types/card.ts`와 §4.1이다. **호출부 4곳 중 셋(홈 쇼케이스 · `card-grid` · `similar-cards`)은 `CardListItem`만 가진다** — 상세(`CardDetail`)에만 있는 값을 프레임에 넣으면 그 셋에서 성립하지 않는다.

   | 항목 | 컬럼 | 쓰는가 |
   |------|------|--------|
   | 카드명 | `name_ko` ?? `name_ja` (`cardDisplayName()`) | **쓴다.** `name_ja`가 `not null`이라 **항상 값이 있다** — 프레임의 유일한 필수 항목 |
   | 카드 코드 | `code` | **쓴다.** `not null`. 기존 `showCode` prop이 노출 여부를 가르는 것도 그대로 |
   | 속성 | `attribute` | **쓴다.** nullable · **자유 텍스트**다(§2.8-6 · T1.14 "표기 통일" 주의). **매핑에 없는 값과 null은 아이콘 없이 이름만, 그래도 없으면 그 줄을 비운다** |
   | 레어도 · 카드 종류 | `rarity` · `card_type` | **지금은 쓰지 않는다.** `CardListItem`에 있어 **추가 자체는 가능**하나, §2.8-2가 레어도 배지를 이미 카드 타일에 얹고 있어 **폴백에서 또 그리면 중복이다.** 필요해지면 props 가산 변경으로 연다 |
   | 효과 텍스트 | `effect_text` | **쓰지 않는다 — 쓸 수 없다.** `CardDetail`에만 있고 `CardListItem`에 없다. 그리고 상세 화면에서는 **본문이 이미 따로 그린다** |
   | 코스트 · 파워 | — | **쓸 수 없다. 컬럼이 존재하지 않는다**(ⓐ의 ⚠️ 주). "저장한다"는 방침만 있고 스키마가 없다 |
   | 게임 색 | `game_id` | **쓰지 않는다**(§2.8-6). `CardListItem`에 없어 조회 폭을 넓혀야 하는데 프레임 하나 물들이자고 낼 값이 아니다 |

   **→ 프레임은 `name` 하나로도 성립해야 한다.** `attribute`가 null이고 `showCode`가 false여도 빈 상자가 되지 않는다 — **카드명이 항상 있기 때문이다.** 이것이 B-6 완료 기준 ⓔ가 요구하는 상태다.

   > ⚠️ **원본 일러스트를 흉내 내는 요소를 넣지 않는다**(§2.8-6). 틀과 색은 우리 토큰(`--surface-raised` · `--hairline`)으로만 만든다. **폴백이 원본처럼 보이면 그것이야말로 §9.4가 피하려던 자리다** — ⓐ가 "이미지 바이트를 저장하지 않는다"로 그은 선을 화면에서 되돌리는 셈이 된다.

   > **전역 `Referrer-Policy`(메타 태그 · 응답 헤더)로 걸지 않고 `<img>` 단위로 거는 이유.** 전역으로 걸면 **외부 링크와 유입 분석까지 함께 잘린다** — Search Console·유입 통계가 출처를 잃고, 우리가 내보내는 아웃바운드 링크도 상대에게 출처를 남기지 않는다. **필요한 곳은 카드 이미지 한 군데뿐이라 손해만 남는 교환이다.** SEO는 애드센스를 폐기한 뒤에도 남는 축이다(§0.1 ⓑ · §1 P1).

   **ⓒ `no-referrer`가 무엇이고 무엇이 아닌지 — 여기서 선을 긋는다. (값은 2026-08-28에 확정됐고, 이 절의 유보는 그대로다)**

   사용자가 값을 **`no-referrer`로 못박았다**(§0.1 ⓒ). **값이 정해진 것이지 효과가 확인된 것이 아니다.**

   이것은 우회 도구가 아니다. **어느 사이트가 실제로 `Referer` 기반 핫링크 차단을 하는지 우리는 측정하지 않았다** — `onepiece-cardgame.kr`을 포함해 4곳 전부 미실측이다. 그래서 **"붙이면 통과한다"고 쓰지 않는다.**

   > **⚠️ 그리고 "완화책"이라고도 단정하지 않는다 — 결과가 양방향이다.** `no-referrer`는 `Referer` 헤더를 **아예 보내지 않게** 한다. 핫링크 차단 설정은 크게 두 종류다.
   >
   > | 서버 설정 | `no-referrer`의 결과 |
   > |---|---|
   > | **외부 `Referer`만 거부**하고 빈 `Referer`는 통과시킨다 | **통과한다** — 기대한 방향 |
   > | **빈 `Referer`도 거부**한다 (직접 접근 차단 · 화이트리스트 방식) | **오히려 더 많이 차단된다** — 붙이지 않는 편이 나았을 수 있다 |
   >
   > **어느 쪽인지는 `onepiece-cardgame.kr`에 대해 실측하지 않으면 모른다.** 이 세션에서 실측하지 않았다. **→ 「차단을 우회한다」가 아니라 「측정 항목」으로 적는다.** 측정 설계는 ⓔ에 있다.

   ⚠️ **통과 여부와 별개로 갈리는 선이 하나 더 있다.** 이 프로젝트의 현 방침은 §0.1 ⓐ·§9.3이 적었듯 **"금지 근거를 찾지 못했다"는 위태로운 자리**에 서 있다. 그 자리에서 **원본 사이트가 의도적으로 핫링크를 막고 있다면, 헤더를 지워 그것을 넘어가는 것은 성격이 다르다** — 금지 근거의 *부재*가 아니라 **명시된 거부**를 상대하는 일이 된다. 이번 결정은 **깨짐 방지**를 위한 것이지 그 거부를 넘기 위한 것이 아니다.

   **→ 조건을 지금 걸어 둔다: 어떤 사이트가 핫링크를 차단하고 있음이 확인되면, 그 사이트에 대해서는 `no-referrer`로 넘어가지 않고 "이미지를 싣지 않는다"로 간다.** 그 원천의 카드는 `image_url`을 비워 **폴백을 상시 화면으로 쓴다.** 확인 시점은 T1.14다(ⓔ).

   **ⓓ 폴백이 이 절의 "되돌릴 수단"을 실제로 구현한다 — 이번 결정의 가장 큰 실익이다.**

   이 절은 되돌릴 수단을 **"`image_url`이 선택적이고 없어도 서비스가 동작하는 상태를 유지한다"**로 걸어 뒀다. 그것은 지금까지 **문서상의 약속**이었다 — 지켜지는지는 실제로 비워 봐야 알 수 있고, 이미지를 전제한 레이아웃이 하나만 끼어들어도 조용히 깨진다.

   `onError` 폴백은 그 약속을 **상시 코드 경로**로 바꾼다. 결과가 둘이다.

   - **"이미지를 싣지 않는다"가 제품 결정에서 자동 폴백 상태로 내려온다.** 셋 중 하나를 고르는 문제가 아니라 **한 가지 동작**이 된다 — 되면 원본, 안 되면 프레임
   - **권리자 중지 요청(§9.11 "중지 요청" 행)에 대한 대응이 `image_url`을 비우는 UPDATE 한 번이 된다.** 화면은 그대로 성립하고 **코드 변경도 배포도 필요 없다.** 그 갈래의 되돌릴 수단이 T1.13 덤프뿐이었는데, **이미지 축에 한해서는 덤프를 꺼낼 필요조차 없어진다**

   **`CardImage`가 `next/image`가 아니라 `<img>`인 것은 이 결론과 맞으므로 그대로 둔다** — `next/image`는 원본을 가져와 최적화본을 만들어 캐시하므로 **동작 자체가 복제에 가깝다.** `images.remotePatterns`가 필요 없다는 것은 부수 효과일 뿐이다. **이번 결정이 그 선택을 되돌릴 수 없게 만든다:** `referrerPolicy`와 `onError`는 `<img>`에 직접 붙는 계약이고, ⓐ의 저장 경계가 "우리 인프라가 원본 바이트를 만지지 않는다"를 요구한다. **`next/image`로 옮기려면 ⓐ부터 다시 열어야 한다.**

   **ⓔ 되돌릴 조건 — 셋 중 하나가 성립하면 이 결정을 다시 연다.**

   | 조건 | 어디로 |
   |------|--------|
   | **폴백 발생률이 높다** — 원본 URL이 자주 죽어 이미지가 보이는 카드가 소수가 된다 | 핫링크로 얻는 것이 사라진 것이다. `image_url` 입력을 중단하고 **폴백을 기본 화면으로 삼는다** — 입력 시간도 함께 줄어든다. **ⓑ의 격상 이후 이 갈래는 "비상 대응"이 아니라 상시 가능한 상태여야 한다** |
   | **핫링크 차단이 확인된다** | ⓒ대로 **그 사이트에 한해** "싣지 않는다". 사이트 단위로 갈리는 것은 §9.11 ⓒ와 같은 구조다 |
   | ~~**권리자 회신** (§9.11)~~ | ⚠️ **2026-08-28에 무효가 됐다 — 문의를 보내지 않으므로 회신이 오지 않는다**(§0.1 ⓒ · §4.4.1 ⓓ). **자체 호스팅 갈래를 다시 열 수 있는 유일한 경로가 이것이었고, 그 경로가 닫혔다 — 즉 자체 호스팅은 사실상 영구 기각이다.** 「중지 요청」만 남고, 그때는 ⓓ대로 `image_url`을 비운다 |

   **T1.14가 만들 실측치 — 셋이다.** 셋 다 **T1.14 "측정 기록"의 `image_url` 행에 적는다.**

   | # | 측정 항목 | 무엇을 판정하나 |
   |---|-----------|-----------------|
   | 1 | **장당 URL 확보 시간** — 입력 시간의 몇 할인가 | 핫링크를 유지할 값어치가 있는지 |
   | 2 | **폴백 발생률** — 34장 중 URL을 못 구했거나 링크가 죽은 것이 몇 장인가 | 위 표의 첫 행 |
   | 3 | ★ **`no-referrer` 적용 시 / 미적용 시 이미지 로드 실패율** (2026-08-28 추가 · ⓒ) | **`no-referrer`가 통과율을 올리는지 내리는지.** ⓒ의 두 서버 설정 중 `onepiece-cardgame.kr`이 어느 쪽인지가 여기서 갈린다 |

   > **측정 3을 어떻게 하는가 — 설계만 적고 실행은 하지 않는다.** 같은 `image_url` 집합에 대해 **`referrerPolicy` 속성이 있는 렌더와 없는 렌더의 실패 건수를 각각 센다.** 표본은 T1.14가 넣는 URL 그대로이므로 **B-6 구현 이후에만 셀 수 있다** — 이것이 B-6을 T1.14 가까이 두는 근거 중 하나다(§8).
   >
   > ⚠️ **결과가 "미적용이 낫다"로 나오면 §0.1 ⓒ의 3번 결정을 되돌린다.** 사용자가 못박은 것은 **값**이고, **효과는 이 측정이 정한다.** 측정 전에 「`no-referrer`라서 차단을 피한다」고 쓰지 않는다.
   >
   > ⚠️ **한 가지는 측정으로도 안 갈린다.** 실패율이 내려가도 **그것이 "차단이 없어서"인지 "차단을 헤더 부재로 넘어간 것"인지는 구별되지 않는다.** ⓒ의 ⚠️(명시된 거부를 헤더를 지워 넘는 것은 성격이 다르다)가 그 자리에 그대로 서 있다.

   **확인하지 못한 것 — 넘겨받는 사람이 확인된 것으로 읽지 않도록 적어 둔다.**

   - **4곳 중 어디가 `Referer` 기반 핫링크 차단을 하는지** — 미실측
   - **`no-referrer`가 실제로 차단률을 낮추는지** — 미실측. **값은 확정됐지만 방향은 확정되지 않았다**(ⓒ). `Referer` 부재를 오히려 막는 설정도 있어 **역효과 가능성이 배제되지 않았다** → 위 측정 3
   - **원본 URL의 수명** — 사이트 개편 · CDN 교체로 URL이 얼마나 자주 바뀌는지. T1.14 직후가 아니라 **시간이 지나야 나오는 값**이다
5. **비로그인 매물 검색 허용 여부** — 허용 시 IP 해시 쿼터만으로 방어해야 해 우회 여지가 커진다. 로그인 필수면 방어력은 오르나 초기 유입이 준다.
6. **환율 갱신 주기** — 기준가 KRW 환산 스냅샷 주기(일 1회 권장).
7. **Node 버전** — 현재 20.15.1로 테스트 툴체인 4개를 하향 고정한 상태다(§2.5). 22 LTS로 올리면 해소된다.
8. **원격 DB의 임시 데이터** — T1.10 디자인 확인용 샘플과 E2E 잔여물이 쌓인다. 샘플은 **카드명과 일러스트가 맞지 않는 가짜 데이터**라 공개 전에 반드시 지워야 한다. `npm run db:clean`은 접두사 + 6자리 타임스탬프 정규식으로만 골라내므로 손으로 등록한 카드를 건드리지 않는다. **2026-08-25 종료 시점 실측: 전 테이블 0행.** T1.13 복원 리허설용 표본과 T1.15 E2E 잔여물까지 `db:clean`으로 되돌린 뒤 확인했다. **손입력 데이터는 아직 없다 — T1.14가 이 DB에 실데이터를 넣는 첫 작업이다.**
9. **E2E가 데이터를 남긴다** — 각 spec이 `beforeAll`에서 만든 데이터를 지우지 않아 실행할수록 누적된다. 관측된 누적량은 회당 수십 행 수준이라 **성능이 아니라 "`db:clean`을 매번 잊지 않고 돌려야 하는 상태 그 자체"가 문제**다. 근본 해법은 **테스트 전용 Supabase 프로젝트 분리**다.
    - **자가 정리 선례:** `admin-cards.spec.ts`의 등록 → 수정 → **삭제** 왕복은 끝에 자기 카드를 지운다. 같은 파일의 페이지네이션 테스트(22장)는 **의도적으로 지우지 않는다** — 검색 결과가 22건임을 검증해야 하는데 매번 지우면 다음 실행의 대조군이 사라진다. 대신 `cleanup-sample.ts`가 패턴으로 걷어간다
    - **규칙 1 — 접두사를 새로 쓰는 스펙을 추가하면 `cleanup-sample.ts`의 표와 패턴을 같은 커밋에서 갱신한다.** T1.12-7이 이 규칙을 어긴 첫 사례다 — "발행 취소 → 404" 스펙이 남기는 `unpub-######`가 뉴스 패턴 `^(pub|draft)-`에 걸리지 않았다. **T1.12-7 커밋에서 `^(pub|unpub|draft)-`로 넓혀 해소했다**
    - **규칙 2 — 원인 추적용으로 만든 데이터는 그 세션 안에서 지운다.** `cleanup-sample.ts`에 진단용 접두사를 등록하지 않는다(진단은 반복되는 절차가 아니라 매번 다른 이름을 쓴다). 2026-08-25에 `probe-` · `diag-` · `repro-` 등 13건을 수동으로 걷어냈다 — 그 수동 작업이 이 규칙의 근거다
    - ⚠️ **T1.14부터 성격이 바뀐다** — `db:clean`이 손입력 실데이터와 같은 DB를 청소하는데 **드라이런이 없다.** 실행 직전에 `npm run db:dump`를 반드시 돌린다(T1.13)
10. **카드 삭제는 하드 삭제로 유지한다 (T1.12 결정)** — 참조하는 테이블이 아직 `card_keywords`뿐이고 여기에는 `on delete cascade`가 걸려 있어, soft-delete를 지금 도입하면 전 조회 경로에 `deleted_at is null` 조건을 다는 비용만 남는다. **전환 시점은 `deck_cards`(T2.3)와 `collection_items`(T3.2)가 들어올 때다.** 그때부터는 카드 1장을 지우는 것이 남의 덱과 컬렉션을 조용히 무너뜨리므로 하드 삭제를 유지할 수 없다. 두 마이그레이션 중 먼저 오는 쪽에서 재검토한다.

11. **문의 회신별 대응 — ⚠️ 전제가 없어졌다 (2026-08-28). 절은 남는다.** §4.4.1 결정 6의 문의가 **발송 폐기**됐으므로(§0.1 ⓒ) 이 절이 서 있던 전제 — **「회신을 기다린다」** — 가 사라졌다. **그러나 절 전체가 무의미해진 것은 아니다.** 무엇이 없어지고 무엇이 남는지를 먼저 가른다(→ **ⓖ**). 원래 이 절은 회신이 왔을 때 **그 자리에서 판단하지 않기 위한** 갈래였고, 그 성격상 **태스크로 만들지 않는다**는 방침도 그대로다.

    **ⓖ 문의 폐기가 이 절에 한 것 — 없어진 것 / 남은 것 / 옮겨간 것 (2026-08-28)**

    | | 내용 | 왜 |
    |---|------|-----|
    | **없어졌다** | **아래 「회신별 갈래」 표 전체** · **ⓐ**(무응답 기한) · **ⓕ-3**(자기소개 문구 A/B 선택) · 반다이 발송 창구 선택 · `docs/permission-inquiry-drafts.md`의 발송 기록 표 | **전부 "회신이 온다"를 전제로 한다.** 회신이 없으므로 분기할 것도, 기다릴 기한도, 고를 문구도 없다 |
    | **남았다 — ⓑ** (묻는 데에는 비용이 있다) | 🚨 **성격이 바뀌어 남는다.** ⓑ의 두 근거 중 **「묻지 않는다고 해서 합법이 되는 것이 아니다」**가 이제 이 절의 **중심 문장**이다. 그리고 ⓑ의 나머지 절반 — **「§4.4.1의 근거가 "금지 근거를 찾지 못함"이라 그 공백을 메울 방법이 문의뿐」** — 이 **그 방법을 없앤 결과를 그대로 서술한다** | **묻는 비용은 사라졌지만 그 비용으로 사려던 것(근거)도 함께 사라졌다.** 이 교환을 알고 한 것으로 기록한다(§4.4.1 ⓓ) |
    | **남았다 — ⓓ** (전부 막혔을 때의 세 갈래) | **회신과 무관하게 성립한다.** ⓓ-1(사실 데이터만 남긴다) · ⓓ-2(카드 DB를 호스팅하지 않는다) · ⓓ-3(대상 게임을 바꾼다)는 **"거절 회신 4건"이 아니라 "이 방침으로 못 가게 됐을 때"의 갈래다.** 진입 트리거만 바뀐다 → **아래 ⓖ-1** | 중지 요청 · 약관 신설(§4.4.1 되돌릴 조건 1·3)이 그대로 살아 있다 |
    | **남았다 — ⓔ** (모든 갈래에서 살아남는 T2.1 · T2.2) | **그대로다. 그리고 이미 실현됐다** — 2026-08-28에 둘 다 구현 완료(도메인 56건 · 전체 153건). ⓔ의 주장(「어떤 회신이 와도 버려지지 않는 유일한 작업」)은 **회신이 아예 없어진 지금도 참이다** — 오히려 **"회신을 기다리는 동안 하는 작업"이라는 근거만 빠지고 결론은 남는다** | 순수 함수라 카드 DB의 유무·소유 주체와 무관하다 |
    | **남았다 — ⓕ-1 · ⓕ-2** (집영사·토에이의 문서화된 방침 · TPCi의 거절 방침) | **관측 사실이라 남는다.** 다만 **용도가 바뀐다** — 「보내기 전에 알아 둘 것」에서 **「이 결정이 어떤 환경에서 내려졌는지의 기록」**으로 | ⚠️ **이것을 "그래서 안 물어도 된다"의 근거로 쓰지 않는다.** 넷 중 가장 중요한 `card@xosoft.kr`은 이 방침들과 층이 다르고, 그쪽 답은 **끝내 알 수 없게 됐다**(§4.4.1 ⓓ) |
    | **옮겨갔다** | **ⓖ-1 — 진입 트리거.** ⓓ에 들어가는 조건이 「거절 회신 4건」에서 **「§4.4.1 되돌릴 조건 1 또는 3의 성립」**으로 바뀐다. **즉 우리가 물어서 알게 되는 것이 아니라, 상대가 움직여야 알게 된다** | §4.4.1 ⓓ의 조건표 |

    > **★ ⓖ의 핵심 한 줄 — 이 절에서 없어진 것은 "판단할 재료가 들어오는 경로"이지 "판단해야 할 문제"가 아니다.** 문제(약관이 재사용을 허락하지 않은 데이터를 우리가 싣고 있다 — §9.1의 ⑤)는 그대로 있고, 그것을 해소할 경로만 없어졌다. **§9.11을 "닫힌 절"로 읽으면 안 된다.**

    **~~회신별 갈래~~ — 2026-08-28에 무효. 지우지 않는 이유는 「중지 요청」 행이 회신과 무관하게 살아 있고, 발송을 되돌리면 표 전체가 그대로 다시 쓰이기 때문이다.**

    | 회신 | 어디로 | 2026-08-28 상태 |
    |------|--------|-----------------|
    | ~~허락~~ | §4.4.1 원천 표에서 해당 사이트를 ✅로. 그 사이트 범위에서 §9.4(자체 호스팅)가 풀린다 | **무효.** ⚠️ **§9.4의 자체 호스팅을 다시 열 수 있는 유일한 경로가 이것이었다 — 사실상 영구 기각이다**(§9.4 ⓔ) |
    | ~~조건부 허락 (출처 표기 · 비영리 한정 등)~~ | 조건을 §4.4.1에 원문 그대로 적고 표를 갱신 | **무효.** 그리고 **「비영리 한정」 조건이 걸리던 대상(T3.6)도 함께 폐기됐다**(§9.1) — 이 갈래는 양쪽에서 사라졌다 |
    | ~~거절~~ | 해당 사이트를 ❌로 닫는다. 4곳이 전부 닫히면 → **ⓓ** | **무효.** ⓓ로 가는 트리거만 ⓖ-1로 옮겨갔다 |
    | ~~**무응답**~~ | → **ⓐ** · **ⓕ** | **무효.** ⚠️ **"무응답"과 "안 물음"을 같은 상태로 읽지 않는다** — 무응답은 물은 흔적이 남고 기한을 셀 수 있지만, **안 물음은 아무 기산점도 없다** |
    | **중지 요청** | 해당 원천의 데이터를 즉시 내린다. 되돌릴 수단은 T1.13 덤프 (이미지 축은 §9.4 ⓓ의 `image_url` 비우기) | ★ **살아 있다. 그리고 이 표에서 유일하게 남는 행이다** — 회신이 아니라 **상대가 먼저 접촉해 오는 경우**라 문의 폐기와 무관하다. **우리가 먼저 묻지 않기로 한 이상 외부 접촉은 이 형태로만 온다** |

    **~~ⓐ 무응답 기한을 정해야 한다.~~ → 무효 (2026-08-28).** ~~대기업 법무·홍보는 이런 문의에 대체로 답하지 않는다. **기한 없이 두면 "아직 기다리는 중"이 무기한이 되고, 결정을 미루는 것이 결정처럼 보인다.**~~ **보내지 않으므로 셀 기산점이 없다.** ⚠️ **그러나 ⓐ가 경계한 것 자체는 남는다** — 「결정을 미루는 것이 결정처럼 보인다」는 **문의를 폐기한 지금이 오히려 더 걸리기 쉬운 상태다.** 차이는 하나다: 무응답은 **기다리는 중**이었고 지금은 **기다리지 않기로 정한 것**이다. **후자는 결정이므로 §0 결정표와 §4.4.1 ⓓ에 명시로 남긴다** — 그것이 이 미끄러짐을 막는 방법이다.

    **ⓑ 묻는 데에는 비용이 있고, 알고 선택했다. → 🚨 2026-08-28 이후 이 절의 중심 문장이다.** 거절 회신을 받고도 진행하면 **애초에 묻지 않았을 때보다 위치가 나빠진다.** 그럼에도 물으려 한 이유는 둘이었다 — **묻지 않는다고 해서 합법이 되는 것이 아니고**, §4.4.1의 근거가 "금지 근거를 찾지 못함"이라 **그 공백을 메울 방법이 문의뿐**이었다.

    > **→ 2026-08-28에 사용자가 "묻지 않는다"를 택했다(§0.1 ⓒ).** 그 선택으로 **첫째 문장의 비용은 없어졌고, 둘째 문장의 이득도 없어졌다.** 즉 **위험이 줄어든 것이 아니라 위험을 확인할 기회가 없어진 것이다.** 이 절이 애초에 이 문단을 남긴 이유가 「나중에 "왜 굳이 물어봤나"가 나올 질문이라」였는데, **이제 반대 질문("왜 안 물었나")이 나올 자리가 됐다. 답은 여기 있다 — 사용자가 비용 쪽을 택했고, 그 대가로 공백이 영구화된다는 것을 알고 택했다**(§4.4.1 ⓓ).

    **~~ⓒ 부분 허락이 정상이다.~~ → 무효 (2026-08-28).** ~~4곳이 한꺼번에 답하지 않는다.~~ **답이 오지 않으므로 조합 자체가 없다.** 단 **"사이트 단위로 갈린다"는 구조는 남는다** — §4.4.1의 원천 표도, §9.4 ⓒ의 「그 사이트에 한해 이미지를 싣지 않는다」도 사이트 단위로 쓰여 있다. **회신이 아니라 §4.4.1 되돌릴 조건 1·3이 사이트별로 발생할 수 있다는 형태로 남는다.**

    **ⓓ 전부 막혔을 때 — 세 갈래. 지금 고르지 않는다. (2026-08-28: 진입 트리거만 바뀌었고 갈래는 그대로다 — ⓖ-1)**

    > **진입 조건이 「거절 회신 4건」에서 「§4.4.1 되돌릴 조건 1 또는 3의 성립」으로 바뀐다.** 즉 ⓓ에 들어가는 계기가 **우리가 물어서 알게 되는 것**에서 **상대가 움직여야 알게 되는 것**으로 옮겨갔다. ⚠️ **그 결과 ⓓ 진입이 "예고 없이" 일어난다** — 회신 대기 중이라면 마음의 준비가 되어 있지만, 중지 요청은 그렇지 않다. **그래서 되돌릴 수단(T1.13 덤프 · §9.4 ⓓ의 `image_url` 비우기)이 상시 동작해야 한다는 요건이 강해진다.**

    1. **사실 데이터만 남긴다** — 코드 · 레어도 · 종류 · 색 · 코스트는 사실, 카드명은 짧은 제목, **효과 텍스트는 창작적 표현**, 이미지는 명백한 저작물이다. 뒤의 둘을 빼면 노출 표면이 크게 준다. ⚠️ **다만 한국 저작권법의 데이터베이스제작자 권리는 별개 논점이다** — 개별 항목이 사실이어도 **상당 부분의 복제는 따로 걸릴 수 있고, 이건 우리가 판단할 수 없다.**
    2. **카드 DB를 호스팅하지 않는다 — 가장 견고하다.** 발상을 뒤집어 카드 데이터를 저장·배포하지 않고, **사용자가 카드명을 입력하면 그 위에서 기능만 제공**한다(시세 조회 · 덱 검증 · 컬렉션 기록). 발행사 저작물을 우리가 배포하지 않게 된다. README의 핵심 가치(SNKRDUNK식 기준가)는 살아남고 **잃는 것은 도감**이다. ⚠️ **이 갈래를 고르면 §9.3 ⓒ(메르카리 · 라쿠마 · 야후옥션 약관)가 선행이 된다** — 거래 플랫폼이라 자동화 금지 조항이 있을 가능성이 이번 4곳보다 높다.
    3. **대상 게임을 바꾼다** — 공식 API나 허용적 라이선스를 가진 TCG로. **`CLAUDE.md`가 포켓몬 + 원피스로 못박은 것이라 제품 정의를 바꾸는 결정이고, `CLAUDE.md` 개정이 따른다.**

    **ⓔ 모든 갈래에서 살아남는 것 — T2.1(시뮬레이터) · T2.2(덱 검증). ✅ 2026-08-28 구현 완료.** 순수 함수라 카드 DB가 있든 없든, 데이터를 우리가 갖든 사용자가 입력하든 똑같이 필요하다. **ⓓ-2에서도 그대로 쓰인다.** 즉 **어떤 회신이 와도 버려지지 않는 유일한 작업이고, 그래서 회신을 기다리는 동안 할 작업이다.**

    > **2026-08-28 — 근거 하나가 빠지고 결론은 남았다.** 「회신을 기다리는 동안」이라는 부분은 문의 폐기로 무효다. **그러나 ⓔ의 본체(어떤 갈래에서도 버려지지 않는다)는 회신과 무관한 성질이라 그대로다** — 오히려 **ⓓ 진입이 예고 없이 일어나게 된 지금(ⓓ의 ⚠️) "무엇을 만들어도 버려지지 않는가"라는 질문의 값이 올랐다.** 실측: 도메인 단위 56건 추가 · 전체 153건 통과 · 마이그레이션 0건.

    **ⓕ §0.1 ⓐ 조사가 이 절을 바꾼 것 — 셋 (2026-08-26).** 조사 결과는 `docs/crawler-compliance.md` §10에 있다. **여기서는 이 절의 갈래에 무엇이 달라졌는지만 적는다.**

    **1) "무응답"이 일부 대상에 대해 추정에서 문서화된 방침으로 바뀌었다.** ⓐ는 「대기업 법무·홍보는 이런 문의에 대체로 답하지 않는다」는 **경험칙**으로 무응답을 예상했다. **집영사는 그것을 문서로 적어 두었다.**

    > 「個人の方に対してキャラクター・作品利用の許諾は行っておりません。また、**個別のお問い合わせへの回答や判断・審査はいたしません**。」 (집영사)
    > 「非営利であっても画像の使用許可や素材の提供は行っておりません。また、非営利にあたるかについて、**お問い合わせをいただきましても、お答えはいたしかねます**。」 (토에이 애니메이션)

    **→ ⓐ의 "무응답 기한"이 이 두 곳에 대해서는 성격이 다르다.** 기다림의 끝이 열려 있는 것이 아니라 **답이 오지 않는다고 상대가 먼저 공지한 상태**다. **기한을 정하는 것은 여전히 사용자 몫이지만, 이 둘에 대해 긴 기한을 잡을 근거는 없다.** ⚠️ 단 **문의 대상 4곳은 카드게임 사이트들이지 집영사·토에이가 아니다** — 위 문언은 원피스 원작 IP 창구의 방침이고, `card@xosoft.kr`(원피스 한국 운영사)이 어떻게 답할지는 별개다. **두 겹을 섞지 않는다.**

    **2) 「거절」 갈래에 하나가 미리 들어와 있다 — TPCi.** ⓑ가 「거절 회신을 받고도 진행하면 애초에 묻지 않았을 때보다 위치가 나빠진다」고 적었는데, **TPCi는 묻기도 전에 약관에 거절 방침을 적어 뒀다.**

    > "Because we receive thousands of such requests, **our policy is to decline** use of our trademarks and copyrights." — <https://www.pokemon.com/us/legal/terms-of-use>

    **→ 초안 4번(포켓몬 일본)을 보낼 때 이것을 알고 보내는 것과 모르고 보내는 것은 다르다.** 갈래를 바꾸지는 않는다 — **포켓몬은 지금 원천이 아니다**(§4.4.1 결정 3). 다만 **ⓑ가 말한 "묻는 비용"이 이 대상에 대해서는 더 크다.**

    **3) ⓓ-2(카드 DB를 호스팅하지 않는다)의 전제가 약해졌다 — 가장 실질적인 변화다.**

    ⓓ-2는 「가장 견고하다」는 평가와 함께 **"도감은 잃지만 SNKRDUNK식 기준가는 살아남는다"**를 전제로 세웠고, 그 절 스스로 「이 갈래를 고르면 §9.3 ⓒ(메르카리·라쿠마·야후옥션 약관)가 선행이 된다」고 단서를 달았다. **그 선행 검토가 2026-08-26에 끝났고 결과가 좋지 않다** — §9.3 ⓒ 표대로 **세 곳 모두 공식 창구가 없고, 라쿠마·야후옥션은 `robots.txt`가 검색·낙찰이력을 지목해 막는다.**

    **→ ⓓ-2가 기각되는 것은 아니지만 "가장 견고하다"는 평가는 유지되지 않는다.** 카드 데이터를 안 갖는 대신 기대던 축이 **그 자체로 위험을 안고 있다.** ⚠️ **네 갈래(ⓓ-1·2·3 + 현행 유지)의 상대 순위를 지금 다시 매기지 않는다** — 회신이 오지 않은 상태에서 고르면 §9.11이 처음부터 피하려던 "그 자리에서 판단하기"가 된다. **기록만 남기고, 실제로 ⓓ에 들어갈 때 이 문단을 함께 읽는다.**

    **~~문의 메일 초안 수정~~ — 이력이다. 2026-08-28 오전에 1·2를 반영했고, 같은 날 발송 자체가 폐기됐다(§0.1 ⓒ).** 산출물은 `docs/permission-inquiry-drafts.md`(개정 이력과 발송 폐기 머리말이 그 문서 앞에 있다). **표를 남기는 이유는 3번(자기소개 문구)이 왜 미결로 남았는지가 §10.3의 관측과 직결되기 때문이다** — 발송을 되돌리면 그 판단이 그대로 되살아난다.

    | # | 고칠 것 | 상태 | 근거 |
    |---|---------|------|------|
    | 1 | **「향후 광고를 게재할 경우」 문단(4통 전부의 질문 4번)을 뺀다** | ✅ **뺐다.** 대신 **「현재 광고는 게재하지 않습니다」를 사실로 적었다**(§0.1 ⓑ가 지시한 표현 그대로) | §0.1 ⓑ — 애드센스를 폐기해 **사실과 다르다.** 남는 효과는 상대에게 영리 이용 의사를 먼저 알리는 것뿐이다. ⚠️ **"비영리"라고 바꿔 쓰지 않는다** — T3.6(제휴)이 로드맵에 남아 있다(§9.1) |
    | 2 | **「공식 창구가 있는지」를 묻는 문장을 넣는다** | ✅ **4통 전부 질문 5로 넣었다.** 포켓몬코리아 편은 「제휴안내」 주소가 맞는 창구인지까지 묻는다 | §0.1 ⓐ가 요구했다. **이번 조사가 그 질문의 근거를 만들었다** — 우리는 §10.7에 적은 검색 범위에서 창구를 **찾지 못했다.** "있는데 못 찾은 것인지"를 확인할 수 있는 유일한 방법이 묻는 것이다 |
    | 3 | **자기소개 문구(「개인적으로 개발 중인」·「個人で開発しております」)를 다시 본다** | ⏸ → **무효 (2026-08-28 · ⓖ).** A안(현행)·B안 둘을 문서에 남긴 상태로 동결된다 — **보낼 일이 없으므로 고를 일도 없다** | 4통 전부가 이렇게 시작한다. **집영사·토에이는 정확히 그 속성(個人)을 배제 사유로 명문화했다**(위 1번 인용). ⚠️ **숨기라는 뜻이 아니다** — 「공통 원칙」의 "숨기고 받은 허락은 나중에 무효가 된다"가 그대로 유효하다. **사실을 바꾸는 것이 아니라, 개인이라는 이유만으로 즉시 배제되지 않도록 무엇을 묻는지를 앞세우는 문제다.** **대외 커뮤니케이션의 어조라 발송 시점에 사용자가 고른다** |

    > **왜 08-26에 "범위 밖"이던 것을 08-28에 했나.** 그 문장은 **그날의 작업 범위를 말한 것이지 미뤄야 할 근거를 댄 것이 아니었다.** 반대로 미룰 때의 위험은 분명하다 — **발송은 되돌릴 수 없고**, 초안에는 폐기된 방침을 사실처럼 묻는 문단이 남아 있었다. **실현되면 이미 늦는 유형**이라 T1.13·T1.15를 앞으로 당긴 것과 같은 판단이다. 대신 **사용자 판단이 필요한 3번은 건드리지 않았다.**

    > **~~발송 전 마지막 확인 항목~~ — 반다이 창구. 무효 (2026-08-28 · ⓖ). 관측 자체는 사실이라 남긴다.** 초안 2번의 「문의 창구는 반다이 공식 문의 폼을 확인한다」는 메모에 대해 **08-26에 실제로 확인했다** — `bandai.co.jp/information/`의 카테고리는 商品サポート · 報道関係 · **企業コラボ** 셋뿐이고 저작권 전용 창구가 없다. 「企業コラボ」 폼은 스스로 범위를 「新規ビジネス、商品化権、**企業間**コラボレーション」이라 적었다(§10.2 ⓐ). **BANDAI CARD GAMES 쪽 창구(`sec.carddass.com/club/docs/contact/`)도 저작권 카테고리가 없다.** → **어느 폼으로 보낼지를 발송 시점에 정해야 한다. "폼을 찾으면 된다"가 아니다.** 이 경고는 08-28에 초안 2번 머리말로도 옮겨 적었다 — **초안만 열어 보는 사람이 놓치지 않게 한다.**

    > 이 절은 회신 유형별로 **어디로 가는지만** 적은 것이다. `docs/crawler-compliance.md`와 같은 기준으로 **법률 자문이 아니며**, 각 갈래를 실제로 고르는 판단은 그 시점에 사용자가 한다.
