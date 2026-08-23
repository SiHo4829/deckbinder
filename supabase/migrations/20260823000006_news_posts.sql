-- 006: 뉴스 기사
-- 근거: plan.md §4.1 · T1.9 (애드센스 심사 요건)
--
-- 초안/발행 구분은 published_at 하나로 한다.
--   null           → 초안
--   과거 시각      → 공개
--   미래 시각      → 예약 발행 (RLS 조건이 자연히 처리한다)

create table public.news_posts (
  id            uuid primary key default gen_random_uuid(),
  -- URL 경로에 그대로 쓰이므로 형식을 DB에서 강제한다.
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  title         text not null,
  summary       text,
  content_md    text not null,
  thumbnail_url text,
  -- profiles는 T3.1에서 생긴다. 그때 FK로 승격한다.
  author_name   text,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.news_posts is '뉴스 기사. published_at이 null이면 초안이다.';
comment on column public.news_posts.published_at is
  'null=초안, 과거=공개, 미래=예약 발행. 공개 판정은 RLS가 한다';

-- 목록은 최신순으로만 조회한다. 초안은 인덱스에서도 뺀다.
create index news_posts_published_idx
  on public.news_posts (published_at desc)
  where published_at is not null;

-- 001에서 만든 함수를 재사용한다.
create trigger news_posts_touch_updated_at
  before update on public.news_posts
  for each row
  execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS — 초안 차단을 정책에서 한다.
-- 앱 쿼리에서 조건을 빠뜨려도 초안이 새어나가지 않는다.
-- ─────────────────────────────────────────────────────────────
alter table public.news_posts enable row level security;

create policy news_posts_public_read on public.news_posts
  for select to anon, authenticated
  using (published_at is not null and published_at <= now());

-- 권한 (§4.1-1) — RLS 정책만으로는 접근이 성립하지 않는다.
revoke all on public.news_posts from anon, authenticated, service_role;
grant select on public.news_posts to anon, authenticated;
grant select, insert, update, delete on public.news_posts to service_role;
