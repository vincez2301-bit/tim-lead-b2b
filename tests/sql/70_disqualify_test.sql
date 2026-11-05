-- Test: loại lead không phù hợp — xoá deal chưa liên hệ, đóng deal đã liên hệ, khôi phục, quyền.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000007a1', 'dq@example.com');
insert into public.companies (id, name, domain, segment) values
  ('70000000-0000-0000-0000-000000000001', 'ABC Event', 'abcevent.vn', 'agency'),
  ('70000000-0000-0000-0000-000000000002', 'XYZ Sự kiện', 'xyz.vn', 'agency'),
  ('70000000-0000-0000-0000-000000000003', 'Đài OK', 'daiok.vn', 'broadcaster');
insert into public.deals (id, company_id, stage) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'new'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'outreach'),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'new');
insert into public.activities (deal_id, user_id, channel, outcome) values
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000007a1', 'email', 'done');

-- Chưa đăng nhập: không gọi được.
do $$ begin
  begin
    perform public.disqualify_companies(array['70000000-0000-0000-0000-000000000001']::uuid[], 'event');
    raise exception 'FAIL: chưa đăng nhập vẫn loại được';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.disqualify_companies(array['70000000-0000-0000-0000-000000000001']::uuid[], 'không có');
    raise exception 'FAIL: lý do lạ vẫn nhận';
  exception when invalid_parameter_value then null;
  end;
end $$;
create temp table r as select public.disqualify_companies(
  array['70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002']::uuid[], 'event', '  Chỉ làm sự kiện  ') as v;
select pg_temp.ok((select (v->>'companies')::int = 2 and (v->>'deals_removed')::int = 1 and (v->>'deals_closed')::int = 1 from r), 'kết quả loại');
select pg_temp.ok(not exists (select 1 from public.deals where id = '71000000-0000-0000-0000-000000000001'), 'deal chưa liên hệ bị xoá');
select pg_temp.ok((select stage = 'lost' and lost_reason_code = 'unqualified' from public.deals where id = '71000000-0000-0000-0000-000000000002'), 'deal đã liên hệ bị đóng');
select pg_temp.ok((select disqualify_reason = 'event' and disqualify_note = 'Chỉ làm sự kiện' from public.company_list where domain = 'abcevent.vn'), 'company_list có lý do');
select pg_temp.ok((select stage = 'new' from public.deals where id = '71000000-0000-0000-0000-000000000003'), 'công ty khác không bị đụng');
select pg_temp.ok(public.requalify_companies(array['70000000-0000-0000-0000-000000000001']::uuid[]) = 1, 'khôi phục');
select pg_temp.ok((select disqualified_at is null from public.companies where domain = 'abcevent.vn'), 'đã bỏ đánh dấu');
-- Client không sửa thẳng cột được.
do $$ begin
  begin
    update public.companies set disqualified_at = now() where domain = 'daiok.vn';
    raise exception 'FAIL: client sửa thẳng companies';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
\o
\echo 'tests/sql/70_disqualify_test.sql: OK'
