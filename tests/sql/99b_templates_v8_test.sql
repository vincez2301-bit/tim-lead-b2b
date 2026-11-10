-- Test: bộ email mẫu v8 (v7 trau chuốt câu chữ); tự thay khi bộ đang dùng còn nguyên v7, giữ nguyên nếu đã sửa.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

create temp table v8 as select public.default_message_templates_v8() as v;
select pg_temp.ok((select jsonb_array_length(v) = 38 from v8), 'v8 đủ 38 mẫu');
select pg_temp.ok((select bool_and((t->>'version')::int = 8) from v8, jsonb_array_elements(v8.v) t), 'mọi mẫu là v8');
select pg_temp.ok((
  select count(distinct (t->>'step') || (t->>'segment')) = 30 from v8, jsonb_array_elements(v8.v) t
  where (t->>'step')::int between 1 and 6 and t->>'segment' in ('broadcaster','mcn','agency','film','brand')
), '6 email × 5 nhóm khách');
select pg_temp.ok((
  select bool_and(t->>'subject' = 'Re: {tieu_de_dau}') from v8, jsonb_array_elements(v8.v) t where (t->>'step')::int between 2 and 6
), 'email theo dõi trả lời cùng luồng');
select pg_temp.ok((
  select bool_and(t->>'body' like '%{cau_rieng}%' and t->>'body' like '%P.S.%' and t->>'body' like '%55.000%' and t->>'subject' like '%{cong_ty}%')
  from v8, jsonb_array_elements(v8.v) t where (t->>'step')::int = 1
), 'email mở lời giữ đủ thông tin của v7');
select pg_temp.ok((
  select bool_and(t->>'body' like 'Kính gửi {xung_ho},%' and t->>'body' like '%Trân trọng,%{chu_ky}') from v8, jsonb_array_elements(v8.v) t
), 'mở đầu và chữ ký trang trọng');
select pg_temp.ok((
  select bool_and(not (t->>'body' ~ '(^|[.!?] |\n)\{anh_chi\}')) from v8, jsonb_array_elements(v8.v) t
), 'không câu nào bắt đầu bằng {anh_chi} (sẽ thành chữ thường đầu câu)');
select pg_temp.ok((
  select bool_and(not (t->>'body' ~ '\{(?!(xung_ho|anh_chi|ten|cong_ty|playlist|cau_rieng|tieu_de_dau|nguoi_gui|chuc_danh|cong_ty_ban|sdt|chu_ky)\})'))
  from v8, jsonb_array_elements(v8.v) t
), 'chỉ dùng biến app tự điền');
select pg_temp.ok(not has_function_privilege('anon', 'public.default_message_templates_v8()', 'execute'), 'anon không gọi được');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.upgrade_templates_v8()', 'execute'), 'người dùng không gọi hàm nâng cấp');

-- Bộ đang dùng nguyên bản v7 → tự thay bằng v8, có sao lưu.
update public.settings set value = public.default_message_templates_v7() where key = 'message_templates';
select pg_temp.ok(public.upgrade_templates_v8(), 'nâng cấp khi còn nguyên v7');
select pg_temp.ok((select value = public.default_message_templates_v8() from public.settings where key = 'message_templates'), 'đang dùng v8');
select pg_temp.ok((select value = public.default_message_templates_v7() from public.settings where key = 'message_templates_backup_v7'), 'sao lưu v7');

-- Đã sửa một mẫu → không tự thay.
update public.settings set value = jsonb_set(public.default_message_templates_v7(), '{0,body}', '"Kính gửi {xung_ho}, nội dung tự viết"')
 where key = 'message_templates';
select pg_temp.ok(not public.upgrade_templates_v8(), 'không thay khi đã sửa');
select pg_temp.ok((select value->0->>'body' like '%nội dung tự viết%' from public.settings where key = 'message_templates'), 'giữ mẫu đã sửa');

rollback;
\o
\echo 'tests/sql/99b_templates_v8_test.sql: OK'
