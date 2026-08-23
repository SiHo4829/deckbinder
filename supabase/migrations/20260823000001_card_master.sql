-- 001: 카드 마스터 스키마
-- 근거: plan.md §4.0(지원 TCG 및 게임별 룰) · §4.1(데이터 모델 · 인덱스 · RLS)
--
-- 설계 메모
--  * 대체 카드 그룹화는 CLAUDE.md 지정에 따라 cards.similar_group_id FK를 쓴다.
--  * 카드가 속한 세트/그룹은 반드시 같은 게임이어야 하므로 복합 FK로 강제한다.
--  * 전문검색은 'simple' 사전을 쓴다. 한국어/일본어는 english 스테머가 무의미하고
--    오히려 어간을 잘못 자른다. 부분일치는 pg_trgm으로 보완한다.

create extension if not exists pg_trgm with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- games — 게임별 룰의 단일 출처 (§4.0)
-- ─────────────────────────────────────────────────────────────
create table public.games (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code in ('ptcg', 'opcg')),
  name_ko    text not null,
  name_ja    text not null,
  deck_size  smallint not null check (deck_size > 0),
  hand_size  smallint not null check (hand_size > 0),
  copy_limit smallint not null check (copy_limit > 0),
  created_at timestamptz not null default now()
);

comment on table public.games is '지원 TCG와 덱 검증·시뮬레이터가 참조하는 게임별 룰';
comment on column public.games.deck_size is '메인 덱 매수 (ptcg 60 / opcg 50)';
comment on column public.games.hand_size is '첫 손패 매수 (ptcg 7 / opcg 5)';
comment on column public.games.copy_limit is '동일 카드 최대 매수. 기본 에너지는 sub_type으로 예외 처리';

-- ─────────────────────────────────────────────────────────────
-- card_sets — 발매 팩
-- ─────────────────────────────────────────────────────────────
create table public.card_sets (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  code        text not null,
  name_ko     text not null,
  name_ja     text,
  released_at date,
  created_at  timestamptz not null default now(),
  unique (game_id, code),
  -- cards의 복합 FK 대상
  unique (id, game_id)
);

-- ─────────────────────────────────────────────────────────────
-- similar_groups — 대체 카드 그룹
-- ─────────────────────────────────────────────────────────────
create table public.similar_groups (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  name       text not null,
  role_note  text,
  created_at timestamptz not null default now(),
  unique (game_id, name),
  unique (id, game_id)
);

comment on table public.similar_groups is '동일/유사 효과로 서로 대체 가능한 카드 묶음';

-- ─────────────────────────────────────────────────────────────
-- cards
-- ─────────────────────────────────────────────────────────────
create table public.cards (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games (id) on delete cascade,
  set_id           uuid,
  code             text not null,
  name_ko          text not null,
  name_ja          text,
  name_en          text,
  rarity           text,
  attribute        text,
  card_type        text,
  sub_type         text,
  image_url        text,
  effect_text      text,
  similar_group_id uuid,
  search_vector    tsvector,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (game_id, code),

  -- 세트·그룹은 카드와 같은 게임이어야 한다.
  -- MATCH SIMPLE이므로 nullable 컬럼이 NULL이면 검사하지 않는다.
  constraint cards_set_same_game_fk
    foreign key (set_id, game_id)
    references public.card_sets (id, game_id) on delete restrict,
  constraint cards_similar_group_same_game_fk
    foreign key (similar_group_id, game_id)
    references public.similar_groups (id, game_id) on delete restrict
);

comment on column public.cards.similar_group_id is '대체 카드 그룹. 카드 1장은 그룹 1개에만 속한다 (CLAUDE.md 지정)';
comment on column public.cards.sub_type is 'basic_energy면 덱 매수 제한(copy_limit)에서 면제된다';

-- ─────────────────────────────────────────────────────────────
-- keywords / card_keywords — 효과 키워드 태그 검색
-- ─────────────────────────────────────────────────────────────
create table public.keywords (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  code       text not null,
  label_ko   text not null,
  label_ja   text,
  created_at timestamptz not null default now(),
  unique (game_id, code)
);

create table public.card_keywords (
  card_id    uuid not null references public.cards (id) on delete cascade,
  keyword_id uuid not null references public.keywords (id) on delete cascade,
  primary key (card_id, keyword_id)
);

-- ─────────────────────────────────────────────────────────────
-- 트리거: search_vector 갱신 · updated_at 갱신
-- ─────────────────────────────────────────────────────────────
create or replace function public.cards_search_vector_refresh()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name_ko, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.name_ja, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.name_en, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.effect_text, '')), 'B');
  return new;
end;
$$;

create trigger cards_search_vector_refresh_trigger
  before insert or update of name_ko, name_ja, name_en, effect_text
  on public.cards
  for each row
  execute function public.cards_search_vector_refresh();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cards_touch_updated_at
  before update on public.cards
  for each row
  execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 인덱스
-- ─────────────────────────────────────────────────────────────
create index cards_search_vector_idx on public.cards using gin (search_vector);
create index cards_name_ko_trgm_idx on public.cards using gin (name_ko extensions.gin_trgm_ops);
create index cards_game_idx on public.cards (game_id);
create index cards_set_idx on public.cards (set_id);
create index cards_similar_group_idx on public.cards (similar_group_id)
  where similar_group_id is not null;

-- 키워드 교차 필터용 역방향 인덱스
create index card_keywords_keyword_idx on public.card_keywords (keyword_id, card_id);

create index card_sets_game_idx on public.card_sets (game_id);
create index keywords_game_idx on public.keywords (game_id);
create index similar_groups_game_idx on public.similar_groups (game_id);

-- ─────────────────────────────────────────────────────────────
-- RLS — 마스터 데이터는 익명 읽기 허용, 쓰기는 service_role만 (§4.1)
-- service_role은 RLS를 우회하므로 쓰기 정책을 따로 만들지 않는다.
-- ─────────────────────────────────────────────────────────────
alter table public.games enable row level security;
alter table public.card_sets enable row level security;
alter table public.similar_groups enable row level security;
alter table public.cards enable row level security;
alter table public.keywords enable row level security;
alter table public.card_keywords enable row level security;

create policy games_public_read on public.games
  for select to anon, authenticated using (true);
create policy card_sets_public_read on public.card_sets
  for select to anon, authenticated using (true);
create policy similar_groups_public_read on public.similar_groups
  for select to anon, authenticated using (true);
create policy cards_public_read on public.cards
  for select to anon, authenticated using (true);
create policy keywords_public_read on public.keywords
  for select to anon, authenticated using (true);
create policy card_keywords_public_read on public.card_keywords
  for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────
-- 테이블 권한 (GRANT)
--
-- RLS 정책만으로는 부족하다. PostgreSQL은 테이블 레벨 권한을 먼저 검사하고,
-- 통과한 뒤에야 RLS 정책으로 행을 거른다. GRANT가 없으면 정책이 아무리
-- 허용적이어도 "permission denied for table"로 막힌다.
--
-- 이 프로젝트의 기본 권한 상태에서는 anon/authenticated/service_role 모두
-- SELECT조차 없고 TRUNCATE만 붙어 있었다. TRUNCATE는 RLS를 우회하므로
-- 앱 역할에서 회수한다.
-- ─────────────────────────────────────────────────────────────
revoke all on
  public.games, public.card_sets, public.similar_groups,
  public.cards, public.keywords, public.card_keywords
  from anon, authenticated, service_role;

-- 마스터 데이터는 익명 읽기 전용
grant select on
  public.games, public.card_sets, public.similar_groups,
  public.cards, public.keywords, public.card_keywords
  to anon, authenticated;

-- 시드·배치 수집은 service_role이 담당한다 (RLS 우회 역할, TRUNCATE는 제외)
grant select, insert, update, delete on
  public.games, public.card_sets, public.similar_groups,
  public.cards, public.keywords, public.card_keywords
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 게임별 룰 투입 (§4.0) — 애플리케이션 로직이 의존하는 참조 데이터라
-- 시드가 아니라 마이그레이션에 포함한다.
-- ─────────────────────────────────────────────────────────────
insert into public.games (code, name_ko, name_ja, deck_size, hand_size, copy_limit)
values
  ('ptcg', '포켓몬 카드 게임', 'ポケモンカードゲーム', 60, 7, 4),
  ('opcg', '원피스 카드 게임', 'ONE PIECE カードゲーム', 50, 5, 4)
on conflict (code) do nothing;
