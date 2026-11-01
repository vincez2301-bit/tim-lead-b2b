-- Sync Lead Finder — hàm, trigger, view.
-- Mọi hàm đặt search_path cố định (khuyến nghị của Supabase Security Advisor).

-- ---------------------------------------------------------------------------
-- Vai trò
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Tạo profile khi Supabase Auth tạo người dùng (người dùng được mời, không tự đăng ký).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Không cho phép hạ quyền admin cuối cùng (tránh tự khoá hệ thống).
create or replace function public.protect_last_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.role = 'admin' and new.role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Không thể hạ quyền admin cuối cùng';
  end if;
  return new;
end $$;

create trigger trg_protect_last_admin before update of role on public.profiles
for each row execute function public.protect_last_admin();

-- ---------------------------------------------------------------------------
-- Tín hiệu
-- ---------------------------------------------------------------------------
-- Trigger từ chối signal_code lạ hoặc chưa được xác nhận (mục 5, mục 7).
create or replace function public.check_signal_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.signal_codes
                 where code = new.signal_code and status = 'confirmed') then
    raise exception 'signal_code % không hợp lệ hoặc chưa được xác nhận', new.signal_code
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger trg_check_signal before insert on public.observations
for each row execute function public.check_signal_code();

-- Ghi người duyệt và thời điểm khi trạng thái tín hiệu đổi.
create or replace function public.signal_codes_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.confirmed_by := (select auth.uid());
    new.confirmed_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_signal_codes_before_update before update on public.signal_codes
for each row execute function public.signal_codes_before_update();

-- Độ mạnh tín hiệu trong [0,1] theo quy tắc cấu hình (settings.signal_rules):
--   boolean (mặc định): value > 0 → 1
--   threshold {min}:    value >= min → 1
--   linear {min,max}:   tuyến tính giữa min và max
--   log {min,max}:      tuyến tính theo log(1+value) — hợp với số subscriber
create or replace function public.signal_strength(p_rule jsonb, p_value numeric) returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  v_type text := coalesce(p_rule->>'type', 'boolean');
  v_min numeric := (p_rule->>'min')::numeric;
  v_max numeric := (p_rule->>'max')::numeric;
begin
  if p_value is null then return 0; end if;
  if v_type = 'threshold' then
    return case when p_value >= coalesce(v_min, 1) then 1 else 0 end;
  elsif v_type = 'linear' then
    if v_min is null or v_max is null or v_max <= v_min then
      return case when p_value > 0 then 1 else 0 end;
    end if;
    return greatest(0, least(1, (p_value - v_min) / (v_max - v_min)));
  elsif v_type = 'log' then
    if v_min is null or v_max is null or v_max <= v_min or p_value < 0 then
      return case when p_value > 0 then 1 else 0 end;
    end if;
    return greatest(0, least(1,
      (ln(p_value + 1) - ln(v_min + 1)) / (ln(v_max + 1) - ln(v_min + 1))));
  end if;
  return case when p_value > 0 then 1 else 0 end;
end $$;

-- ---------------------------------------------------------------------------
-- Danh sách loại trừ (DNC)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_dnc() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.value := lower(btrim(new.value));
  if new.kind = 'domain' then
    new.value := regexp_replace(new.value, '^[a-z][a-z0-9+.-]*://', '');  -- bỏ scheme
    new.value := regexp_replace(new.value, '^[^@/]*@', '');                -- bỏ user@
    new.value := regexp_replace(new.value, '[/?#:].*$', '');               -- bỏ path, port
    new.value := regexp_replace(new.value, '^www\.', '');
    new.value := rtrim(new.value, '.');
    if new.value !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z0-9-]+$' then
      raise exception 'Domain không hợp lệ: %', new.value using errcode = 'check_violation';
    end if;
  else
    if new.value !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Email không hợp lệ: %', new.value using errcode = 'check_violation';
    end if;
  end if;
  if new.added_by is null then new.added_by := (select auth.uid()); end if;
  return new;
end $$;

create trigger trg_normalize_dnc before insert or update on public.do_not_contact
for each row execute function public.normalize_dnc();

-- Domain (hoặc domain cha của nó) có trong DNC?
create or replace function public.is_domain_dnc(p_domain text) returns boolean
language sql stable set search_path = '' as $$
  select p_domain is not null and exists (
    select 1 from public.do_not_contact d
    where d.kind = 'domain'
      and (lower(p_domain) = d.value or right(lower(p_domain), length(d.value) + 1) = '.' || d.value)
  );
$$;

-- Email có trong DNC (trực tiếp, hoặc domain của email bị loại trừ)?
create or replace function public.is_email_dnc(p_email text) returns boolean
language sql stable set search_path = '' as $$
  select p_email is not null and (
    exists (select 1 from public.do_not_contact d
            where d.kind = 'email' and d.value = lower(btrim(p_email)))
    or public.is_domain_dnc(split_part(lower(btrim(p_email)), '@', 2))
  );
$$;

-- ---------------------------------------------------------------------------
-- Settings & audit
-- ---------------------------------------------------------------------------
create or replace function public.settings_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  return new;
end $$;

create trigger trg_settings_touch before insert or update on public.settings
for each row execute function public.settings_touch();

create or replace function public.setting(p_key text) returns jsonb
language sql stable set search_path = '' as $$
  select value from public.settings where key = p_key;
$$;

-- Ghi audit cho thay đổi tín hiệu / cài đặt / DNC / vai trò (mục 10.7).
create or replace function public.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (user_id, action, detail)
  values (
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
    )
  );
  return coalesce(new, old);
end $$;

create trigger trg_audit_signal_codes after insert or update or delete on public.signal_codes
for each row execute function public.audit_change();
create trigger trg_audit_settings after insert or update or delete on public.settings
for each row execute function public.audit_change();
create trigger trg_audit_dnc after insert or update or delete on public.do_not_contact
for each row execute function public.audit_change();
create trigger trg_audit_profiles after update of role on public.profiles
for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- View
-- ---------------------------------------------------------------------------
-- Observation mới nhất của mỗi (công ty, tín hiệu).
create view public.latest_observations with (security_invoker = true) as
  select distinct on (o.company_id, o.signal_code) o.*
  from public.observations o
  order by o.company_id, o.signal_code, o.observed_at desc, o.id desc;

-- Danh sách công ty kèm cờ DNC (giao diện ẩn công ty DNC theo mặc định).
create view public.company_list with (security_invoker = true) as
  select c.*, public.is_domain_dnc(c.domain) as is_dnc
  from public.companies c;

create view public.company_stats with (security_invoker = true) as
  select segment, status, count(*)::int as companies, round(avg(score), 1) as avg_score
  from public.companies
  group by segment, status;

-- ---------------------------------------------------------------------------
-- Chấm điểm (mục 6.1)
--   raw   = Σ weight × strength × confidence   (observation mới nhất, tín hiệu confirmed)
--   score = clamp(round(100 × raw / Σ weight dương), 0, 100)
-- ---------------------------------------------------------------------------
create or replace function public.recompute_scores(p_ids uuid[] default null) returns int
language sql volatile set search_path = '' as $$
  with rules as (
    select coalesce(public.setting('signal_rules'), '{}'::jsonb) as r
  ),
  sig as (
    select code, default_weight as w from public.signal_codes where status = 'confirmed'
  ),
  denom as (
    select coalesce(sum(w) filter (where w > 0), 0) as d from sig
  ),
  lo as (
    select distinct on (o.company_id, o.signal_code)
           o.company_id, o.signal_code, o.value_num, o.confidence, o.evidence_url, o.observed_at
    from public.observations o
    join sig on sig.code = o.signal_code
    where p_ids is null or o.company_id = any(p_ids)
    order by o.company_id, o.signal_code, o.observed_at desc, o.id desc
  ),
  contrib as (
    select lo.*, sig.w,
           public.signal_strength(rules.r -> lo.signal_code, lo.value_num) as strength
    from lo join sig on sig.code = lo.signal_code cross join rules
  ),
  agg as (
    select company_id,
           sum(w * strength * coalesce(confidence, 1)) as raw,
           jsonb_agg(jsonb_build_object(
             'code', signal_code,
             'weight', w,
             'value_num', value_num,
             'strength', round(strength, 3),
             'confidence', confidence,
             'contribution', round(w * strength * coalesce(confidence, 1), 3),
             'evidence_url', evidence_url,
             'observed_at', observed_at
           ) order by abs(w * strength * coalesce(confidence, 1)) desc, signal_code) as items
    from contrib group by company_id
  ),
  target as (
    select c.id, agg.raw, agg.items
    from public.companies c left join agg on agg.company_id = c.id
    where p_ids is null or c.id = any(p_ids)
  ),
  upd as (
    update public.companies c set
      score = case when denom.d > 0
                   then greatest(0, least(100, round(100 * coalesce(t.raw, 0) / denom.d)))::int
                   else 0 end,
      score_breakdown = jsonb_build_object(
        'raw', round(coalesce(t.raw, 0), 3),
        'max', denom.d,
        'computed_at', now(),
        'signals', coalesce(t.items, '[]'::jsonb))
    from target t cross join denom
    where c.id = t.id
    returning 1
  )
  select count(*)::int from upd;
$$;

-- ---------------------------------------------------------------------------
-- Cohort (mục 6.2) — hoàn toàn tham số hoá, không nối chuỗi SQL từ input.
-- p_filter: { must[], exclude[], ranges[{code,min,max}], min_score, max_score,
--             segments[], statuses[], q, include_dnc, limit, offset }
-- "Có tín hiệu" = observation mới nhất có strength > 0 theo signal_rules.
-- ---------------------------------------------------------------------------
create or replace function public.cohort_search(p_filter jsonb)
returns table (
  id uuid, name text, domain text, website_url text, segment text, city text,
  status text, score int, is_dnc boolean, total_count bigint
)
language sql stable set search_path = '' as $$
  with f as (
    select
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filter->'must', '[]'))), '{}') as must,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filter->'exclude', '[]'))), '{}') as excl,
      coalesce(p_filter->'ranges', '[]'::jsonb) as ranges,
      (p_filter->>'min_score')::int as min_score,
      (p_filter->>'max_score')::int as max_score,
      array(select jsonb_array_elements_text(coalesce(p_filter->'segments', '[]'))) as segments,
      array(select jsonb_array_elements_text(coalesce(p_filter->'statuses', '[]'))) as statuses,
      nullif(btrim(p_filter->>'q'), '') as q,
      coalesce((p_filter->>'include_dnc')::boolean, false) as include_dnc,
      least(greatest(coalesce((p_filter->>'limit')::int, 50), 0), 10000) as lim,
      greatest(coalesce((p_filter->>'offset')::int, 0), 0) as off,
      coalesce(public.setting('signal_rules'), '{}'::jsonb) as rules
  ),
  lo as (
    select distinct on (o.company_id, o.signal_code)
           o.company_id, o.signal_code, o.value_num
    from public.observations o
    join public.signal_codes s on s.code = o.signal_code and s.status = 'confirmed'
    order by o.company_id, o.signal_code, o.observed_at desc, o.id desc
  ),
  pr as (
    select lo.company_id, lo.signal_code, lo.value_num,
           public.signal_strength(f.rules -> lo.signal_code, lo.value_num) > 0 as present
    from lo cross join f
  ),
  matched as (
    select c.id, c.name, c.domain, c.website_url, c.segment, c.city, c.status, c.score,
           public.is_domain_dnc(c.domain) as is_dnc
    from public.companies c cross join f
    where (f.min_score is null or coalesce(c.score, 0) >= f.min_score)
      and (f.max_score is null or coalesce(c.score, 0) <= f.max_score)
      and (cardinality(f.segments) = 0 or c.segment = any(f.segments))
      and (cardinality(f.statuses) = 0 or c.status = any(f.statuses))
      and (f.q is null
           or c.name ilike '%' || replace(replace(replace(f.q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
           or c.domain ilike '%' || replace(replace(replace(f.q, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      and cardinality(f.must) = (
            select count(distinct pr.signal_code) from pr
            where pr.company_id = c.id and pr.signal_code = any(f.must) and pr.present)
      and not exists (
            select 1 from pr
            where pr.company_id = c.id and pr.signal_code = any(f.excl) and pr.present)
      and not exists (
            select 1 from jsonb_to_recordset(f.ranges) as r(code text, min numeric, max numeric)
            where not exists (
              select 1 from pr
              where pr.company_id = c.id and pr.signal_code = r.code
                and (r.min is null or pr.value_num >= r.min)
                and (r.max is null or pr.value_num <= r.max)))
  )
  select m.id, m.name, m.domain, m.website_url, m.segment, m.city, m.status, m.score, m.is_dnc,
         count(*) over () as total_count
  from matched m cross join f
  where f.include_dnc or not m.is_dnc
  order by m.score desc nulls last, m.name, m.id
  limit (select lim from f) offset (select off from f);
$$;

-- ---------------------------------------------------------------------------
-- Hạn mức API (mục 10.4). Ngày tính theo múi giờ của nhà cung cấp:
--   Serper: Asia/Ho_Chi_Minh; YouTube: America/Los_Angeles (quota reset lúc 0h PT).
-- ---------------------------------------------------------------------------
create or replace function public.quota_day_start(p_provider text) returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('day', now() at time zone tz) at time zone tz)
  from (select case when p_provider = 'youtube' then 'America/Los_Angeles'
                    else 'Asia/Ho_Chi_Minh' end as tz) z;
$$;

create or replace function public.api_usage_today(p_provider text, p_user uuid, p_global_cap int default null)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_start timestamptz := public.quota_day_start(p_provider);
  v_limits jsonb := coalesce(public.setting('limits'), '{}'::jsonb);
  v_lim_global int := coalesce((v_limits->>(p_provider || '_daily_global'))::int, 0);
  v_lim_user int := coalesce((v_limits->>(p_provider || '_daily_per_user'))::int, v_lim_global);
  v_used_global int;
  v_used_user int;
begin
  if p_global_cap is not null and p_global_cap >= 0 then
    v_lim_global := least(v_lim_global, p_global_cap);
  end if;
  select coalesce(sum(units), 0) into v_used_global
    from public.api_usage where provider = p_provider and created_at >= v_start;
  select coalesce(sum(units), 0) into v_used_user
    from public.api_usage where provider = p_provider and created_at >= v_start and user_id = p_user;
  return jsonb_build_object(
    'provider', p_provider,
    'day_start', v_start,
    'used_global', v_used_global, 'limit_global', v_lim_global,
    'used_user', v_used_user, 'limit_user', v_lim_user,
    'remaining', greatest(0, least(v_lim_global - v_used_global, v_lim_user - v_used_user)),
    'warn_ratio', coalesce((v_limits->>'warn_ratio')::numeric, 0.8)
  );
end $$;

-- Giữ chỗ (trừ trước) p_units đơn vị; khoá advisory để hai request song song
-- không cùng vượt hạn mức. Trả về {ok:false,...} nếu vượt.
create or replace function public.reserve_units(
  p_run_id uuid, p_user uuid, p_provider text, p_units int, p_global_cap int default null)
returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_usage jsonb;
begin
  if p_units <= 0 then
    raise exception 'p_units phải > 0';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('quota:' || p_provider, 0));
  v_usage := public.api_usage_today(p_provider, p_user, p_global_cap);
  if (v_usage->>'remaining')::int < p_units then
    return v_usage || jsonb_build_object('ok', false);
  end if;
  insert into public.api_usage (run_id, user_id, provider, units)
  values (p_run_id, p_user, p_provider, p_units);
  update public.runs set api_units_used = api_units_used + p_units where id = p_run_id;
  return v_usage || jsonb_build_object(
    'ok', true,
    'used_global', (v_usage->>'used_global')::int + p_units,
    'used_user', (v_usage->>'used_user')::int + p_units,
    'remaining', (v_usage->>'remaining')::int - p_units);
end $$;

-- Hoàn trả khi lời gọi API thất bại (mục 4.1: "không trừ quota nội bộ").
create or replace function public.refund_units(p_run_id uuid, p_user uuid, p_provider text, p_units int)
returns void
language sql volatile set search_path = '' as $$
  insert into public.api_usage (run_id, user_id, provider, units)
  values (p_run_id, p_user, p_provider, -abs(p_units));
  update public.runs set api_units_used = greatest(0, api_units_used - abs(p_units)) where id = p_run_id;
$$;

-- ---------------------------------------------------------------------------
-- Discover: upsert công ty theo domain (hoặc tên + thành phố khi không có website).
-- ---------------------------------------------------------------------------
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
    company_id := v_id;
    is_new := v_new;
    company_domain := r.domain;
    company_name := r.name;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Quyền yêu cầu xoá (mục 10.6 #4): xoá dữ liệu theo email/domain và thêm vào DNC.
-- ---------------------------------------------------------------------------
create or replace function public.forget_subject(
  p_kind text, p_value text, p_reason text default 'opted_out', p_note text default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_value text := lower(btrim(p_value));
  v_companies int := 0;
  v_contacts int := 0;
  v_obs int := 0;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được xoá dữ liệu theo yêu cầu' using errcode = 'insufficient_privilege';
  end if;
  if p_kind not in ('domain', 'email') then
    raise exception 'kind phải là domain hoặc email';
  end if;

  -- Chuẩn hoá qua trigger normalize_dnc bằng cách chèn DNC trước.
  insert into public.do_not_contact (kind, value, reason, note, added_by)
  values (p_kind, v_value, coalesce(p_reason, 'opted_out'), p_note, (select auth.uid()))
  on conflict (kind, value) do nothing;
  if p_kind = 'domain' then
    v_value := regexp_replace(regexp_replace(regexp_replace(v_value, '^[a-z][a-z0-9+.-]*://', ''), '[/?#:].*$', ''), '^www\.', '');
    with d as (
      delete from public.companies
      where domain = v_value or right(domain, length(v_value) + 1) = '.' || v_value
      returning 1)
    select count(*) into v_companies from d;
  else
    with d as (delete from public.contacts where lower(email) = v_value returning 1)
    select count(*) into v_contacts from d;
    with d as (
      delete from public.observations
      where signal_code = 'HAS_EMAIL' and position(v_value in lower(coalesce(value_text, ''))) > 0
      returning 1)
    select count(*) into v_obs from d;
  end if;

  insert into public.audit_log (user_id, action, detail)
  values ((select auth.uid()), 'forget_subject', jsonb_build_object(
    'kind', p_kind, 'value', v_value, 'companies_deleted', v_companies,
    'contacts_deleted', v_contacts, 'observations_deleted', v_obs));

  return jsonb_build_object('kind', p_kind, 'value', v_value, 'companies_deleted', v_companies,
                            'contacts_deleted', v_contacts, 'observations_deleted', v_obs);
end $$;

-- ---------------------------------------------------------------------------
-- Thời hạn lưu trữ (mục 10.6 #3): xoá lead không có tương tác sau N tháng.
-- "Tương tác" = được tìm thấy lại, được profile, hoặc được export.
-- Lên lịch bằng pg_cron (xem README), hoặc admin chạy tay.
-- ---------------------------------------------------------------------------
create or replace function public.purge_stale_leads(p_months int default null) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_months int := coalesce(p_months, (public.setting('retention')->>'months')::int, 12);
  v_count int;
begin
  -- Người dùng đăng nhập phải là admin; service_role / pg_cron (không có auth.uid()) được phép.
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Chỉ admin được chạy purge' using errcode = 'insufficient_privilege';
  end if;
  if v_months < 1 then
    raise exception 'Số tháng lưu trữ phải >= 1';
  end if;
  with d as (
    delete from public.companies
    where greatest(last_seen_at, coalesce(profiled_at, last_seen_at), coalesce(last_exported_at, last_seen_at))
          < now() - make_interval(months => v_months)
    returning 1)
  select count(*) into v_count from d;
  insert into public.audit_log (user_id, action, detail)
  values ((select auth.uid()), 'purge_stale_leads', jsonb_build_object('months', v_months, 'deleted', v_count));
  return v_count;
end $$;
