-- Test: cài đặt email nhắc việc, nhật ký gửi chỉ admin đọc, trigger không chạy khi chưa bật.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

select pg_temp.ok((public.setting('daily_digest')->>'enabled')::boolean = false, 'mặc định tắt');
select pg_temp.ok((public.setting('daily_digest')->>'hour')::int = 7, 'mặc định 7 giờ');
-- Chưa bật: hàm trả về ngay, không cần pg_net.
select public.trigger_daily_digest();
-- Bật nhưng địa chỉ function lạ: cũng không gọi.
update public.settings set value = value || '{"enabled": true, "function_url": "https://evil.example.com/x"}' where key = 'daily_digest';
select public.trigger_daily_digest();

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000006a1', 'dg-admin@example.com'), ('00000000-0000-0000-0000-0000000006b1', 'dg-user@example.com');
update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000006a1';
insert into public.digest_log (day, recipients, tasks) values (current_date, '{a@b.vn}', 3);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006b1","role":"authenticated"}', true);
select pg_temp.ok((select count(*) from public.digest_log) = 0, 'user thường không đọc được nhật ký');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select pg_temp.ok((select count(*) from public.digest_log) = 1, 'admin đọc được nhật ký');
do $$ begin
  begin
    insert into public.digest_log (day, recipients) values (current_date + 1, '{x@y.vn}');
    raise exception 'FAIL: client ghi được digest_log';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.trigger_daily_digest();
    raise exception 'FAIL: client gọi được trigger_daily_digest';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
\o
\echo 'tests/sql/60_daily_digest_test.sql: OK'
