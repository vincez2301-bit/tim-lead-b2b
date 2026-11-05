-- Test SQL cho pipeline bán hàng: deal, điểm chạm, RLS dùng chung, nhập lead, purge.
\set QUIET on
\o /dev/null
begin;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;
create function pg_temp.expect_error(sql text, msg text) returns text language plpgsql as $$
declare st text;
begin
  begin
    execute sql;
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    return st;
  end;
  raise exception 'FAIL (không lỗi như kỳ vọng): %', msg;
end $$;
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'sales-admin@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'sales1@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'sales2@example.com');
update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.companies (id, name, domain, segment, status) values
  ('20000000-0000-0000-0000-000000000001', 'Đài Truyền Hình A', 'daia.vn', 'broadcaster', 'new'),
  ('20000000-0000-0000-0000-000000000002', 'MCN B', 'mcnb.vn', 'mcn', 'new');
insert into public.do_not_contact (kind, value, reason) values ('domain', 'blocked.vn', 'existing_customer'), ('email', 'no@mcnb.vn', 'opted_out');

-- ---------------------------------------------------------------- nhóm broadcaster & cấu hình
select pg_temp.ok((select segment from public.companies where domain = 'daia.vn') = 'broadcaster', 'segment broadcaster hợp lệ');
select pg_temp.ok(jsonb_array_length(public.setting('cadence')) = 19, 'lịch 19 điểm chạm');
select pg_temp.ok(jsonb_array_length(public.setting('qualification_criteria')) = 8, '8 tiêu chí đánh giá');
select pg_temp.ok(public.setting('keyword_sets') ? 'broadcaster', 'bộ từ khoá broadcaster');

-- ---------------------------------------------------------------- anon không có quyền
set local role anon;
select pg_temp.ok(pg_temp.expect_error('select * from public.deals', 'anon đọc deals') = '42501', 'anon deals');
select pg_temp.ok(pg_temp.expect_error('select * from public.deal_board', 'anon đọc deal_board') = '42501', 'anon deal_board');
select pg_temp.ok(pg_temp.expect_error('select public.import_leads(''[]'')', 'anon import') = '42501', 'anon import');
reset role;

-- ---------------------------------------------------------------- nhóm dùng chung
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.deals (company_id, stage, owner_id) values
  ('20000000-0000-0000-0000-000000000001', 'research', '00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select created_by from public.deals where company_id = '20000000-0000-0000-0000-000000000001')
  = '00000000-0000-0000-0000-0000000000b1', 'created_by = người tạo');
insert into public.activities (deal_id, channel, outcome, note)
  select id, 'call', 'no_answer', 'Gọi lần 1' from public.deals where company_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.activities (deal_id, channel, user_id)
     select id, 'email', '00000000-0000-0000-0000-0000000000c1' from public.deals limit 1$q$,
  'ghi điểm chạm dưới tên người khác') = '42501', 'không mạo danh người ghi');
select pg_temp.ok(pg_temp.expect_error(
  $q$update public.deals set created_by = '00000000-0000-0000-0000-0000000000c1'$q$, 'sửa created_by') = '42501',
  'không sửa created_by');

-- Người thứ 2 xem và cập nhật được deal của người 1.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select touches from public.deal_board where company_id = '20000000-0000-0000-0000-000000000001') = 1,
  'đồng nghiệp thấy deal và số điểm chạm');
update public.deals set stage = 'outreach' where company_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.ok((select cadence_started_at from public.deals where company_id = '20000000-0000-0000-0000-000000000001')
  = current_date, 'vào outreach thì bắt đầu lịch điểm chạm');
-- Không xoá được điểm chạm của người khác; không xoá deal (chỉ admin).
delete from public.activities;
select pg_temp.ok((select count(*) from public.activities) = 1, 'không xoá điểm chạm của người khác');
delete from public.deals;
select pg_temp.ok((select count(*) from public.deals) = 1, 'user không xoá deal');
select pg_temp.ok((select count(*) from public.team_members()) = 3, 'danh sách thành viên');
select public.update_company_profile('20000000-0000-0000-0000-000000000002', 'agency', 'TP.HCM');
select pg_temp.ok((select segment || '/' || city from public.companies where id = '20000000-0000-0000-0000-000000000002')
  = 'agency/TP.HCM', 'cập nhật nhóm khách + thành phố');
select pg_temp.ok(pg_temp.expect_error(
  $q$select public.update_company_profile('20000000-0000-0000-0000-000000000002', 'hacker', null)$q$, 'segment lạ') <> '',
  'segment không hợp lệ bị chặn');
select pg_temp.ok(pg_temp.expect_error('select public.import_leads(''[]'')', 'user import') = '42501', 'chỉ admin nhập lead');
select public.add_contact('20000000-0000-0000-0000-000000000001', 'Anh Hùng', 'Giám đốc nội dung', 'Hung@DaiA.vn', null);
select pg_temp.ok((select email from public.contacts where full_name = 'Anh Hùng') = 'hung@daia.vn', 'thêm liên hệ thủ công');
select pg_temp.ok(pg_temp.expect_error(
  $q$select public.add_contact('20000000-0000-0000-0000-000000000001', 'X', null, 'no@mcnb.vn', null)$q$, 'email DNC') <> '',
  'không thêm liên hệ thuộc DNC');

-- ---------------------------------------------------------------- nhập lead (admin)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table imp as select public.import_leads($json$[
  {"name": "MCN B", "segment": "mcn", "source": "Deals sheet", "stage": "outreach", "tier": "A",
   "owner_email": "SALES1@example.com", "next_action_at": "2026-11-20", "est_arr_usd": "10206",
   "contacts": [{"full_name": "Chị Mai", "job_title": "CEO", "email": "Mai@MCNB.vn"},
                {"full_name": "Không Liên Hệ", "email": "no@mcnb.vn"}],
   "activities": [{"happened_at": "2026-09-29", "channel": "call", "outcome": "no_answer", "note": "Call but no answer"},
                  {"happened_at": "2026-10-02", "channel": "email", "note": "Email"}]},
  {"name": "Studio Mới", "city": "TP.HCM", "segment": "agency", "source": "ATF 24",
   "contacts": [{"full_name": "Anh Nam", "job_title": "Producer", "email": "nam@studiomoi.vn"}]},
  {"name": "Bị Chặn", "domain": "https://www.blocked.vn/about"},
  {"name": "  "}
]$json$) as r;
select pg_temp.ok((select (r->>'companies_created')::int from imp) = 1, 'tạo 1 công ty mới');
select pg_temp.ok((select (r->>'companies_matched')::int from imp) = 1, 'khớp công ty có sẵn theo tên');
select pg_temp.ok((select (r->>'deals_created')::int from imp) = 2, 'tạo 2 deal');
select pg_temp.ok((select (r->>'contacts_added')::int from imp) = 2, 'thêm 2 liên hệ');
select pg_temp.ok((select (r->>'activities_added')::int from imp) = 2, 'thêm 2 điểm chạm');
select pg_temp.ok((select (r->>'skipped_dnc')::int from imp) = 2, 'bỏ qua domain + email DNC');
select pg_temp.ok((select (r->>'skipped_invalid')::int from imp) = 1, 'bỏ qua dòng thiếu tên');
select pg_temp.ok((select stage || tier || owner_id::text from public.deal_board where company_name = 'MCN B')
  = 'outreachA00000000-0000-0000-0000-0000000000b1', 'deal nhận giai đoạn, tier, người phụ trách');
select pg_temp.ok((select email from public.contacts where full_name = 'Chị Mai') = 'mai@mcnb.vn', 'email chuẩn hoá chữ thường');
-- Nhập lại cùng dữ liệu: không nhân đôi.
create temp table imp2 as select public.import_leads($json$[
  {"name": "MCN B", "stage": "new",
   "contacts": [{"full_name": "Chị Mai", "email": "mai@mcnb.vn"}],
   "activities": [{"happened_at": "2026-09-29", "channel": "call", "outcome": "no_answer", "note": "Call but no answer"}]}
]$json$) as r;
select pg_temp.ok((select (r->>'deals_updated')::int + (r->>'contacts_added')::int * 10 + (r->>'activities_added')::int * 100 from imp2) = 1,
  'nhập lại không nhân đôi liên hệ / điểm chạm');
select pg_temp.ok((select stage from public.deal_board where company_name = 'MCN B') = 'outreach', 'nhập lại không lùi giai đoạn');
select public.import_leads($json$[{"name": "Studio Mới", "domain": "studiomoi.vn", "website_url": "https://studiomoi.vn/"}]$json$);
select pg_temp.ok((select domain || '|' || website_url from public.companies where name = 'Studio Mới') = 'studiomoi.vn|https://studiomoi.vn/',
  'nhập bổ sung điền domain + website cho công ty đã có');
select public.import_leads($json$[{"name": "MCN B", "stage": "won", "signed_at": "2026-10-30", "effective_at": "2026-10-01"}]$json$);
select pg_temp.ok((select stage || '|' || signed_at::text || '|' || effective_at::text || '|' || coalesce(next_action, '-')
  from public.deal_board where company_name = 'MCN B') = 'won|2026-10-30|2026-10-01|-', 'nhập khách đã ký → Thắng + ngày ký');
delete from public.deals where company_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.deals where company_id = '20000000-0000-0000-0000-000000000001') = 0,
  'admin xoá deal');
reset role;

-- ---------------------------------------------------------------- lý do từ chối
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
update public.deals set stage = 'nurture', lost_reason_code = 'competitor', competitor = 'Nhà cung cấp X',
  contract_end = '2027-03-31' where company_id = (select id from public.companies where name = 'MCN B');
select pg_temp.ok((select lost_reason_code || '|' || contract_end::text from public.deal_board where company_name = 'MCN B')
  = 'competitor|2027-03-31', 'lưu lý do từ chối + ngày hết hợp đồng, view có cột mới');
select pg_temp.ok(pg_temp.expect_error(
  $q$update public.deals set lost_reason_code = 'hacker'$q$, 'lý do lạ') = '23514', 'lý do từ chối phải hợp lệ');
select pg_temp.ok(jsonb_array_length(public.setting('objection_playbook')) >= 6, 'kịch bản xử lý từ chối');
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------- purge giữ công ty đang có deal
update public.companies set last_seen_at = now() - interval '2 years', first_seen_at = now() - interval '2 years';
select pg_temp.ok(public.purge_stale_leads(12) = 1, 'purge chỉ xoá công ty không có deal còn tương tác');
select pg_temp.ok(exists (select 1 from public.companies where name = 'MCN B'), 'công ty có deal được giữ');

rollback;
\o
\echo 'tests/sql/20_pipeline_test.sql: OK'
