-- Test SQL cho schema, trigger, RLS, chấm điểm, cohort, hạn mức (mục 12).
-- Chạy bằng scripts/test-db.sh. Mọi khối DO raise exception khi sai → psql dừng (ON_ERROR_STOP).
\set QUIET on
\o /dev/null
begin;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

-- Chạy câu lệnh và kỳ vọng lỗi (trả về SQLSTATE).
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

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'user@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'user2@example.com');

select pg_temp.ok((select count(*) from public.profiles) = 3, 'trigger tạo profile cho người dùng mới');
update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000a';

insert into public.companies (id, name, domain, segment, status) values
  ('10000000-0000-0000-0000-000000000001', 'Alpha Production', 'alpha.vn', 'agency', 'profiled'),
  ('10000000-0000-0000-0000-000000000002', 'Beta Cosmetics',   'beta.com.vn', 'brand', 'profiled'),
  ('10000000-0000-0000-0000-000000000003', 'Gamma Films',      'gamma.vn', 'film', 'profiled');
update public.companies set city = 'TP.HCM' where domain = 'alpha.vn';

insert into public.runs (id, owner_id, step, provider) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'discover', 'serper'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'discover', 'serper');

-- ---------------------------------------------------------------- trigger tín hiệu
select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.observations (company_id, signal_code, value_num, evidence_url)
     values ('10000000-0000-0000-0000-000000000001', 'UNKNOWN_CODE', 1, 'https://alpha.vn/')$q$,
  'signal lạ phải bị từ chối') in ('23514', '23503'), 'mã lỗi signal lạ');

select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.observations (company_id, signal_code, value_num, evidence_url)
     values ('10000000-0000-0000-0000-000000000001', 'HAS_EMAIL', 1, 'https://alpha.vn/')$q$,
  'signal proposed phải bị từ chối') = '23514', 'mã lỗi signal proposed');

select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.observations (company_id, signal_code, value_num, evidence_url)
     values ('10000000-0000-0000-0000-000000000001', 'HAS_EMAIL', 1, 'javascript:alert(1)')$q$,
  'evidence_url phải là http(s)') = '23514', 'mã lỗi evidence_url');

-- ---------------------------------------------------------------- anon
set local role anon;
select pg_temp.ok(pg_temp.expect_error('select * from public.companies', 'anon không đọc được companies') = '42501', 'anon companies');
select pg_temp.ok(pg_temp.expect_error('select * from public.settings', 'anon không đọc được settings') = '42501', 'anon settings');
select pg_temp.ok(pg_temp.expect_error('select public.cohort_search(''{}'')', 'anon không gọi được cohort_search') = '42501', 'anon rpc');
reset role;

-- ---------------------------------------------------------------- user thường
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');

select pg_temp.ok((select count(*) from public.companies) = 3, 'user đọc được companies');
select pg_temp.ok((select count(*) from public.signal_codes) >= 16, 'user đọc được signal_codes');
select pg_temp.ok((select count(*) from public.settings) >= 5, 'user đọc được settings');
select pg_temp.ok((select count(*) from public.audit_log) = 0, 'user KHÔNG đọc được audit_log');
select pg_temp.ok((select count(*) from public.runs) = 1, 'user chỉ thấy run của mình');
select pg_temp.ok((select count(*) from public.profiles) = 1, 'user chỉ thấy profile của mình');
select pg_temp.ok(not public.is_admin(), 'user không phải admin');

select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.companies (name, domain) values ('Hack', 'hack.vn')$q$, 'user không ghi companies') = '42501', 'user ghi companies');
select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.settings (key, value) values ('x', '1')$q$, 'user không ghi settings') = '42501', 'user ghi settings');
select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.do_not_contact (kind, value, reason) values ('domain', 'x.vn', 'other')$q$, 'user không ghi DNC') = '42501', 'user ghi DNC');
select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.audit_log (action) values ('fake')$q$, 'user không ghi audit') = '42501', 'user ghi audit');
select pg_temp.ok(pg_temp.expect_error(
  $q$select public.recompute_scores(null)$q$, 'user không gọi recompute_scores') = '42501', 'user rpc score');
select pg_temp.ok(pg_temp.expect_error(
  $q$select public.reserve_units('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'serper', 1)$q$,
  'user không gọi reserve_units') = '42501', 'user rpc quota');
select pg_temp.ok(pg_temp.expect_error(
  $q$select public.forget_subject('domain', 'alpha.vn')$q$, 'user không gọi forget_subject') = '42501', 'user forget');

do $$ declare n int; begin
  update public.signal_codes set status = 'confirmed' where code = 'HAS_EMAIL';
  get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'user không đổi được trạng thái tín hiệu (RLS)');
  update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'user không tự nâng quyền');
  update public.settings set value = '{}' where key = 'limits';
  get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'user không sửa settings');
end $$;

insert into public.cohorts (owner_id, name, filter)
values ('00000000-0000-0000-0000-00000000000b', 'Cohort của tôi', '{}');
select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.cohorts (owner_id, name, filter) values ('00000000-0000-0000-0000-00000000000c', 'Giả mạo', '{}')$q$,
  'user không tạo cohort cho người khác') = '42501', 'cohort owner');
reset role;

-- ---------------------------------------------------------------- admin
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.is_admin(), 'admin là admin');

update public.signal_codes set status = 'confirmed'
where code in ('HAS_EMAIL', 'HIRING_VIDEO_ROLE', 'ACTIVE_YOUTUBE', 'YT_SUBSCRIBERS', 'NO_WEBSITE', 'TVC_PORTFOLIO');
select pg_temp.ok((select confirmed_by from public.signal_codes where code = 'HAS_EMAIL') = '00000000-0000-0000-0000-00000000000a',
  'confirmed_by được ghi');
select pg_temp.ok((select count(*) from public.audit_log where action = 'signal_codes.update') = 6, 'audit ghi thay đổi tín hiệu');
select pg_temp.ok(pg_temp.expect_error(
  $q$update public.signal_codes set code = 'X' where code = 'HAS_EMAIL'$q$, 'admin không đổi được code') = '42501', 'cột code bị khoá');

insert into public.do_not_contact (kind, value, reason) values ('domain', 'https://WWW.Gamma.vn/lien-he', 'existing_customer');
select pg_temp.ok((select value from public.do_not_contact where kind = 'domain') = 'gamma.vn', 'DNC domain được chuẩn hoá');
select pg_temp.ok((select added_by from public.do_not_contact where kind = 'domain') = '00000000-0000-0000-0000-00000000000a', 'DNC added_by');
select pg_temp.ok(pg_temp.expect_error(
  $q$insert into public.do_not_contact (kind, value, reason) values ('email', 'not-an-email', 'other')$q$,
  'email DNC sai định dạng') = '23514', 'DNC email invalid');
insert into public.do_not_contact (kind, value, reason) values ('email', ' Boss@Beta.com.vn ', 'opted_out');
select pg_temp.ok(public.is_email_dnc('boss@beta.com.vn'), 'is_email_dnc trực tiếp');
select pg_temp.ok(public.is_email_dnc('ai.do@sub.gamma.vn'), 'is_email_dnc theo domain cha');
select pg_temp.ok(not public.is_email_dnc('ceo@alpha.vn'), 'email không thuộc DNC');
select pg_temp.ok(public.is_domain_dnc('studio.gamma.vn') and not public.is_domain_dnc('notgamma.vn'), 'is_domain_dnc theo hậu tố');

select pg_temp.ok((select count(*) from public.audit_log) >= 8, 'admin đọc audit_log');
select pg_temp.ok((select count(*) from public.runs) = 2, 'admin thấy mọi run');

select pg_temp.ok(pg_temp.expect_error(
  $q$update public.profiles set role = 'user' where user_id = '00000000-0000-0000-0000-00000000000a'$q$,
  'không hạ được admin cuối cùng') = 'P0001', 'last admin');
reset role;

-- ---------------------------------------------------------------- signal_strength
select pg_temp.ok(public.signal_strength(null, 1) = 1 and public.signal_strength(null, 0) = 0, 'strength boolean');
select pg_temp.ok(public.signal_strength('{"type":"threshold","min":4}', 4) = 1
              and public.signal_strength('{"type":"threshold","min":4}', 3) = 0, 'strength threshold');
select pg_temp.ok(public.signal_strength('{"type":"linear","min":0,"max":10}', 5) = 0.5, 'strength linear');
select pg_temp.ok(public.signal_strength('{"type":"linear","min":0,"max":10}', 50) = 1, 'strength linear clamp');
select pg_temp.ok(public.signal_strength('{"type":"log","min":0,"max":99}', 9) = 0.5, 'strength log');
select pg_temp.ok(public.signal_strength('{"type":"threshold","min":4}', null) = 0, 'strength null');

-- ---------------------------------------------------------------- chấm điểm
-- Tín hiệu confirmed: HAS_EMAIL 4, HIRING_VIDEO_ROLE 12, ACTIVE_YOUTUBE 15, YT_SUBSCRIBERS 8, TVC_PORTFOLIO 8, NO_WEBSITE -10
-- Tổng trọng số dương = 47.
insert into public.observations (company_id, signal_code, value_num, confidence, evidence_url, observed_at) values
  ('10000000-0000-0000-0000-000000000001', 'HIRING_VIDEO_ROLE', 0, 0.7, 'https://alpha.vn/', now() - interval '2 day'),
  ('10000000-0000-0000-0000-000000000001', 'HIRING_VIDEO_ROLE', 1, 1.0, 'https://alpha.vn/tuyen-dung', now()),   -- mới nhất thắng
  ('10000000-0000-0000-0000-000000000001', 'HAS_EMAIL',         1, 0.5, 'https://alpha.vn/lien-he', now()),
  ('10000000-0000-0000-0000-000000000001', 'ACTIVE_YOUTUBE',    6, 1.0, 'https://www.youtube.com/channel/UCalpha', now()),
  ('10000000-0000-0000-0000-000000000002', 'HAS_EMAIL',         1, 1.0, 'https://beta.com.vn/', now()),
  ('10000000-0000-0000-0000-000000000002', 'ACTIVE_YOUTUBE',    2, 1.0, 'https://www.youtube.com/channel/UCbeta', now()),
  ('10000000-0000-0000-0000-000000000002', 'NO_WEBSITE',        1, 1.0, 'https://beta.com.vn/', now()),
  ('10000000-0000-0000-0000-000000000003', 'HIRING_VIDEO_ROLE', 1, 1.0, 'https://gamma.vn/careers', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000003', 'HIRING_VIDEO_ROLE', 0, 0.7, 'https://gamma.vn/', now());              -- hết tuyển

select pg_temp.ok(public.recompute_scores(null) = 3, 'recompute_scores cập nhật 3 công ty');
-- Alpha: 12*1*1 + 4*1*0.5 + 15*1*1 = 29 → round(100*29/47) = 62
select pg_temp.ok((select score from public.companies where domain = 'alpha.vn') = 62, 'điểm Alpha = 62');
-- Beta: 4 + 0 (2 video < 4) - 10 = -6 → clamp 0
select pg_temp.ok((select score from public.companies where domain = 'beta.com.vn') = 0, 'điểm Beta = 0 (bị trừ)');
select pg_temp.ok((select score from public.companies where domain = 'gamma.vn') = 0, 'Gamma: observation mới nhất = 0');
select pg_temp.ok((select jsonb_array_length(score_breakdown->'signals') from public.companies where domain = 'alpha.vn') = 3,
  'breakdown có 3 tín hiệu');
select pg_temp.ok((select (score_breakdown->>'max')::numeric from public.companies where domain = 'alpha.vn') = 47, 'breakdown max = 47');

-- Tín hiệu bị reject không còn được tính.
update public.signal_codes set status = 'rejected' where code = 'TVC_PORTFOLIO';
select public.recompute_scores(array['10000000-0000-0000-0000-000000000001']::uuid[]);
-- Mẫu số còn 39: round(100*29/39) = 74
select pg_temp.ok((select score from public.companies where domain = 'alpha.vn') = 74, 'reject làm giảm mẫu số');

-- ---------------------------------------------------------------- cohort
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.cohort_search('{}')) = 2, 'cohort mặc định loại DNC (gamma.vn)');
select pg_temp.ok((select count(*) from public.cohort_search('{"include_dnc": true}')) = 3, 'cohort include_dnc');
select pg_temp.ok((select max(total_count) from public.cohort_search('{"include_dnc": true, "limit": 1}')) = 3, 'total_count trước limit');
select pg_temp.ok((select array_agg(domain) from public.cohort_search('{"must": ["HIRING_VIDEO_ROLE", "HAS_EMAIL"]}')) = array['alpha.vn'],
  'cohort phải có');
select pg_temp.ok((select count(*) from public.cohort_search('{"must": ["ACTIVE_YOUTUBE"]}')) = 1,
  'ACTIVE_YOUTUBE dùng ngưỡng 4 video');
select pg_temp.ok((select array_agg(domain) from public.cohort_search('{"exclude": ["NO_WEBSITE"]}')) = array['alpha.vn'],
  'cohort loại trừ');
select pg_temp.ok((select array_agg(domain) from public.cohort_search('{"ranges": [{"code": "ACTIVE_YOUTUBE", "min": 1, "max": 3}]}')) = array['beta.com.vn'],
  'cohort khoảng giá trị');
select pg_temp.ok((select count(*) from public.cohort_search('{"min_score": 60}')) = 1, 'cohort min_score');
select pg_temp.ok((select count(*) from public.cohort_search('{"cities": ["Không Có"]}')) = 0, 'cohort lọc thành phố không khớp');
select pg_temp.ok((select count(*) from public.cohort_search('{"cities": []}')) = 2, 'cohort cities rỗng = không lọc');
select pg_temp.ok((select array_agg(domain) from public.cohort_search('{"cities": [" tp.hcm "]}')) = array['alpha.vn'], 'cohort lọc thành phố');
select pg_temp.ok((select count(*) from public.cohort_search('{"q": "%"}')) = 0, 'ký tự % trong q được escape');
select pg_temp.ok((select count(*) from public.cohort_search('{"q": "alpha"}')) = 1, 'tìm theo tên');
select pg_temp.ok((select count(*) from public.cohort_search('{"segments": ["brand"]}')) = 1, 'lọc theo nhóm');
select pg_temp.ok((select count(*) from public.cohort_search($j${"must": ["x'); drop table companies; --"]}$j$)) = 0,
  'input độc hại chỉ là dữ liệu');
select pg_temp.ok((select count(*) from public.company_list where is_dnc) = 1, 'view company_list gắn cờ DNC');
reset role;

-- ---------------------------------------------------------------- hạn mức
update public.settings set value = value || '{"serper_daily_global": 5, "serper_daily_per_user": 3}' where key = 'limits';
select pg_temp.ok((public.reserve_units('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'serper', 2)->>'ok')::boolean,
  'giữ chỗ 2 đơn vị');
select pg_temp.ok(not (public.reserve_units('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'serper', 2)->>'ok')::boolean,
  'vượt hạn mức theo người dùng');
select public.refund_units('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'serper', 1);
select pg_temp.ok((public.reserve_units('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'serper', 2)->>'ok')::boolean,
  'hoàn trả trả lại quota');
select pg_temp.ok((public.reserve_units('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'serper', 2)->>'ok')::boolean,
  'user2 còn quota (toàn hệ thống dùng 5/5)');
select pg_temp.ok(not (public.reserve_units('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'serper', 1)->>'ok')::boolean,
  'vượt hạn mức toàn hệ thống');
select pg_temp.ok((public.api_usage_today('serper', '00000000-0000-0000-0000-00000000000b', 2)->>'limit_global')::int = 2, 'trần env');
select pg_temp.ok((select api_units_used from public.runs where id = '20000000-0000-0000-0000-000000000001') = 3, 'runs.api_units_used cộng dồn');

-- ---------------------------------------------------------------- upsert_companies
select pg_temp.ok((select count(*) filter (where is_new) from public.upsert_companies(
  '[{"name":"Alpha","domain":"alpha.vn","source":"search"},
    {"name":"Delta","domain":"delta.vn","segment":"agency","source":"search"},
    {"name":"Quán Phở Không Web","domain":null,"city":"Hà Nội","source":"maps"}]',
  '20000000-0000-0000-0000-000000000001')) = 2, 'upsert: 2 mới, 1 đã có');
select pg_temp.ok((select count(*) filter (where is_new) from public.upsert_companies(
  '[{"name":"quán phở không web","domain":null,"city":"Hà Nội","source":"maps"}]',
  '20000000-0000-0000-0000-000000000001')) = 0, 'upsert: không website khử trùng theo tên+thành phố');
select pg_temp.ok((select name from public.companies where domain = 'alpha.vn') = 'Alpha Production', 'upsert không ghi đè tên');

-- ---------------------------------------------------------------- forget_subject
insert into public.contacts (company_id, full_name, email, email_label)
values ('10000000-0000-0000-0000-000000000001', 'Nguyễn Văn An', 'an.nguyen@alpha.vn', 'guess');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((public.forget_subject('email', 'An.Nguyen@alpha.vn')->>'contacts_deleted')::int = 1, 'forget email xoá liên hệ');
select pg_temp.ok(public.is_email_dnc('an.nguyen@alpha.vn'), 'forget email thêm DNC');
select pg_temp.ok((public.forget_subject('domain', 'https://www.delta.vn/')->>'companies_deleted')::int = 1, 'forget domain xoá công ty');
select pg_temp.ok(public.is_domain_dnc('delta.vn'), 'forget domain thêm DNC');
select pg_temp.ok((select count(*) from public.audit_log where action = 'forget_subject') = 2, 'forget ghi audit');
select pg_temp.ok(public.purge_stale_leads(12) = 0, 'purge không xoá lead mới');
reset role;

rollback;
\o
\echo 'tests/sql/10_schema_rls_test.sql: OK'
