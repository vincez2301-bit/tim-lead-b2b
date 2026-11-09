-- Test: lịch chỉ email (v5), bộ mẫu v6, sao lưu bản cũ, outreach_emails trong deal_board, chuyển khách đang dở lịch cũ.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

create temp table cad as select public.setting('cadence') as v;
create temp table tpl as select public.setting('message_templates') as v;
select pg_temp.ok((select bool_and(e->>'channel' = 'email') from cad, jsonb_array_elements(cad.v) e), 'lịch chỉ còn email');
select pg_temp.ok((select count(*) = 6 from cad, jsonb_array_elements(cad.v) e where (e->>'step')::int < 13), '6 email chặng tiếp cận');
select pg_temp.ok((select count(*) = 7 from cad, jsonb_array_elements(cad.v) e where (e->>'step')::int between 13 and 19), 'chặng chốt 13–19');
select pg_temp.ok((select bool_and(t->>'channel' = 'email') from tpl, jsonb_array_elements(tpl.v) t), 'mẫu chỉ email');
select pg_temp.ok((
  select count(*) = 30 from tpl, jsonb_array_elements(tpl.v) t
  where (t->>'step')::int between 1 and 6 and t->>'segment' in ('broadcaster','mcn','agency','film','brand')
), '6 email × 5 nhóm khách');
select pg_temp.ok((
  select bool_and(t->>'subject' like 'Re: %') from tpl, jsonb_array_elements(tpl.v) t where (t->>'step')::int between 2 and 6
), 'email theo dõi giữ tiêu đề Re:');
select pg_temp.ok((
  select bool_and(t->>'body' like '%{cau_rieng}%') from tpl, jsonb_array_elements(tpl.v) t where (t->>'step')::int = 1
), 'email mở lời có câu riêng về khách');
select pg_temp.ok((select count(*) = 2 from public.settings where key in ('cadence_backup_v4', 'message_templates_backup_v4')),
  'sao lưu lịch + mẫu cũ');
select pg_temp.ok((
  select bool_or(e->>'channel' = 'call') from public.settings s, jsonb_array_elements(s.value) e where s.key = 'cadence_backup_v4'
), 'bản sao lưu là lịch cũ');

-- Khách đang dở lịch cũ: 1 email + 1 cuộc gọi → việc kế tiếp là email thứ 2; khách đang chốt đổi tên việc.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009e1', 'e1@test.vn');
insert into public.companies (id, name) values
  ('00000000-0000-0000-0000-00000000e001', 'Email One'), ('00000000-0000-0000-0000-00000000e002', 'Email Two');
insert into public.deals (id, company_id, stage, cadence_started_at, next_action, next_action_at) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e001', 'outreach', current_date - 20,
   'Gọi điện lần 2', current_date - 1),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000e002', 'proposal', current_date - 50,
   'Theo dõi đề xuất', current_date + 1);
insert into public.activities (deal_id, channel, outcome, step, user_id) values
  ('00000000-0000-0000-0000-00000000d001', 'email', 'done', 1, '00000000-0000-0000-0000-0000000009e1'),
  ('00000000-0000-0000-0000-00000000d001', 'call', 'no_answer', 3, '00000000-0000-0000-0000-0000000009e1');
select pg_temp.ok((select outreach_emails = 1 and touches = 2 from public.deal_board where id = '00000000-0000-0000-0000-00000000d001'),
  'deal_board đếm email chặng tiếp cận');
select pg_temp.ok(public.replan_email_only() >= 2, 'đổi việc cho 2 deal');
select pg_temp.ok((select next_action = 'Email theo dõi 1: rủi ro bản quyền' and next_action_at = current_date
  from public.deals where id = '00000000-0000-0000-0000-00000000d001'), 'email kế tiếp, quá hạn thì làm hôm nay');
select pg_temp.ok((select next_action = 'Email theo dõi đề xuất' from public.deals where id = '00000000-0000-0000-0000-00000000d002'),
  'đổi tên việc chặng chốt');

rollback;
\o
\echo 'tests/sql/98_email_only_test.sql: OK'
