-- Test: bộ email mẫu v7 + lịch v6 (spec 004); chỉ áp dụng khi admin bấm “Dùng bộ mới”, có sao lưu, đổi tên việc đang hẹn.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

create temp table v7 as select public.default_message_templates_v7() as v;
create temp table c6 as select public.default_cadence_v6() as v;
select pg_temp.ok((select jsonb_array_length(v) = 38 from v7), 'v7 đủ 38 mẫu');
select pg_temp.ok((select bool_and((t->>'version')::int = 7) from v7, jsonb_array_elements(v7.v) t), 'mọi mẫu là v7');
select pg_temp.ok((
  select count(*) = 30 and count(distinct (t->>'step') || (t->>'segment')) = 30 from v7, jsonb_array_elements(v7.v) t
  where (t->>'step')::int between 1 and 6 and t->>'segment' in ('broadcaster','mcn','agency','film','brand')
), '6 email × 5 nhóm khách, không trùng');
select pg_temp.ok((
  select bool_and(t->>'subject' = 'Re: {tieu_de_dau}') from v7, jsonb_array_elements(v7.v) t where (t->>'step')::int between 2 and 6
), 'email theo dõi trả lời cùng luồng');
select pg_temp.ok((
  select bool_and(t->>'subject' like '{cong_ty}:%' and t->>'body' like '%{cau_rieng}%' and t->>'body' like '%P.S.%'
                  and t->>'body' like '%55.000+%')
  from v7, jsonb_array_elements(v7.v) t where (t->>'step')::int = 1
), 'email mở lời: tiêu đề có tên công ty, câu riêng, số liệu, P.S. thử nhạc');
select pg_temp.ok((
  select bool_and(t->>'body' like '%báo giá ước tính%') from v7, jsonb_array_elements(v7.v) t where (t->>'step')::int = 5
), 'email ngày 18 nói chi phí, mời báo giá ước tính');
select pg_temp.ok((
  select count(*) = 8 from v7, jsonb_array_elements(v7.v) t where (t->>'step')::int >= 13
), 'giữ 7 mẫu chặng chốt + nuôi dưỡng');
select pg_temp.ok((
  select bool_and(not (t->>'body' ~ '\{(?!(xung_ho|anh_chi|ten|cong_ty|playlist|cau_rieng|tieu_de_dau|nguoi_gui|chuc_danh|cong_ty_ban|sdt|chu_ky)\})'))
  from v7, jsonb_array_elements(v7.v) t
), 'chỉ dùng biến app tự điền');
select pg_temp.ok((select jsonb_array_length(v) = 13 from c6), 'lịch v6 vẫn 13 bước');
select pg_temp.ok((select v->4->>'title' = 'Email theo dõi 4: chi phí tính thế nào' and v->1->>'title' = 'Email theo dõi 1: nếu video bị claim thì sao' from c6),
  'đổi tên email ngày 3 và 18');
select pg_temp.ok((select bool_and(e->>'channel' = 'email') from c6, jsonb_array_elements(c6.v) e), 'lịch v6 chỉ email');

select pg_temp.ok(not has_function_privilege('anon', 'public.default_message_templates_v7()', 'execute'), 'anon không gọi được');
-- Migration không tự thay bộ đang dùng.
select pg_temp.ok((select value->0->>'version' = '6' from public.settings where key = 'message_templates'), 'bộ đang dùng giữ nguyên tới khi bấm');

-- Bấm “Dùng bộ mới”: chỉ admin; sao lưu bản đang dùng; việc đang hẹn đổi theo tên mới.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000007a1', 'v7-admin@example.com'),
  ('00000000-0000-0000-0000-0000000007b1', 'v7-user@example.com');
update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000007a1';
insert into public.companies (id, name) values ('00000000-0000-0000-0000-00000000f701', 'V7 One');
insert into public.deals (id, company_id, stage, next_action, next_action_at) values
  ('00000000-0000-0000-0000-00000000d701', '00000000-0000-0000-0000-00000000f701', 'outreach',
   'Email theo dõi 4: đơn vị cùng ngành dùng thế nào', current_date);
create temp table before_tpl as select value from public.settings where key = 'message_templates';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007b1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.apply_sales_defaults();
    raise exception 'FAIL: user thường áp dụng được';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);
select pg_temp.ok(jsonb_array_length(public.default_message_templates_v7()) = 38, 'người đăng nhập xem trước được bộ mới');
select public.apply_sales_defaults();
select public.apply_sales_defaults(); -- bấm lại không ghi đè bản sao lưu bằng v7
reset role;
select pg_temp.ok((select value = public.default_message_templates_v7() from public.settings where key = 'message_templates'), 'đang dùng v7');
select pg_temp.ok((select value = public.default_cadence_v6() from public.settings where key = 'cadence'), 'đang dùng lịch v6');
select pg_temp.ok((select s.value = b.value from public.settings s, before_tpl b where s.key = 'message_templates_backup_v6'),
  'sao lưu đúng bộ trước đó');
select pg_temp.ok((select next_action = 'Email theo dõi 4: chi phí tính thế nào' from public.deals where id = '00000000-0000-0000-0000-00000000d701'),
  'việc đang hẹn đổi theo tên email mới');

rollback;
\o
\echo 'tests/sql/99_templates_v7_test.sql: OK'
