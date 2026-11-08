-- Test: heartbeat chỉ service_role gọi được; gọi dồn dập không ghi thêm.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when insufficient_privilege then return true;
end $$;
grant execute on function pg_temp.denied(text) to anon, authenticated;

set local role anon;
select pg_temp.ok(pg_temp.denied('select public.keepalive()'), 'anon không gọi được keepalive');
reset role;
set local role authenticated;
select pg_temp.ok(pg_temp.denied('select * from public.heartbeat'), 'authenticated không đọc được heartbeat');
reset role;

set local role service_role;
select pg_temp.ok(public.keepalive() is not null, 'service_role gọi được');
select public.keepalive();
reset role;
select pg_temp.ok((select beats = 1 and id = 1 from public.heartbeat), 'gọi lại trong 1 phút không ghi thêm');
select pg_temp.ok((select count(*) = 1 from public.heartbeat), 'chỉ một dòng');

rollback;
\o
\echo 'tests/sql/96_keepalive_test.sql: OK'
