-- 002: 카드 이름 컬럼 nullability 교정
-- 근거: plan.md §4.4 (카드 데이터 원천 실측, 2026-08-23)
--
-- 001은 name_ko를 not null, name_ja를 nullable로 정의했으나 실측 결과 정반대다.
--  * name_ja — 크롤러가 메르카리·라쿠마·야후옥션 검색어로 쓰는 유일한 키.
--    없으면 매물 조회(§5.3)가 성립하지 않으므로 필수.
--  * name_ko — 포켓몬은 공개 API 커버리지가 일본어의 2%(239/12,619)에 불과하고,
--    원피스 한글판은 2024-03 발매라 그 이전 세트에는 한국어명이 존재하지 않는다.
--    현 제약을 유지하면 포켓몬 카드의 98%를 적재할 수 없다.

alter table public.cards
  alter column name_ja set not null,
  alter column name_ko drop not null;

comment on column public.cards.name_ja is
  '일본어 카드명. 크롤러 검색 키이므로 필수 (plan §4.4)';
comment on column public.cards.name_ko is
  '한국어 카드명. 커버리지가 부분적이라 nullable. UI 표기는 coalesce(name_ko, name_ja)';

-- 001의 부분일치 인덱스는 name_ko에만 있었다. 실데이터가 name_ja에 쌓이므로
-- 일본어명에도 trigram 인덱스가 필요하다.
create index cards_name_ja_trgm_idx
  on public.cards using gin (name_ja extensions.gin_trgm_ops);
