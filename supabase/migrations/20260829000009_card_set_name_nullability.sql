-- 009: card_sets.name_ja nullable 복귀
-- 근거: plan.md §4.11 ⓔ (임포터는 card_sets를 upsert하지 않는다 — 세트 행은
--   사람이 미리 만든다) · 사용자 일감 4d (2026-08-29 승인)
--
-- 008이 cards에 한 것과 **같은 처리**를 card_sets에 한다. 판정도 같은 모양이다.
--
-- 003이 name_ja를 not null로 만든 것은 그때 옳았다 — 그때의 주 원천은
-- TCGdex(일본어)였고 한국어 세트명이 오히려 부분적이었다. 지금 뒤집는 이유는
-- 원천이 바뀌었기 때문이다: 유일 원천(onepiece-cardgame.kr)은 세트 라벨을
-- 한국어로만 준다(`[OPK-01]` · `【프로모션】` 형태 — plan §4.8 ⓙ-10 실측 41개 옵션).
--
-- 🚨 그대로 두면 사람이 한국어 라벨을 name_ja 칸에 붙여 넣게 되고, 그것이
--    §4.8 ⓕ가 cards에 대해 명시적으로 막은 오염과 같은 형태다. "일본어 칸에
--    한국어가 들어 있다"가 DB에 굳으면 나중에 진짜 일본어명을 넣을 때
--    구분할 방법이 없다.
--
-- ⚠️ 위험의 크기는 cards보다 작다 — card_sets.name_ja는 §5.3 매물 크롤러의
--    검색 키가 **아니다**(검색 키는 cards.name_ja다). 그래서 이 마이그레이션은
--    "막는 것"이 아니라 "비워 둘 수 있게 하는 것"이 목적이다.
--
-- ⚠️ 이 마이그레이션이 정하지 않는 것: 40개 세트의 일본어 정식 명칭을
--    누가 언제 채우는가. 비워 두는 것이 허용될 뿐이고, 채우는 것은 별건이다.

alter table public.card_sets alter column name_ja drop not null;

alter table public.card_sets add constraint card_sets_name_present_ck
  check (name_ko is not null or name_ja is not null);

comment on column public.card_sets.name_ja is
  '일본어 세트명. T1.18 선행 작업에서 nullable로 되돌렸다 — 유일 원천이 한국어 세트 라벨만 주기 때문이다(plan §4.8 ⓙ-10 · §4.11 ⓔ). 🚨 한국어 라벨로 채우지 않는다 — card_sets_name_present_ck가 "둘 중 하나"만 보장한다. cards.name_ja와 달리 §5.3 크롤러의 검색 키는 아니다';

comment on column public.card_sets.name_ko is
  '한국어 세트명. UI 표기는 coalesce(name_ko, name_ja). 카탈로그 원천이 주는 것은 이쪽이다(plan §4.11 ⓔ)';

comment on constraint card_sets_name_present_ck on public.card_sets is
  'name_ja의 not null이 지키던 "세트 표기가 항상 있다"를 약한 제약으로 옮긴 것. 008의 cards_name_present_ck와 같은 모양이다(plan §4.11 ⓔ · 사용자 일감 4d)';
