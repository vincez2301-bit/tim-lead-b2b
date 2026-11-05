-- Test: ngày gia hạn tự điền cho khách đã ký, và cột tìm không dấu.
\set QUIET on
\o /dev/null
begin;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'renew@example.com');
insert into public.companies (id, name, domain, segment) values
  ('40000000-0000-0000-0000-000000000001', 'Sóng Việt Studio', 'songviet.vn', 'agency'),
  ('40000000-0000-0000-0000-000000000002', 'ĐÀI TRUYỀN HÌNH A', 'daia2.vn', 'broadcaster'),
  ('40000000-0000-0000-0000-000000000003', normalize('Mây Media', NFD), 'may.vn', 'mcn');

-- ---------------------------------------------------------------- tìm không dấu
select pg_temp.ok((select name_search from public.companies where domain = 'songviet.vn') = 'song viet studio', 'bỏ dấu tên thường');
select pg_temp.ok((select name_search from public.companies where domain = 'daia2.vn') = 'dai truyen hinh a', 'bỏ dấu chữ hoa và Đ');
select pg_temp.ok((select name_search from public.companies where domain = 'may.vn') = 'may media', 'bỏ dấu dạng tách rời (NFD)');
select pg_temp.ok((select count(*) from public.company_list where name_search like '%song viet%') = 1, 'company_list có cột tìm kiếm');

-- ---------------------------------------------------------------- gia hạn
insert into public.deals (id, company_id, stage, signed_at, effective_at) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'won', '2022-11-21', '2019-02-01');
select pg_temp.ok((select renewal_at from public.deals where id = '41000000-0000-0000-0000-000000000001')
  = public.next_anniversary('2019-02-01'), 'tự điền kỳ gia hạn kế tiếp');
select pg_temp.ok((select renewal_at > current_date and to_char(renewal_at, 'MM-DD') = '02-01'
  from public.deals where id = '41000000-0000-0000-0000-000000000001'), 'kỳ gia hạn là mốc tròn năm sau hôm nay');
select pg_temp.ok(public.next_anniversary(current_date + 30) = (current_date + 30 + interval '1 year')::date, 'hiệu lực trong tương lai: +1 năm');

-- Đổi ngày hiệu lực khi ngày gia hạn còn là giá trị tự điền → tính lại.
update public.deals set effective_at = current_date + 10 where id = '41000000-0000-0000-0000-000000000001';
select pg_temp.ok((select renewal_at from public.deals where id = '41000000-0000-0000-0000-000000000001')
  = (current_date + 10 + interval '1 year')::date, 'tính lại khi đổi ngày hiệu lực');

-- Người dùng tự đặt ngày gia hạn → giữ nguyên khi đổi ngày hiệu lực.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
update public.deals set renewal_at = '2030-06-30' where id = '41000000-0000-0000-0000-000000000001';
select pg_temp.ok((select renewal_at from public.deal_board where id = '41000000-0000-0000-0000-000000000001') = '2030-06-30', 'client sửa được ngày gia hạn, deal_board có cột');
update public.deals set effective_at = current_date + 20 where id = '41000000-0000-0000-0000-000000000001';
select pg_temp.ok((select renewal_at from public.deals where id = '41000000-0000-0000-0000-000000000001') = '2030-06-30', 'giữ ngày người dùng tự đặt');
reset role;

-- Bán một lần: không có gia hạn. Deal chưa thắng: không có.
insert into public.deals (company_id, stage, effective_at, billing) values ('40000000-0000-0000-0000-000000000002', 'won', '2026-01-01', 'one_off');
select pg_temp.ok((select renewal_at is null from public.deals where company_id = '40000000-0000-0000-0000-000000000002'), 'one_off không gia hạn');
insert into public.deals (company_id, stage, effective_at) values ('40000000-0000-0000-0000-000000000003', 'proposal', '2026-01-01');
select pg_temp.ok((select renewal_at is null from public.deals where company_id = '40000000-0000-0000-0000-000000000003'), 'chưa thắng thì chưa có');
update public.deals set stage = 'won' where company_id = '40000000-0000-0000-0000-000000000003';
select pg_temp.ok((select renewal_at is not null from public.deals where company_id = '40000000-0000-0000-0000-000000000003'), 'chuyển sang thắng thì tự điền');

-- anon không đọc được view.
set local role anon;
do $$ begin
  begin
    perform 1 from public.company_list limit 1;
    raise exception 'FAIL: anon đọc được company_list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
\o
\echo 'tests/sql/40_renewal_search_test.sql: OK'
