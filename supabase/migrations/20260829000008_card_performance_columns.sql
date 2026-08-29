-- 008: 카드 성능 컬럼 + name_ja nullable 복귀
-- 근거: plan.md §4.8 ⓗ (스키마 공백 8건 판정 — "셋 + 하나"로 갈린 것 중 T1.17이
--   닫는 나머지) · §4.8 ⓕ (name_ja nullable 복귀, ★★, 2026-08-28 판정)
--
-- 원천(onepiece-cardgame.kr) 실측 근거: T1.16 첫 수집 [OPK-14] 전량
-- (data/catalog/opcg/OPK-14/cards.jsonl, 160행 · 8페이지 · 고유 code 160개).
-- 전 필드는 CollectedCard(src/lib/catalog/types.ts)로 문자열 그대로 옮겨졌고,
-- 아래 컬럼 코멘트의 실측값은 그 파일을 직접 집계한 결과다(2026-08-29).
--
-- ⚠️ 이 마이그레이션이 정하지 않는 것 — 둘 다 T1.18(임포터)의 몫이다.
--  * life/cost 분배 로직 — cardType이 어느 값이면 어느 컬럼에 쓰는가. 이
--    마이그레이션은 그릇(컬럼) 두 개만 만든다.
--  * card_type이 알려진 값 밖일 때 invalid로 볼지 — 판정 규칙 자체.
--    🚨 새로 드러난 관측 하나를 여기 남긴다: OPK-14 160행에는 "스테이지"
--    타입이 1건 있다(OP14-039, 관선). 지금까지 plan.md는 "스테이지는 두
--    페이지 관측에서 안 나왔다"고 적어 왔으나, 전량(8페이지) 확인 결과
--    실존한다. life/cost 어느 쪽인지, invalid 목록에 넣을지는 여기서 정하지
--    않는다 — T1.18이 정한다.

alter table public.cards
  add column colors           text[],
  add column life              integer,
  add column cost              integer,
  add column power             integer,
  add column counter           integer,
  add column traits            text[],
  add column trigger_text      text,
  add column illustration_type text,
  add column block_number      integer,
  add column source_image_url  text;

comment on column public.cards.colors is
  '카드 색. 원천 cardColor(쉼표 구분 문자열)를 배열로 옮긴다. 실측(OPK-14 160행): 단색 6종(적색·청색·황색·녹색·자색·흑색) + 다색 2종(청색,황색 · 흑색,황색), 구분자는 쉼표(공백 없음). T2.5 어댑터가 DeckSlot을 채우는 데 쓴다(plan §4.7 ⓕ · §4.8 ⓗ #2)';

comment on column public.cards.life is
  '리더의 라이프. 원천 life(=lifeRaw), cardType=리더일 때만 유효하다. 실측: 리더 14장, 값은 4 또는 5뿐이다. 🚨 cost와 원천 칸(life)을 공유한다 — cardType으로 어느 컬럼에 넣을지 가르는 분배 로직은 T1.18(임포터 normalize.ts)의 몫이고 이 마이그레이션은 그릇만 만든다(plan §4.8 ⓗ #8 발견 A)';

comment on column public.cards.cost is
  '리더가 아닌 카드(캐릭터·이벤트 등)의 코스트. 원천 life(=lifeRaw), cardType이 리더가 아닐 때. 실측: 1~10. 🚨 life와 합치지 않는다 — 합치면 "코스트 4 이하" 필터가 라이프 4인 리더를 함께 잡는 조용한 오적재가 된다. 분배 로직은 life와 마찬가지로 T1.18의 몫(plan §4.8 ⓗ #8 발견 A)';

comment on column public.cards.power is
  '파워. 원천 power(=powerRaw). "-"는 null로 옮긴다(리더가 아닌 카드도 값이 없을 수 있다). 실측 고유값: "-" 포함 1000 단위로 0~12000(plan §4.8 ⓗ #3)';

comment on column public.cards.counter is
  '카운터 값. 원천 cardCounter(=counterRaw). 실측 고유값: "-" · "1000" · "2000"뿐이다(plan §4.8 ⓗ #3)';

comment on column public.cards.traits is
  '원피스 特徴(카드 포인트). 원천 cardPoint(=traitsRaw, 슬래시 구분 문자열)를 배열로 옮긴다. sub_type에는 넣지 않는다 — sub_type은 basic_energy 판정 전용 단일 텍스트로 이미 확정돼 있다(plan §4.0). 실측: OPK-14 160행에서 고유 조합 57종(예: "왕의 부하 칠무해/초신성/하트 해적단")(plan §4.8 ⓗ #4)';

comment on column public.cards.trigger_text is
  '트리거 효과 텍스트. 원천 cardTrigger(=triggerText). 효과 텍스트의 일종이라 JSONB에 묻지 않는다 — 향후 효과 텍스트 검색(백로그 C-2) 대상이 될 값이다. 실측: 160행 중 125행이 빈 값, 나머지 35행에 고유 텍스트 13종(예: "【트리거】카드를 1장 뽑는다.")(plan §4.8 ⓗ #5)';

comment on column public.cards.illustration_type is
  '일러스트 구분. 원천 animationType. 실측 고유값: "오리지널" · "원작"뿐이다. 같은 카드의 다른 일러스트를 가르는 축이라 §4.6 base_code 대체 카드 화면과 붙는다(plan §4.8 ⓗ #6)';

comment on column public.cards.block_number is
  '블록 아이콘(레귤레이션) 번호. 원천 blockNumber(=blockNumberRaw). 실측 고유값: "2" · "3" · "4"뿐이다(plan §4.8 ⓗ #7)';

comment on column public.cards.source_image_url is
  '원천 절대 이미지 URL 보관용. image_url(우리 자체 호스팅 경로, plan §9.4 ⓕ)과는 서로 다른 값이다 — 핫링크 재발을 막기 위해 src/types/card.ts의 CardListItem·CardDetail에는 이 필드를 넣지 않는다. nullable — 이미지 업로더(T1.22)가 채운다(plan §9.4 ⓕ-5)';

-- ─────────────────────────────────────────────────────────────
-- name_ja nullable 복귀 (plan §4.8 ⓕ ★★, 2026-08-28 판정)
--
-- 002가 name_ja를 not null로 만든 것은 그때 옳았다(메르카리 검색 키 확보).
-- 지금 되돌리는 이유: 유일 원천(onepiece-cardgame.kr)이 한국어명만 주고
-- 일본어명은 별도 관측이 필요하다는 것이 실측됐다(plan §4.8 ⓙ-1). "한국어명을
-- 채운다"는 여전히 선택지가 아니므로(name_ja는 여전히 §5.3 매물 크롤러의
-- 검색 키다) 대신 "둘 중 하나는 있어야 한다"로 완화한다.
-- ─────────────────────────────────────────────────────────────
alter table public.cards alter column name_ja drop not null;

alter table public.cards add constraint cards_name_present_ck
  check (name_ko is not null or name_ja is not null);

comment on column public.cards.name_ja is
  '일본어 카드명. §5.3 매물 크롤러의 유일한 검색 키(그대로 유지). T1.17에서 nullable로 되돌렸다 — 유일 원천이 일본어명을 주지 않는 카드가 실측됐다(plan §4.8 ⓙ-1). 🚨 한국어명으로 채우지 않는다 — cards_name_present_ck가 "둘 중 하나"만 보장한다(plan §4.8 ⓕ ★★)';

comment on constraint cards_name_present_ck on public.cards is
  'name_ja의 not null이 지키던 "표기가 항상 있다"를 약한 제약으로 옮긴 것. UI 표기는 coalesce(name_ko, name_ja)이므로 둘 다 null이면 카드 이름이 빈칸으로 나온다(plan §4.8 ⓗ)';
