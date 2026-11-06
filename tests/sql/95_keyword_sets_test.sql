-- Test: bộ từ khoá mặc định v2 (đủ 5 nhóm, không còn từ khoá cũ có tên thành phố, tối đa 20/nhóm).
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

create temp table ks as select public.setting('keyword_sets') as v;
select pg_temp.ok((select v ?& array['broadcaster','mcn','agency','film','brand'] from ks), 'đủ 5 nhóm');
select pg_temp.ok((select v->'agency' ? 'công ty sản xuất TVC' and v->'film' ? 'studio hậu kỳ' from ks), 'từ khoá mới');
select pg_temp.ok((select not (v->'agency' ? 'công ty sản xuất TVC TP.HCM') and not (v->'brand' ? 'công ty du lịch tuyển video editor') from ks),
  'bỏ từ khoá mặc định cũ');
select pg_temp.ok((select bool_and(jsonb_array_length(value) between 10 and 20) from ks, jsonb_each(ks.v)), '10–20 từ khoá mỗi nhóm');

rollback;
\o
\echo 'tests/sql/95_keyword_sets_test.sql: OK'
