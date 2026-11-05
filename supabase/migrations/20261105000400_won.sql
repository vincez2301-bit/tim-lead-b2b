-- Khách đã ký: ngày ký, ngày hiệu lực hợp đồng. Nhập file với stage "won" luôn chuyển deal sang Thắng.

alter table public.deals
  add column signed_at date,
  add column effective_at date;
grant update (signed_at, effective_at) on public.deals to authenticated;

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
revoke all on public.deal_board from anon;
grant select on public.deal_board to authenticated;

create or replace function public.import_leads(p_rows jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb; c jsonb; a jsonb;
  v_name text; v_domain text; v_city text; v_segment text; v_company uuid; v_deal uuid;
  v_owner uuid; v_email text; v_contact uuid; v_stage text; v_new_deal boolean;
  st jsonb := jsonb_build_object('companies_created', 0, 'companies_matched', 0, 'deals_created', 0,
    'deals_updated', 0, 'contacts_added', 0, 'activities_added', 0, 'skipped_dnc', 0, 'skipped_invalid', 0);
  inc text;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được nhập lead' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 3000 then
    raise exception 'Dữ liệu phải là mảng tối đa 3000 dòng';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_name := nullif(btrim(left(r->>'name', 300)), '');
    v_domain := nullif(regexp_replace(lower(btrim(coalesce(r->>'domain', ''))), '^(https?://)?(www\.)?([^/]+).*$', '\3'), '');
    if v_domain is not null and v_domain !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$' then v_domain := null; end if;
    v_city := nullif(btrim(left(r->>'city', 100)), '');
    v_segment := case when r->>'segment' in ('broadcaster','mcn','agency','film','brand') then r->>'segment' end;
    v_stage := case when r->>'stage' in ('new','research','outreach','connected','meeting','proposal','commit','won','lost','nurture')
                    then r->>'stage' else 'new' end;
    if v_name is null then
      st := jsonb_set(st, '{skipped_invalid}', to_jsonb((st->>'skipped_invalid')::int + 1));
      continue;
    end if;
    if v_domain is not null and public.is_domain_dnc(v_domain) then
      st := jsonb_set(st, '{skipped_dnc}', to_jsonb((st->>'skipped_dnc')::int + 1));
      continue;
    end if;

    -- Khớp công ty: domain → tên (+ thành phố) → tên.
    v_company := null;
    if v_domain is not null then
      select id into v_company from public.companies where domain = v_domain;
    end if;
    if v_company is null then
      select id into v_company from public.companies
       where lower(name) = lower(v_name) and coalesce(city, '') = coalesce(v_city, '')
       order by domain nulls last limit 1;
    end if;
    if v_company is null then
      select id into v_company from public.companies where lower(name) = lower(v_name) order by first_seen_at limit 1;
    end if;
    if v_company is null then
      insert into public.companies (name, domain, website_url, segment, city, source, status)
      values (v_name, v_domain,
              case when r->>'website_url' ~* '^https?://' then left(r->>'website_url', 500) end,
              v_segment, v_city, 'manual', 'new')
      returning id into v_company;
      inc := 'companies_created';
    else
      update public.companies
         set segment = coalesce(segment, v_segment),
             city = coalesce(city, v_city),
             website_url = coalesce(website_url,
               case when r->>'website_url' ~* '^https?://' then left(r->>'website_url', 500) end)
       where id = v_company;
      if v_domain is not null then
        update public.companies set domain = v_domain
         where id = v_company and domain is null
           and not exists (select 1 from public.companies o where o.domain = v_domain and o.id <> v_company);
      end if;
      inc := 'companies_matched';
    end if;
    st := jsonb_set(st, array[inc], to_jsonb((st->>inc)::int + 1));

    v_owner := null;
    if r ? 'owner_email' then
      select p.user_id into v_owner from public.profiles p where lower(p.email) = lower(r->>'owner_email');
    end if;

    insert into public.deals (company_id, stage, owner_id, tier, next_action, next_action_at, est_arr_usd, probability,
                              expected_close, billing, source, notes, created_by, signed_at, effective_at)
    values (v_company, v_stage, v_owner,
            case when r->>'tier' in ('A','B','C') then r->>'tier' end,
            left(r->>'next_action', 300),
            case when r->>'next_action_at' ~ '^\d{4}-\d{2}-\d{2}' then left(r->>'next_action_at', 10)::date end,
            case when r->>'est_arr_usd' ~ '^\d+(\.\d+)?$' then (r->>'est_arr_usd')::numeric end,
            case when r->>'probability' ~ '^\d{1,3}$' and (r->>'probability')::int <= 100 then (r->>'probability')::int end,
            case when r->>'expected_close' ~ '^\d{4}-\d{2}-\d{2}' then left(r->>'expected_close', 10)::date end,
            case when r->>'billing' in ('annual','monthly','one_off') then r->>'billing' end,
            left(r->>'source', 100), left(r->>'notes', 10000), (select auth.uid()),
            case when r->>'signed_at' ~ '^\d{4}-\d{2}-\d{2}' then left(r->>'signed_at', 10)::date end,
            case when r->>'effective_at' ~ '^\d{4}-\d{2}-\d{2}' then left(r->>'effective_at', 10)::date end)
    on conflict (company_id) do update set
      -- "won" (khách đã ký) luôn được ghi đè; giai đoạn khác chỉ đổi khi deal còn ở "Lead mới".
      stage          = case when excluded.stage = 'won' or public.deals.stage = 'new' then excluded.stage
                            else public.deals.stage end,
      signed_at      = coalesce(excluded.signed_at, public.deals.signed_at),
      effective_at   = coalesce(excluded.effective_at, public.deals.effective_at),
      next_action    = case when excluded.stage = 'won' then null else coalesce(public.deals.next_action, excluded.next_action) end,
      next_action_at = case when excluded.stage = 'won' then null else coalesce(public.deals.next_action_at, excluded.next_action_at) end,
      owner_id       = coalesce(public.deals.owner_id, excluded.owner_id),
      tier           = coalesce(public.deals.tier, excluded.tier),
      est_arr_usd    = coalesce(public.deals.est_arr_usd, excluded.est_arr_usd),
      probability    = coalesce(public.deals.probability, excluded.probability),
      expected_close = coalesce(public.deals.expected_close, excluded.expected_close),
      billing        = coalesce(public.deals.billing, excluded.billing),
      source         = coalesce(public.deals.source, excluded.source),
      notes          = case when public.deals.notes is null then excluded.notes
                            when excluded.notes is null or strpos(public.deals.notes, excluded.notes) > 0 then public.deals.notes
                            else left(public.deals.notes || E'\n\n' || excluded.notes, 10000) end
    returning id, (xmax = 0) into v_deal, v_new_deal;
    inc := case when v_new_deal then 'deals_created' else 'deals_updated' end;
    st := jsonb_set(st, array[inc], to_jsonb((st->>inc)::int + 1));

    for c in select * from jsonb_array_elements(coalesce(r->'contacts', '[]'::jsonb)) loop
      v_email := nullif(lower(btrim(c->>'email')), '');
      if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
      if nullif(btrim(c->>'full_name'), '') is null and v_email is null then continue; end if;
      if v_email is not null and public.is_email_dnc(v_email) then
        st := jsonb_set(st, '{skipped_dnc}', to_jsonb((st->>'skipped_dnc')::int + 1));
        continue;
      end if;
      select id into v_contact from public.contacts
       where company_id = v_company
         and ((v_email is not null and lower(email) = v_email)
              or (v_email is null and lower(full_name) = lower(btrim(c->>'full_name'))))
       limit 1;
      if v_contact is null then
        insert into public.contacts (company_id, full_name, job_title, email, email_label, phone, source, confidence)
        values (v_company, left(btrim(c->>'full_name'), 200), left(btrim(c->>'job_title'), 200), v_email,
                case when v_email is not null then 'published' end, left(btrim(c->>'phone'), 50), 'manual', 1);
        st := jsonb_set(st, '{contacts_added}', to_jsonb((st->>'contacts_added')::int + 1));
      end if;
    end loop;

    for a in select * from jsonb_array_elements(coalesce(r->'activities', '[]'::jsonb)) loop
      if a->>'happened_at' !~ '^\d{4}-\d{2}-\d{2}' or a->>'channel' not in ('email','call','zalo','linkedin','meeting','event','other') then
        continue;
      end if;
      if not exists (
        select 1 from public.activities x
        where x.deal_id = v_deal and x.happened_at::date = left(a->>'happened_at', 10)::date
          and x.channel = a->>'channel' and coalesce(x.note, '') = coalesce(left(a->>'note', 5000), '')) then
        insert into public.activities (deal_id, user_id, channel, outcome, note, happened_at)
        values (v_deal, (select auth.uid()), a->>'channel',
                case when a->>'outcome' in ('done','no_answer','replied','positive','negative') then a->>'outcome' else 'done' end,
                left(a->>'note', 5000), (left(a->>'happened_at', 10) || ' 09:00:00+07')::timestamptz);
        st := jsonb_set(st, '{activities_added}', to_jsonb((st->>'activities_added')::int + 1));
      end if;
    end loop;
  end loop;

  insert into public.audit_log (user_id, action, detail) values ((select auth.uid()), 'import_leads', st);
  return st;
end $$;
