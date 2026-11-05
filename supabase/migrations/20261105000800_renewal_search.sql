-- Gia hạn hợp đồng cho khách đã ký, và tìm công ty không cần gõ dấu.

-- ---------------------------------------------------------------- gia hạn
alter table public.deals add column renewal_at date;
grant update (renewal_at) on public.deals to authenticated;

-- Kỳ gia hạn kế tiếp: mốc tròn năm đầu tiên sau hôm nay tính từ ngày hiệu lực (hợp đồng năm tự gia hạn).
create or replace function public.next_anniversary(p_start date) returns date
language sql stable set search_path = '' as $$
  select (p_start + make_interval(years => greatest(1, extract(year from age(current_date, p_start))::int + 1)))::date
$$;

-- Deal thắng có ngày hiệu lực / ngày ký mà chưa có ngày gia hạn → tự điền. Nếu ngày gia hạn
-- vẫn là giá trị app tự điền và người dùng đổi ngày hiệu lực thì tính lại; ngày người dùng tự nhập thì giữ.
create or replace function public.deals_default_renewal() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_start date := coalesce(new.effective_at, new.signed_at);
begin
  if new.stage <> 'won' or v_start is null or new.billing = 'one_off' then
    return new;
  end if;
  if new.renewal_at is null then
    new.renewal_at := public.next_anniversary(v_start);
  elsif tg_op = 'UPDATE'
        and new.renewal_at = old.renewal_at
        and coalesce(old.effective_at, old.signed_at) is distinct from v_start
        and old.renewal_at = public.next_anniversary(coalesce(old.effective_at, old.signed_at)) then
    new.renewal_at := public.next_anniversary(v_start);
  end if;
  return new;
end $$;
create trigger trg_deals_default_renewal before insert or update on public.deals
for each row execute function public.deals_default_renewal();

update public.deals set renewal_at = public.next_anniversary(coalesce(effective_at, signed_at))
where stage = 'won' and renewal_at is null and coalesce(effective_at, signed_at) is not null
  and billing is distinct from 'one_off';

drop view public.deal_board;
create view public.deal_board with (security_invoker = true) as
  select d.*,
         c.name as company_name, c.domain, c.website_url, c.segment, c.city, c.score,
         public.is_domain_dnc(c.domain) as is_dnc,
         coalesce(a.touches, 0) as touches,
         a.last_touch_at
  from public.deals d
  join public.companies c on c.id = d.company_id
  left join lateral (
    select count(*)::int as touches, max(x.happened_at) as last_touch_at
    from public.activities x where x.deal_id = d.id
  ) a on true;
revoke all on public.deal_board from anon, authenticated;
grant select on public.deal_board to authenticated;

-- ---------------------------------------------------------------- tìm không dấu
-- "song viet" tìm ra "Sóng Việt". translate() là hàm immutable nên dùng được cho cột sinh sẵn;
-- dấu tách rời (Unicode NFD) cũng bị bỏ.
alter table public.companies add column name_search text generated always as (
  translate(lower(name),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ̛̣̀́̂̃̆̉',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
) stored;
create index companies_name_search_idx on public.companies (name_search);

drop view public.company_list;
create view public.company_list with (security_invoker = true) as
  select c.*, public.is_domain_dnc(c.domain) as is_dnc
  from public.companies c;
revoke all on public.company_list from anon, authenticated;
grant select on public.company_list to authenticated;
