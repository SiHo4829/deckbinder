-- 011: card-images 스토리지 버킷 생성
-- 근거: plan.md §9.4 ⓕ-2(저장 위치) · ⓕ-4(회수 절차) · ⓕ-7(webp 한 종류) · §8 로드맵 T1.28
--
-- 왜 이 마이그레이션이 있는가
--  * §9.4 ⓕ-2가 버킷을 **선언**하고 T1.21이 **지우고** T1.22가 **올리는데**,
--    2026-08-30까지 **만드는 자리가 비어 있었다**(rg로 확인 — card-images가
--    마이그레이션에도 코드에도 0건이었다). T1.28이 그 공백을 메운다.
--  * 🚨 콘솔에서 손으로 만들지 않는다. 손으로 만들면 db:reset한 로컬에 버킷이
--    없어 로컬과 원격이 갈린다 — 백로그 E-1이 경계한 어긋남과 같은 모양이고,
--    그 상태는 "typecheck는 통과하고 런타임이 틀리는" 창을 만든다(§2.7).
--
-- 이 마이그레이션이 건드리지 않는 것
--  * public 스키마의 테이블·제약·인덱스·함수 전부. 그래서 db:types의 재생성
--    diff가 0인 것이 정상이다(storage 스키마는 생성 대상이 아니다).

-- 1. 버킷 1행. 이름은 §9.4 ⓕ-2가 못박은 값이고 코드의 상수와 같아야 한다
--    (scripts/purge-images.ts의 BUCKET).
--
--    public = true인 근거: §9.4 ⓕ-4가 **서명 URL을 기각했다.** private 버킷으로
--    가면 RSC가 렌더마다 서명해야 하고, 도감 한 화면에 서명 60건이 붙는다.
--
--    allowed_mime_types를 image/webp 하나로 좁히는 근거: §9.4 ⓕ-7이 "webp 한
--    종류만" 저장하기로 정했다. 🚨 그 결정을 문서가 아니라 스키마가 지키게 한다 --
--    두 종류가 되면 회수 대상이 두 배가 되고(ⓕ-4) 대역폭 이득도 절반만 온다.
--
--    file_size_limit: 2026-08-30 T1.20 실측으로 webp 장당 평균 47KB였다.
--    5MB는 그 100배가 넘는 여유이고, 목적은 절약이 아니라 **실수로 원본(평균
--    285KB)이나 엉뚱한 파일이 대량으로 올라가는 것을 막는 상한**이다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- 2. 공개 읽기. 화면이 <img src>로 직접 가져간다(§9.4 ⓕ-6 — next/image를 쓰지 않는다).
drop policy if exists "card_images_public_read" on storage.objects;
create policy "card_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'card-images');

-- 3. 🚨 쓰기 정책을 만들지 않는다. 이것이 3번 항목의 전부다.
--
--    storage.objects는 RLS가 켜져 있고, insert/update/delete 정책이 없으면
--    anon·authenticated 키로는 아무것도 쓰지 못한다. service role은 RLS를
--    우회하므로 업로더(T1.22)와 회수(T1.21)는 그대로 동작한다.
--
--    근거: 익명 키로 업로드·삭제가 되면 **회수 절차가 우리 손을 벗어난다**
--    (§9.4 ⓕ-4 — 회수는 자체 호스팅의 대가를 감당하는 유일한 장치다).
--    ⚠️ 그러므로 이 파일에 insert/update/delete 정책을 "편의를 위해" 추가하지
--    않는다. 추가해야 할 것 같으면 §9.4 ⓕ-4로 먼저 돌아온다.
