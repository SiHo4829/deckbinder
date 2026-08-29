-- 010: 원피스 카드게임 KR·JP 판 분리
-- 근거: plan.md §4.12(원피스 KR·JP 판 분리 — 스키마 설계) · §8 로드맵 T1.26
--
-- 설계 메모
--  * 별도 games 행으로 판을 가른다. 기존 opcg 행의 id(uuid)는 보존하고
--    code·name_ko만 바꿔 KR판으로 재명명한다 — card_sets.game_id가
--    uuid를 참조하므로 이미 입력된 세트 40행이 자동으로 opcg-kr 소속이 된다.
--  * ptcg는 가르지 않는다 — 원천이 아직 미정이다(§4.4.1 결정 3).
--  * opcg-jp 행은 비어 있다. JP 카드 수집·적재는 이번 범위가 아니다(§4.12 ⓘ-1).
--  * cards·card_sets·keywords·card_keywords·similar_groups 테이블 정의·제약·
--    인덱스와 004의 검색 함수 2개는 손대지 않는다 — g.code = p_game_code 비교는
--    새 코드 문자열로도 그대로 옳다.

-- 1. 기존 열거 check 제약 drop (실제 이름: games_code_check — \d public.games로 확인)
alter table public.games drop constraint games_code_check;

-- 2. 기존 opcg 행을 opcg-kr로 재명명한다. id는 바꾸지 않는다.
update public.games
set code = 'opcg-kr', name_ko = '원피스 카드 게임 (한국판)'
where code = 'opcg';

-- 3. 새 열거 check 제약 — 값만 넓힌다 (순서 중요: 1 → 2 → 3)
alter table public.games add constraint games_code_check
  check (code in ('ptcg', 'opcg-kr', 'opcg-jp'));

-- 4. opcg-jp 행 신규 삽입. 룰 수치 3개는 KR과 동일 — §4.12 ⓓ가 중복을 판정한 자리.
insert into public.games (code, name_ko, name_ja, deck_size, hand_size, copy_limit)
values
  ('opcg-jp', '원피스 카드 게임 (일본판)', 'ONE PIECE カードゲーム', 50, 5, 4)
on conflict (code) do nothing;

-- 5. base_game 생성 컬럼 — 붙임표 앞부분(기본 게임 코드)을 SQL에서 바로 쓰기 위한 훅.
--    §4.6의 base_code와 같은 수법. 3행짜리 참조 테이블이라 인덱스는 만들지 않는다.
alter table public.games
  add column base_game text generated always as (split_part(code, '-', 1)) stored;

comment on column public.games.base_game is
  '판 접미사를 제거한 기본 게임 코드(예: opcg-kr → opcg). games.code에서 생성됨';

-- 6. code 컬럼 코멘트 갱신 — 붙임표 컨벤션을 스키마에 남긴다.
comment on column public.games.code is
  '게임/판 식별자. 형식 <기본게임>[-<판 ISO 3166-1 alpha-2>] (예: ptcg, opcg-kr, opcg-jp). '
  '판이 하나뿐인 게임은 접미사를 붙이지 않는다. 붙임표(-)는 판 접미사 전용이다.';
