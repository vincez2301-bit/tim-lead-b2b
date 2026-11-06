-- Test: nhập danh sách tên công ty trả về company_ids; run find_website; liên hệ nguồn google.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009a1', 'fw-admin@example.com');
update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000009a1';
insert into public.companies (id, name, domain) values ('90000000-0000-0000-0000-000000000001', 'Sóng Việt Media', 'songviet.vn');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
create temp table r as select public.import_leads(
  '[{"name":"sóng việt media"},{"name":"Công ty TNHH Phim Mới","city":"TP.HCM"},{"name":"Công ty TNHH Phim Mới","city":"TP.HCM"},{"name":"  "}]'::jsonb) as v;
reset role;
select pg_temp.ok((select (v->>'companies_created')::int = 1 and (v->>'companies_matched')::int = 2 and (v->>'skipped_invalid')::int = 1 from r), 'thống kê nhập');
select pg_temp.ok((select jsonb_array_length(v->'company_ids') = 2 from r), 'company_ids không trùng');
select pg_temp.ok((select v->'company_ids' ? '90000000-0000-0000-0000-000000000001' from r), 'có công ty đã gộp');
select pg_temp.ok((select count(*) = 2 from public.deals d join r on r.v->'company_ids' ? d.company_id::text), 'mỗi công ty có deal');

-- Bước mới và nguồn liên hệ mới.
insert into public.runs (owner_id, step) values ('00000000-0000-0000-0000-0000000009a1', 'find_website');
insert into public.contacts (company_id, phone, source) values ('90000000-0000-0000-0000-000000000001', '028 3838 3838', 'google');
do $$ begin
  begin
    insert into public.contacts (company_id, phone, source) values ('90000000-0000-0000-0000-000000000001', '1', 'web');
    raise exception 'FAIL: nhận nguồn liên hệ lạ';
  exception when check_violation then null;
  end;
end $$;

rollback;
\o
\echo 'tests/sql/90_find_website_test.sql: OK'
