-- Test: lịch tiếp cận bắt đầu bằng email; nội dung soạn sẵn đổi số bước khớp theo.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

select pg_temp.ok((select value->0->>'channel' from public.settings where key = 'cadence') = 'email', 'bước 1 là email');
select pg_temp.ok((select (value->0->>'step')::int from public.settings where key = 'cadence') = 1, 'số bước vẫn bắt đầu từ 1');
select pg_temp.ok((select value->1->>'channel' from public.settings where key = 'cadence') = 'linkedin', 'bước 2 là LinkedIn');
select pg_temp.ok((select value->11->>'title' from public.settings where key = 'cadence') like 'Email: xin phép tạm dừng%', 'lịch khớp bộ email v4');
select pg_temp.ok(jsonb_array_length((select value from public.settings where key = 'cadence')) = 19, 'vẫn đủ 19 bước');
select pg_temp.ok((select bool_and(e->>'channel' = 'email') from public.settings s, jsonb_array_elements(s.value) e
                   where s.key = 'message_templates' and (e->>'step')::int = 1), 'mẫu bước 1 đều là email');
select pg_temp.ok((select count(*) from public.settings s, jsonb_array_elements(s.value) e
                   where s.key = 'message_templates' and (e->>'step')::int = 1) = 5, '5 email mở lời theo nhóm khách');
select pg_temp.ok((select e->>'channel' from public.settings s, jsonb_array_elements(s.value) e
                   where s.key = 'message_templates' and (e->>'step')::int = 2) = 'linkedin', 'mẫu bước 2 là LinkedIn');
select pg_temp.ok((select jsonb_array_length(value) from public.settings where key = 'message_templates') = 24, 'đủ 24 mẫu (20 mẫu v4 + 4 mẫu chặng chốt)');
select pg_temp.ok((select count(*) from public.settings s, jsonb_array_elements(s.value) e
                   where s.key = 'message_templates' and e->>'channel' = 'email' and e ? 'subject') = 14, 'email nào cũng có tiêu đề');
select pg_temp.ok((select bool_and((e->>'version')::int >= 4) from public.settings s, jsonb_array_elements(s.value) e
                   where s.key = 'message_templates'), 'đang dùng bộ v4');
select pg_temp.ok((select bool_and(e->>'body' like 'Kính gửi {xung_ho},%') from public.settings s, jsonb_array_elements(s.value) e
                   where s.key = 'message_templates' and e->>'channel' = 'email'), 'email mở đầu trang trọng');


-- apply_sales_defaults_v3: chỉ admin.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000005a1', 'v3-admin@example.com'), ('00000000-0000-0000-0000-0000000005b1', 'v3-user@example.com');
update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000005a1';
update public.settings set value = '[{"step":1,"day":0,"channel":"linkedin","title":"cũ"}]' where key = 'cadence';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005b1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.apply_sales_defaults();
    raise exception 'FAIL: user thường áp dụng được';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
select public.apply_sales_defaults();
reset role;
select pg_temp.ok((select value->0->>'channel' from public.settings where key = 'cadence') = 'email', 'admin áp dụng lại bộ mới nhất');

rollback;
\o
\echo 'tests/sql/50_email_first_test.sql: OK'
