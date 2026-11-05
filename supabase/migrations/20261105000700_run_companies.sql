-- Ghi lại mỗi lượt tìm (run discover) ra những công ty nào — để màn hình Tìm khách hiện
-- đúng danh sách kết quả của từng lượt, kể cả công ty đã có từ trước.

create table public.run_companies (
  run_id     uuid not null references public.runs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  is_new     boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (run_id, company_id)
);
create index run_companies_company_idx on public.run_companies (company_id);

alter table public.run_companies enable row level security;
revoke all on public.run_companies from anon;
revoke insert, update, delete on public.run_companies from authenticated;
grant select on public.run_companies to authenticated;
create policy "own run results read" on public.run_companies for select to authenticated
  using (exists (
    select 1 from public.runs r
    where r.id = run_id and (r.owner_id = (select auth.uid()) or (select public.is_admin()))
  ));

-- Lượt tìm cũ: chỉ biết các công ty mới (companies.source_run_id).
insert into public.run_companies (run_id, company_id, is_new, created_at)
select c.source_run_id, c.id, true, c.first_seen_at
from public.companies c
where c.source_run_id is not null
on conflict do nothing;

create or replace function public.upsert_companies(p_rows jsonb, p_run_id uuid)
returns table (company_id uuid, is_new boolean, company_domain text, company_name text)
language plpgsql volatile set search_path = '' as $$
declare
  r record;
  v_id uuid;
  v_new boolean;
begin
  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      name text, domain text, website_url text, segment text, city text, country text, source text)
  loop
    if r.domain is not null then
      insert into public.companies as c
        (name, domain, website_url, segment, city, country, source, source_run_id)
      values (r.name, r.domain, r.website_url, r.segment, r.city, coalesce(r.country, 'VN'), r.source, p_run_id)
      on conflict (domain) do update set
        last_seen_at = now(),
        segment = coalesce(c.segment, excluded.segment),
        city = coalesce(c.city, excluded.city),
        website_url = coalesce(c.website_url, excluded.website_url)
      returning c.id, (c.xmax = 0) into v_id, v_new;
    else
      insert into public.companies as c
        (name, domain, website_url, segment, city, country, source, source_run_id)
      values (r.name, null, null, r.segment, r.city, coalesce(r.country, 'VN'), r.source, p_run_id)
      on conflict (lower(name), coalesce(city, '')) where domain is null do update set
        last_seen_at = now(),
        segment = coalesce(c.segment, excluded.segment)
      returning c.id, (c.xmax = 0) into v_id, v_new;
    end if;
    if p_run_id is not null then
      insert into public.run_companies (run_id, company_id, is_new)
      values (p_run_id, v_id, v_new)
      on conflict on constraint run_companies_pkey do nothing;
    end if;
    company_id := v_id;
    is_new := v_new;
    company_domain := r.domain;
    company_name := r.name;
    return next;
  end loop;
end $$;
