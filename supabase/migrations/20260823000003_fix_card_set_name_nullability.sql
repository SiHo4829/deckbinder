-- 003: card_sets 이름 컬럼 nullability 교정
-- 근거: plan.md §4.4
--
-- 002에서 cards만 교정했고 card_sets는 누락했다. 같은 문제가 그대로 남아 있다.
-- TCGdex(ptcg 일본어 주 원천)는 일본어 세트명만 제공하고, 한국어 세트명은
-- 공식 한국 사이트 스크래핑(T1.6b/T1.6d)으로만 부분 확보된다.
--
-- games는 2행짜리 참조 데이터이고 양쪽 이름을 직접 작성하므로 그대로 둔다.

alter table public.card_sets
  alter column name_ja set not null,
  alter column name_ko drop not null;

comment on column public.card_sets.name_ja is
  '일본어 세트명. 주 원천이 일본어이므로 필수 (plan §4.4)';
comment on column public.card_sets.name_ko is
  '한국어 세트명. 커버리지가 부분적이라 nullable. UI 표기는 coalesce(name_ko, name_ja)';
