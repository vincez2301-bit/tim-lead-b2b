-- Test: mỗi lượt tìm ghi lại danh sách công ty (run_companies) và RLS theo chủ lượt chạy.
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'run-owner@example.com'),
  ('00000000-0000-0000-0000-0000000000e1', 'other@example.com');
insert into public.runs (id, owner_id, step) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 'discover'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d1', 'discover');
insert into public.companies (name, domain, segment) values ('Cũ', 'cu.vn', 'agency');

select * from public.upsert_companies(
  '[{"name":"Mới","domain":"moi.vn","segment":"mcn","source":"search"},
    {"name":"Cũ","domain":"cu.vn","segment":"agency","source":"search"},
    {"name":"Không web","domain":null,"city":"TP.HCM","source":"maps"}]'::jsonb,
  '30000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.run_companies where run_id = '30000000-0000-0000-0000-000000000001') = 3, 'ghi đủ 3 công ty của lượt tìm');
select pg_temp.ok((select count(*) from public.run_companies where run_id = '30000000-0000-0000-0000-000000000001' and is_new) = 2, '2 công ty mới');
select pg_temp.ok((select not is_new from public.run_companies rc join public.companies c on c.id = rc.company_id where c.domain = 'cu.vn'), 'công ty đã có đánh dấu không mới');

-- Lượt tìm thứ hai tìm lại công ty cũ: vẫn hiện trong kết quả của lượt đó.
select * from public.upsert_companies('[{"name":"Mới","domain":"moi.vn","source":"search"}]'::jsonb, '30000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.run_companies where run_id = '30000000-0000-0000-0000-000000000002') = 1, 'lượt 2 có 1 công ty');
select * from public.upsert_companies('[{"name":"Mới","domain":"moi.vn","source":"search"}]'::jsonb, '30000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.run_companies where run_id = '30000000-0000-0000-0000-000000000002') = 1, 'không ghi trùng');
select * from public.upsert_companies('[{"name":"Lẻ","domain":"le.vn","source":"manual"}]'::jsonb, null);
select pg_temp.ok((select count(*) from public.run_companies rc join public.companies c on c.id = rc.company_id where c.domain = 'le.vn') = 0, 'không có run thì không ghi');

-- RLS: chủ lượt chạy đọc được, người khác không; client không ghi được.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.ok((select count(*) from public.run_companies) = 4, 'chủ lượt chạy thấy kết quả');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok((select count(*) from public.run_companies) = 0, 'người khác không thấy');
do $$ begin
  begin
    insert into public.run_companies (run_id, company_id) select '30000000-0000-0000-0000-000000000001', id from public.companies limit 1;
    raise exception 'FAIL: client ghi được run_companies';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Xoá công ty → xoá dòng kết quả.
delete from public.companies where domain = 'moi.vn';
select pg_temp.ok((select count(*) from public.run_companies where run_id = '30000000-0000-0000-0000-000000000002') = 0, 'xoá công ty kéo theo kết quả');

rollback;
\o
\echo 'tests/sql/30_run_companies_test.sql: OK'
