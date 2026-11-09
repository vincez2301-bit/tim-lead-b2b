-- Test: nguồn liên hệ mới, cột note, bước find_people, vai trò mặc định theo nhóm khách.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

insert into public.companies (id, name, domain) values ('00000000-0000-0000-0000-00000000f001', 'Alpha Media', 'alpha-fp.vn');
insert into public.contacts (company_id, full_name, job_title, email, email_label, source, confidence, note, evidence_url) values
  ('00000000-0000-0000-0000-00000000f001', 'Trần Thị Bích', 'Producer', 'bichtt@alpha-fp.vn', 'guess', 'linkedin', 0.4,
   'Dự đoán theo mẫu bichtt@ (từ anvn@alpha-fp.vn)', 'https://vn.linkedin.com/in/bich'),
  ('00000000-0000-0000-0000-00000000f001', null, null, 'an.nguyen@alpha-fp.vn', 'published', 'web', 0.7, null, 'https://bao.vn/a'),
  ('00000000-0000-0000-0000-00000000f001', null, 'Email hợp tác trên kênh YouTube', 'alpha@gmail.com', 'published', 'youtube', 0.7, null,
   'https://www.youtube.com/channel/UC1');
select pg_temp.ok((select count(*) = 3 from public.contacts where company_id = '00000000-0000-0000-0000-00000000f001'), 'nhận 3 nguồn mới');

create function pg_temp.fails(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when check_violation then return true;
end $$;
select pg_temp.ok(pg_temp.fails($q$insert into public.contacts (company_id, email, source) values
  ('00000000-0000-0000-0000-00000000f001', 'x@alpha-fp.vn', 'facebook')$q$), 'nguồn lạ bị chặn');
select pg_temp.ok(pg_temp.fails($q$insert into public.contacts (company_id, email, source, note) values
  ('00000000-0000-0000-0000-00000000f001', 'x@alpha-fp.vn', 'web', repeat('a', 301))$q$), 'note tối đa 300 ký tự');

update public.companies set people_searched_at = now() where id = '00000000-0000-0000-0000-00000000f001';
select pg_temp.ok((select pg_get_constraintdef(oid) like '%find_people%' from pg_constraint where conname = 'runs_step_check'),
  'runs nhận bước find_people');

create temp table cr as select public.setting('contact_roles') as v;
select pg_temp.ok((select v ?& array['broadcaster','mcn','agency','film','brand'] from cr), 'vai trò đủ 5 nhóm');
select pg_temp.ok((select v->'agency' ? 'Producer' and v->'brand' ? 'Marketing Manager' from cr), 'vai trò mặc định');

rollback;
\o
\echo 'tests/sql/97_find_people_test.sql: OK'
