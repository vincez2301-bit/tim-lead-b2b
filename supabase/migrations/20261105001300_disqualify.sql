-- Loại lead không phù hợp (vd. công ty tổ chức sự kiện, không làm video): ghi lý do trên công ty,
-- bỏ deal chưa liên hệ khỏi pipeline, và lần tìm sau không đưa lại công ty đó (xem discover).

alter table public.companies
  add column disqualified_at   timestamptz,
  add column disqualify_reason text check (disqualify_reason in
    ('no_video', 'event', 'too_small', 'out_of_area', 'existing', 'duplicate', 'other')),
  add column disqualify_note   text check (disqualify_note is null or length(disqualify_note) <= 500);
create index companies_disqualified_idx on public.companies (disqualified_at) where disqualified_at is not null;

-- Deal đã liên hệ rồi mới thấy không phù hợp: đóng với lý do riêng.
alter table public.deals drop constraint deals_lost_reason_code_check;
alter table public.deals add constraint deals_lost_reason_code_check
  check (lost_reason_code in ('price', 'competitor', 'no_need', 'no_contact', 'timing', 'other', 'unqualified'));

-- company_list dùng c.* nên phải tạo lại để có cột mới.
drop view public.company_list;
create view public.company_list with (security_invoker = true) as
  select c.*, public.is_domain_dnc(c.domain) as is_dnc
  from public.companies c;
revoke all on public.company_list from anon, authenticated;
grant select on public.company_list to authenticated;

-- Loại công ty: deal chưa có điểm chạm thì xoá khỏi pipeline, deal đã liên hệ thì đóng (Thua · Không phù hợp).
create or replace function public.disqualify_companies(p_ids uuid[], p_reason text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_companies int;
  v_removed int;
  v_closed int;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('no_video', 'event', 'too_small', 'out_of_area', 'existing', 'duplicate', 'other') then
    raise exception 'Lý do không hợp lệ' using errcode = '22023';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 1000 then
    raise exception 'Tối đa 1000 công ty mỗi lần' using errcode = '22023';
  end if;

  update public.companies
     set disqualified_at = now(), disqualify_reason = p_reason, disqualify_note = nullif(left(btrim(p_note), 500), '')
   where id = any(p_ids);
  get diagnostics v_companies = row_count;

  delete from public.deals d
   where d.company_id = any(p_ids)
     and d.stage in ('new', 'research')
     and not exists (select 1 from public.activities a where a.deal_id = d.id);
  get diagnostics v_removed = row_count;

  update public.deals d
     set stage = 'lost', lost_reason_code = 'unqualified', next_action = null, next_action_at = null,
         lost_reason = coalesce(d.lost_reason, 'Không phù hợp')
   where d.company_id = any(p_ids)
     and d.stage not in ('won', 'lost');
  get diagnostics v_closed = row_count;

  insert into public.audit_log (user_id, action, detail)
  values (auth.uid(), 'company.disqualify', jsonb_build_object('count', v_companies, 'reason', p_reason));

  return jsonb_build_object('companies', v_companies, 'deals_removed', v_removed, 'deals_closed', v_closed);
end $$;

-- Bỏ đánh dấu (công ty xuất hiện lại trong danh sách và lần tìm sau); deal đã xoá không tự khôi phục.
create or replace function public.requalify_companies(p_ids uuid[])
returns int
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  update public.companies set disqualified_at = null, disqualify_reason = null, disqualify_note = null
   where id = any(p_ids) and disqualified_at is not null;
  get diagnostics v = row_count;
  return v;
end $$;

revoke execute on function public.disqualify_companies(uuid[], text, text) from public, anon;
revoke execute on function public.requalify_companies(uuid[]) from public, anon;
grant execute on function public.disqualify_companies(uuid[], text, text) to authenticated;
grant execute on function public.requalify_companies(uuid[]) to authenticated;

-- Từ khoá tự loại khi tìm công ty mới (khớp tên hoặc domain, không phân biệt dấu).
insert into public.settings (key, value) values ('discover_exclude_words', '[]'::jsonb)
on conflict (key) do nothing;
