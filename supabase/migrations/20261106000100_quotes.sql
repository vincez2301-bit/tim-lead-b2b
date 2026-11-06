-- Báo giá nhanh (BG-01, BG-02):
--   settings.price_book : bảng giá dùng để điền sẵn báo giá (admin sửa ở Cài đặt → Bảng giá)
--   quotes              : báo giá đã tạo cho một deal (số BG-2026-0001, hạn hiệu lực, trạng thái)
-- Tổng tiền do database tính từ các dòng, client không tự đặt được.

-- ---------------------------------------------------------------------------
-- 1. Bảng
-- ---------------------------------------------------------------------------
create sequence public.quote_seq;

create table public.quotes (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  number       text not null unique default (
                 'BG-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY') || '-' ||
                 lpad(nextval('public.quote_seq')::text, 4, '0')),
  currency     text not null default 'USD' check (currency in ('USD','VND')),
  -- [{name, detail?, qty, unit_price, unit?}]
  items        jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  discount_pct numeric not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  total        numeric not null default 0 check (total >= 0),
  annual_usd   numeric check (annual_usd >= 0 and annual_usd < 100000000),
  valid_until  date not null,
  terms        text check (length(terms) <= 3000),
  contact_name text check (length(contact_name) <= 200),
  status       text not null default 'sent' check (status in ('sent','accepted','declined')),
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index quotes_deal_idx on public.quotes (deal_id, created_at desc);
create index quotes_open_idx on public.quotes (valid_until) where status = 'sent';

-- ---------------------------------------------------------------------------
-- 2. Kiểm tra dòng báo giá + tính tổng
-- ---------------------------------------------------------------------------
create or replace function public.quotes_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  it jsonb;
  v_sum numeric := 0;
  v_qty numeric;
  v_price numeric;
begin
  for it in select * from jsonb_array_elements(new.items) loop
    if jsonb_typeof(it) <> 'object'
       or coalesce(length(btrim(it->>'name')), 0) = 0 or length(it->>'name') > 200
       or length(coalesce(it->>'detail', '')) > 500 or length(coalesce(it->>'unit', '')) > 30 then
      raise exception 'Mỗi dòng báo giá cần tên (tối đa 200 ký tự)' using errcode = 'check_violation';
    end if;
    begin
      v_qty := (it->>'qty')::numeric;
      v_price := (it->>'unit_price')::numeric;
    exception when others then
      raise exception 'Số lượng hoặc đơn giá không phải số' using errcode = 'check_violation';
    end;
    if v_qty is null or v_qty <= 0 or v_qty > 100000 or v_price is null or v_price < 0 or v_price >= 1e12 then
      raise exception 'Số lượng hoặc đơn giá không hợp lệ' using errcode = 'check_violation';
    end if;
    v_sum := v_sum + v_qty * v_price;
  end loop;
  new.total := round(v_sum * (100 - new.discount_pct) / 100, case when new.currency = 'VND' then 0 else 2 end);
  return new;
end $$;
create trigger trg_quotes_before_write before insert or update of items, discount_pct, currency on public.quotes
for each row execute function public.quotes_before_write();

-- ---------------------------------------------------------------------------
-- 3. RLS: cả nhóm xem; người tạo (hoặc admin) xoá; chỉ đổi được trạng thái
-- ---------------------------------------------------------------------------
alter table public.quotes enable row level security;
revoke all on public.quotes from anon, authenticated;
revoke all on sequence public.quote_seq from anon;
grant select, delete on public.quotes to authenticated;
grant insert (deal_id, currency, items, discount_pct, annual_usd, valid_until, terms, contact_name, created_by)
  on public.quotes to authenticated;
grant update (status) on public.quotes to authenticated;
grant usage on sequence public.quote_seq to authenticated;

create policy "team read quotes"   on public.quotes for select to authenticated using (true);
create policy "team insert quotes" on public.quotes for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "team update quotes" on public.quotes for update to authenticated using (true) with check (true);
create policy "own delete quotes"  on public.quotes for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

revoke execute on function public.quotes_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Bảng giá mặc định (chưa có gói nào: admin điền giá thật ở Cài đặt → Bảng giá)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('price_book', jsonb_build_object(
    'currency', 'USD',
    'usd_vnd', 26000,
    'valid_days', 14,
    'items', '[]'::jsonb,
    'terms', E'• Giá chưa bao gồm thuế (nếu có).\n• Giấy phép có thời hạn 12 tháng kể từ ngày kích hoạt tài khoản.\n• Thanh toán 100% trong 15 ngày kể từ ngày ký hợp đồng.\n• Báo giá có hiệu lực đến ngày ghi ở trên.'))
on conflict (key) do nothing;
