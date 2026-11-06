-- Test: báo giá — số tự sinh, tổng do database tính, kiểm tra dòng, quyền theo vai trò.
\set QUIET on
\o /dev/null
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'qa@example.com'),
  ('00000000-0000-0000-0000-0000000008a2', 'qb@example.com');
insert into public.companies (id, name, domain, segment) values
  ('80000000-0000-0000-0000-000000000001', 'Kênh Vui', 'kenhvui.vn', 'mcn');
insert into public.deals (id, company_id, stage) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'meeting');

select pg_temp.ok((select value->>'currency' = 'USD' and jsonb_array_length(value->'items') = 0
                   from public.settings where key = 'price_book'), 'bảng giá mặc định');

select pg_temp.ok((select count(*) = 4 and count(distinct t->>'step') = 4
                   from public.settings, jsonb_array_elements(value) t
                   where key = 'message_templates' and (t->>'step')::int in (14, 17, 18, 19)), 'mẫu chặng chốt 14/17/18/19');

-- Chưa đăng nhập: không đọc được.
set local role anon;
do $$ begin
  begin
    perform 1 from public.quotes;
    raise exception 'FAIL: anon đọc được quotes';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);

insert into public.quotes (deal_id, items, discount_pct, valid_until)
values ('81000000-0000-0000-0000-000000000001',
        '[{"name":"Gói doanh nghiệp","qty":2,"unit_price":1200,"unit":"năm"},{"name":"Thêm kênh","qty":1,"unit_price":600}]',
        10, current_date + 14);
select pg_temp.ok((select total = 2700 and number ~ '^BG-\d{4}-\d{4}$' and status = 'sent'
                     and created_by = '00000000-0000-0000-0000-0000000008a1'
                   from public.quotes where deal_id = '81000000-0000-0000-0000-000000000001'), 'tổng 2×1200+600 giảm 10% = 2700');

insert into public.quotes (deal_id, currency, items, discount_pct, valid_until)
values ('81000000-0000-0000-0000-000000000001', 'VND', '[{"name":"Gói A","qty":1,"unit_price":"1000001"}]', 33.3, current_date);
select pg_temp.ok((select total = 667001 from public.quotes where currency = 'VND'), 'VND làm tròn tới đồng');
select pg_temp.ok((select count(distinct number) = 2 from public.quotes), 'số báo giá không trùng');

-- Dòng không hợp lệ.
do $$
declare bad text;
begin
  foreach bad in array array[
    '[]',
    '[{"qty":1,"unit_price":5}]',
    '[{"name":"  ","qty":1,"unit_price":5}]',
    '[{"name":"A","qty":0,"unit_price":5}]',
    '[{"name":"A","qty":"hai","unit_price":5}]',
    '[{"name":"A","qty":1,"unit_price":-1}]',
    '[{"name":"A","qty":1}]'
  ] loop
    begin
      insert into public.quotes (deal_id, items, valid_until)
      values ('81000000-0000-0000-0000-000000000001', bad::jsonb, current_date);
      raise exception 'FAIL: nhận dòng không hợp lệ %', bad;
    exception when check_violation then null;
    end;
  end loop;
end $$;

-- Client không tự đặt số, tổng, hay người tạo khác.
do $$ begin
  begin
    insert into public.quotes (deal_id, number, items, valid_until)
    values ('81000000-0000-0000-0000-000000000001', 'BG-GIA', '[{"name":"A","qty":1,"unit_price":5}]', current_date);
    raise exception 'FAIL: client tự đặt số báo giá';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quotes (deal_id, items, valid_until, created_by)
    values ('81000000-0000-0000-0000-000000000001', '[{"name":"A","qty":1,"unit_price":5}]', current_date,
            '00000000-0000-0000-0000-0000000008a2');
    raise exception 'FAIL: tạo báo giá dưới tên người khác';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.quotes set total = 1;
    raise exception 'FAIL: client sửa tổng tiền';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Người khác trong nhóm: xem và đổi trạng thái được, không xoá được báo giá của người khác.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a2","role":"authenticated"}', true);
select pg_temp.ok((select count(*) = 2 from public.quotes), 'cả nhóm xem được');
update public.quotes set status = 'accepted' where currency = 'USD';
select pg_temp.ok((select status = 'accepted' from public.quotes where currency = 'USD'), 'đổi trạng thái');
delete from public.quotes;
select pg_temp.ok((select count(*) = 2 from public.quotes), 'không xoá được báo giá của người khác');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);
delete from public.quotes where currency = 'VND';
select pg_temp.ok((select count(*) = 1 from public.quotes), 'người tạo xoá được');
reset role;

-- Xoá deal thì xoá luôn báo giá.
delete from public.deals where id = '81000000-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*) = 0 from public.quotes), 'xoá theo deal');

rollback;
\o
\echo 'tests/sql/80_quotes_test.sql: OK'
