-- 005: 기본 코드(base_code) — 대체 카드 판정 기준
-- 근거: plan.md §4.6 · T1.8
--
-- 같은 카드의 다른 인쇄본(패러렐 · 다른 일러스트)은 게임상 동일하므로
-- 서로 대체 가능하다. 플레이어는 그중 가장 싼 것을 사면 된다.
--
--   OP17-001      루피 (일반)
--   OP17-001_p1   루피 (패러렐)
--   OP17-001_p2   루피 (SEC)
--
-- 판정은 코드에서 밑줄 뒤 접미사를 뗀 값으로 한다.
-- 생성 컬럼으로 두는 이유:
--   * 앱 로직에 흩어지지 않는다. 코드가 바뀌면 자동으로 따라간다.
--   * 인덱스를 걸 수 있어 대체 카드 조회가 인덱스 스캔이 된다.
--
-- ⚠️ 코드 규칙: 밑줄(_)은 **다른 인쇄본을 구분하는 용도로만** 쓴다.
--    일반 카드 코드에 밑줄을 넣으면 의도치 않게 묶인다.

alter table public.cards
  add column base_code text
  generated always as (split_part(code, '_', 1)) stored;

comment on column public.cards.base_code is
  '코드에서 인쇄본 접미사(_p1 등)를 뗀 값. 대체 카드 판정 기준 (plan §4.6)';

create index cards_base_code_idx on public.cards (game_id, base_code);
