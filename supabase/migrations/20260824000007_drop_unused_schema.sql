-- 007: 죽은 스키마 제거 + 커서 안정성 수정
-- 근거: plan.md §2.7 (일본어 tsvector 포기) · §4.6 (대체 카드 = base_code)
--
-- 001에서 만든 두 구조가 이후 설계 변경으로 쓰이지 않게 됐는데 비용만 계속 낸다.
--  * search_vector — 002 이후 검색은 name_ja/name_ko의 ilike + pg_trgm만 쓴다.
--    'simple' 사전은 공백으로 토큰을 나누는데 일본어에는 공백이 없어 카드명 전체가
--    토큰 1개가 된다. 부분일치가 성립하지 않아 004의 search_cards는 이 컬럼을
--    조회하지 않는다. 그런데도 insert/update마다 트리거가 돌고 GIN 인덱스가 갱신된다.
--  * similar_groups — §4.6에서 대체 카드를 base_code(005의 생성 컬럼)로 판정하기로
--    확정했다. 행이 하나도 없고 등록 화면도 없다.
--
-- 앱 코드는 둘 다 참조하지 않는다(생성 타입 src/types/database.ts에만 등장).

-- ─────────────────────────────────────────────────────────────
-- (0) search_cards 구버전 제거
--
-- 아래에서 p_cursor_id를 추가한다. create or replace는 인자 목록이 다르면
-- 교체가 아니라 **오버로드 생성**이라, 구버전을 먼저 지우지 않으면 함수가 둘이 되고
-- PostgREST 호출이 모호해진다.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.search_cards(
  text, text, uuid, text, text, text, text[], text, integer
);

-- ─────────────────────────────────────────────────────────────
-- (1) search_vector 일체
-- ─────────────────────────────────────────────────────────────
drop trigger if exists cards_search_vector_refresh_trigger on public.cards;
drop function if exists public.cards_search_vector_refresh();
drop index if exists public.cards_search_vector_idx;
alter table public.cards drop column if exists search_vector;

-- ─────────────────────────────────────────────────────────────
-- (2) similar_groups 일체
-- 테이블을 지우면 RLS 정책과 GRANT도 함께 사라진다.
-- ─────────────────────────────────────────────────────────────
alter table public.cards drop constraint if exists cards_similar_group_same_game_fk;
drop index if exists public.cards_similar_group_idx;
alter table public.cards drop column if exists similar_group_id;
drop table if exists public.similar_groups;

-- ─────────────────────────────────────────────────────────────
-- (3) search_cards 재생성 — 커서에 id를 더한다
--
-- 구버전은 `order by c.code` + `c.code > p_cursor`로 페이지를 넘겼다.
-- 그런데 cards의 유니크 제약은 unique (game_id, code)로 **code 단독이 아니다**.
-- 게임 필터 없이 훑을 때 두 게임에 같은 code가 있으면 `c.code > p_cursor`가
-- 뒤 카드를 건너뛴다 — 에러도 빈 화면도 없이 카드 한 장이 조용히 사라진다.
--
-- (code, id) 튜플로 정렬·비교하면 정렬 키가 유일해져 건너뜀이 사라진다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.search_cards(
  p_q             text     default null,
  p_game_code     text     default null,
  p_set_id        uuid     default null,
  p_rarity        text     default null,
  p_attribute     text     default null,
  p_card_type     text     default null,
  p_keyword_codes text[]   default null,
  p_cursor        text     default null,
  p_cursor_id     uuid     default null,
  p_limit         integer  default 40
)
returns table (
  id         uuid,
  code       text,
  name_ko    text,
  name_ja    text,
  rarity     text,
  attribute  text,
  card_type  text,
  sub_type   text,
  image_url  text,
  set_id     uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id, c.code, c.name_ko, c.name_ja, c.rarity,
    c.attribute, c.card_type, c.sub_type, c.image_url, c.set_id
  from public.cards c
  join public.games g on g.id = c.game_id
  where
    (p_game_code is null or g.code = p_game_code)
    and (p_set_id    is null or c.set_id    = p_set_id)
    and (p_rarity    is null or c.rarity    = p_rarity)
    and (p_attribute is null or c.attribute = p_attribute)
    and (p_card_type is null or c.card_type = p_card_type)
    -- (code, id)는 유일하므로 커서가 안정적이다. id를 안 주면 code 동률의 첫 장부터 준다.
    and (
      p_cursor is null
      or (c.code, c.id) > (
           p_cursor,
           coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid)
         )
    )
    -- 일본어는 공백이 없어 tsvector 부분일치가 안 된다. pg_trgm 인덱스를 타는 ilike를 쓴다.
    and (
      p_q is null
      or c.name_ja ilike '%' || p_q || '%'
      or c.name_ko ilike '%' || p_q || '%'
    )
    -- 선택한 키워드를 모두 가진 카드만 남긴다(AND).
    and (
      p_keyword_codes is null
      or cardinality(p_keyword_codes) = 0
      or (
        select count(distinct k.code)
        from public.card_keywords ck
        join public.keywords k on k.id = ck.keyword_id
        where ck.card_id = c.id
          and k.code = any(p_keyword_codes)
      ) = cardinality(p_keyword_codes)
    )
  order by c.code, c.id
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

comment on function public.search_cards is
  '도감 검색. 키워드는 AND(모두 보유) 조건이며, 커서는 (code, id) 튜플이다.';

-- ─────────────────────────────────────────────────────────────
-- (4) 권한 — 새 시그니처에 다시 부여한다 (RLS와 별개, §4.1-1과 같은 이유)
-- ─────────────────────────────────────────────────────────────
revoke all on function public.search_cards(
  text, text, uuid, text, text, text, text[], text, uuid, integer
) from public;

grant execute on function public.search_cards(
  text, text, uuid, text, text, text, text[], text, uuid, integer
) to anon, authenticated, service_role;
