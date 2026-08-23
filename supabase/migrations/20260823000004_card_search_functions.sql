-- 004: 카드 검색 · 패싯 함수
-- 근거: plan.md §5.1 (도감 검색) · T1.7b (필터 확장)
--
-- 왜 SQL 함수인가
--  * 키워드 "조합" 검색은 선택한 키워드를 **모두** 가진 카드를 찾는 것이다.
--    PostgREST 쿼리 빌더로는 이 AND 교집합을 표현할 수 없다(임베드 필터는 OR가 된다).
--  * 필터 선택지(레어도·속성·종류)는 DISTINCT가 필요한데 PostgREST가 지원하지 않는다.
--
-- security invoker이므로 호출자의 RLS가 그대로 적용된다. anon은 여전히 읽기 전용이다.

-- ─────────────────────────────────────────────────────────────
-- search_cards — 도감 검색 본체
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
    -- code는 (game_id, code) 유니크라 커서 정렬 키로 안정적이다.
    and (p_cursor is null or c.code > p_cursor)
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
  order by c.code
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

comment on function public.search_cards is
  '도감 검색. 키워드는 AND(모두 보유) 조건이며, 커서는 code 기준이다.';

-- ─────────────────────────────────────────────────────────────
-- card_facets — 필터 선택지 (DISTINCT + 건수)
-- ─────────────────────────────────────────────────────────────
create or replace function public.card_facets(p_game_code text default null)
returns table (facet text, value text, card_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped as (
    select c.rarity, c.attribute, c.card_type
    from public.cards c
    join public.games g on g.id = c.game_id
    where p_game_code is null or g.code = p_game_code
  )
  select 'rarity'::text, s.rarity, count(*)
    from scoped s where s.rarity is not null group by s.rarity
  union all
  select 'attribute'::text, s.attribute, count(*)
    from scoped s where s.attribute is not null group by s.attribute
  union all
  select 'card_type'::text, s.card_type, count(*)
    from scoped s where s.card_type is not null group by s.card_type
  order by 1, 2;
$$;

comment on function public.card_facets is
  '도감 필터 선택지. PostgREST가 DISTINCT를 지원하지 않아 함수로 제공한다.';

-- ─────────────────────────────────────────────────────────────
-- 권한 — RLS와 별개로 EXECUTE를 명시적으로 준다 (§4.1-1과 같은 이유)
-- ─────────────────────────────────────────────────────────────
revoke all on function public.search_cards(
  text, text, uuid, text, text, text, text[], text, integer
) from public;
revoke all on function public.card_facets(text) from public;

grant execute on function public.search_cards(
  text, text, uuid, text, text, text, text[], text, integer
) to anon, authenticated, service_role;
grant execute on function public.card_facets(text) to anon, authenticated, service_role;
