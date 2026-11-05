-- Pipeline bán hàng dùng chung cho cả nhóm:
--   deals      : mỗi công ty tối đa một deal (giai đoạn, người phụ trách, đánh giá, dự báo)
--   activities : điểm chạm (email, gọi, Zalo, LinkedIn, gặp…) — mục tiêu ≥ 19 điểm chạm / khách
-- Thêm nhóm khách "broadcaster" (đài truyền hình). Thứ tự ưu tiên: broadcaster, MCN, production house, brand.

-- ---------------------------------------------------------------------------
-- 1. Nhóm khách broadcaster
-- ---------------------------------------------------------------------------
alter table public.companies drop constraint if exists companies_segment_check;
alter table public.companies add constraint companies_segment_check
  check (segment in ('broadcaster','mcn','agency','film','brand'));
alter table public.searches drop constraint if exists searches_segment_check;
alter table public.searches add constraint searches_segment_check
  check (segment in ('broadcaster','mcn','agency','film','brand'));

-- ---------------------------------------------------------------------------
-- 2. Bảng
-- ---------------------------------------------------------------------------
create table public.deals (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null unique references public.companies(id) on delete cascade,
  stage              text not null default 'new' check (stage in
                       ('new','research','outreach','connected','meeting','proposal','commit','won','lost','nurture')),
  owner_id           uuid references auth.users(id) on delete set null,
  tier               text check (tier in ('A','B','C')),
  qualification      jsonb not null default '{}'::jsonb check (jsonb_typeof(qualification) = 'object'),
  next_action        text check (length(next_action) <= 300),
  next_action_at     date,
  cadence_started_at date,
  est_arr_usd        numeric check (est_arr_usd >= 0 and est_arr_usd < 100000000),
  probability        int check (probability between 0 and 100),
  expected_close     date,
  billing            text check (billing in ('annual','monthly','one_off')),
  lost_reason        text check (length(lost_reason) <= 500),
  source             text check (length(source) <= 100),
  notes              text check (length(notes) <= 10000),
  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  stage_changed_at   timestamptz not null default now()
);
create index deals_stage_idx on public.deals (stage);
create index deals_owner_idx on public.deals (owner_id);
create index deals_next_action_idx on public.deals (next_action_at) where stage not in ('won','lost');

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null default auth.uid(),
  channel     text not null check (channel in ('email','call','zalo','linkedin','meeting','event','other')),
  outcome     text not null default 'done' check (outcome in ('done','no_answer','replied','positive','negative')),
  step        int check (step between 1 and 50),
  note        text check (length(note) <= 5000),
  happened_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index activities_deal_idx on public.activities (deal_id, happened_at desc);
create index activities_contact_idx on public.activities (contact_id);
create index activities_user_idx on public.activities (user_id);
create index deals_created_by_idx on public.deals (created_by);

-- ---------------------------------------------------------------------------
-- 3. Trigger
-- ---------------------------------------------------------------------------
create or replace function public.deals_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  if new.stage = 'outreach' and new.cadence_started_at is null then
    new.cadence_started_at := current_date;
  end if;
  return new;
end $$;
create trigger trg_deals_before_write before insert or update on public.deals
for each row execute function public.deals_before_write();

-- Điểm chạm mới → deal được coi là "vừa có tương tác" (updated_at), dùng cho purge.
create or replace function public.activities_touch_deal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.deals set updated_at = now() where id = coalesce(new.deal_id, old.deal_id);
  return coalesce(new, old);
end $$;
create trigger trg_activities_touch_deal after insert or update or delete on public.activities
for each row execute function public.activities_touch_deal();

-- ---------------------------------------------------------------------------
-- 4. View cho bảng pipeline
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. RLS: cả nhóm xem và ghi được deal / điểm chạm của nhau
-- ---------------------------------------------------------------------------
alter table public.deals enable row level security;
alter table public.activities enable row level security;
revoke all on public.deals, public.activities, public.deal_board from anon;
revoke all on public.deals from authenticated;
grant select, insert, delete on public.deals to authenticated;
-- Không cho sửa created_by / created_at / updated_at / stage_changed_at từ client.
grant update (stage, owner_id, tier, qualification, next_action, next_action_at, cadence_started_at, est_arr_usd,
              probability, expected_close, billing, lost_reason, source, notes) on public.deals to authenticated;
revoke all on public.activities from authenticated;
grant select, insert, delete on public.activities to authenticated;
grant update (contact_id, channel, outcome, step, note, happened_at) on public.activities to authenticated;
grant select on public.deal_board to authenticated;

create policy "team read deals"   on public.deals for select to authenticated using (true);
create policy "team insert deals" on public.deals for insert to authenticated
  with check (created_by is null or created_by = (select auth.uid()));
create policy "team update deals" on public.deals for update to authenticated using (true) with check (true);
create policy "admin delete deals" on public.deals for delete to authenticated using ((select public.is_admin()));

create policy "team read activities"   on public.activities for select to authenticated using (true);
create policy "team insert activities" on public.activities for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own update activities" on public.activities for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "own delete activities" on public.activities for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Danh sách thành viên (để chọn người phụ trách): mọi người đăng nhập đọc được email + vai trò.
create or replace function public.team_members() returns table (user_id uuid, email text, role text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.email, p.role from public.profiles p
  where (select auth.uid()) is not null
  order by p.email;
$$;

-- ---------------------------------------------------------------------------
-- 6. Cập nhật nhóm khách / thành phố của công ty khi đánh giá lead (bảng companies chỉ ghi qua hàm)
-- ---------------------------------------------------------------------------
create or replace function public.update_company_profile(p_company_id uuid, p_segment text, p_city text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Cần đăng nhập' using errcode = 'insufficient_privilege';
  end if;
  if p_segment is not null and p_segment not in ('broadcaster','mcn','agency','film','brand') then
    raise exception 'Nhóm khách không hợp lệ: %', p_segment;
  end if;
  update public.companies
     set segment = p_segment,
         city = nullif(btrim(left(p_city, 100)), '')
   where id = p_company_id;
end $$;

-- Thêm người liên hệ thủ công khi đánh giá / tiếp cận (contacts chỉ ghi qua hàm).
create or replace function public.add_contact(
  p_company_id uuid, p_full_name text, p_job_title text default null, p_email text default null, p_phone text default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(p_email)), '');
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Cần đăng nhập' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(p_full_name), '') is null and v_email is null then
    raise exception 'Cần tên hoặc email';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email không hợp lệ';
  end if;
  if v_email is not null and public.is_email_dnc(v_email) then
    raise exception 'Email này nằm trong danh sách loại trừ';
  end if;
  insert into public.contacts (company_id, full_name, job_title, email, email_label, phone, source, confidence)
  values (p_company_id, left(btrim(p_full_name), 200), left(btrim(p_job_title), 200), v_email,
          case when v_email is not null then 'published' end, left(btrim(p_phone), 50), 'manual', 1)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Nhập lead từ file (admin). p_rows: mảng object
--   { name, domain?, website_url?, segment?, city?, source?, stage?, tier?, owner_email?,
--     next_action?, next_action_at?, est_arr_usd?, probability?, expected_close?, billing?, notes?,
--     contacts: [{full_name, job_title?, email?, phone?}],
--     activities: [{happened_at, channel, outcome?, note?}] }
-- Chạy lại cùng file không nhân đôi dữ liệu (khớp công ty, liên hệ, điểm chạm đã có).
-- ---------------------------------------------------------------------------
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
             domain = coalesce(domain, v_domain)
       where id = v_company
         and (v_domain is null or not exists (select 1 from public.companies o where o.domain = v_domain and o.id <> v_company));
      inc := 'companies_matched';
    end if;
    st := jsonb_set(st, array[inc], to_jsonb((st->>inc)::int + 1));

    v_owner := null;
    if r ? 'owner_email' then
      select p.user_id into v_owner from public.profiles p where lower(p.email) = lower(r->>'owner_email');
    end if;

    insert into public.deals (company_id, stage, owner_id, tier, next_action, next_action_at, est_arr_usd, probability,
                              expected_close, billing, source, notes, created_by)
    values (v_company, v_stage, v_owner,
            case when r->>'tier' in ('A','B','C') then r->>'tier' end,
            left(r->>'next_action', 300),
            case when r->>'next_action_at' ~ '^\d{4}-\d{2}-\d{2}' then left(r->>'next_action_at', 10)::date end,
            case when r->>'est_arr_usd' ~ '^\d+(\.\d+)?$' then (r->>'est_arr_usd')::numeric end,
            case when r->>'probability' ~ '^\d{1,3}$' and (r->>'probability')::int <= 100 then (r->>'probability')::int end,
            case when r->>'expected_close' ~ '^\d{4}-\d{2}-\d{2}' then left(r->>'expected_close', 10)::date end,
            case when r->>'billing' in ('annual','monthly','one_off') then r->>'billing' end,
            left(r->>'source', 100), left(r->>'notes', 10000), (select auth.uid()))
    on conflict (company_id) do update set
      stage          = case when public.deals.stage = 'new' then excluded.stage else public.deals.stage end,
      owner_id       = coalesce(public.deals.owner_id, excluded.owner_id),
      tier           = coalesce(public.deals.tier, excluded.tier),
      next_action    = coalesce(public.deals.next_action, excluded.next_action),
      next_action_at = coalesce(public.deals.next_action_at, excluded.next_action_at),
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

-- ---------------------------------------------------------------------------
-- 8. Purge không xoá công ty đang có deal còn tương tác trong thời hạn lưu trữ
-- ---------------------------------------------------------------------------
create or replace function public.purge_stale_leads(p_months int default null) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_months int := coalesce(p_months, (public.setting('retention')->>'months')::int, 12);
  v_count int;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Chỉ admin được chạy purge' using errcode = 'insufficient_privilege';
  end if;
  if v_months < 1 then
    raise exception 'Số tháng lưu trữ phải >= 1';
  end if;
  with d as (
    delete from public.companies c
    where greatest(c.last_seen_at, coalesce(c.profiled_at, c.last_seen_at), coalesce(c.last_exported_at, c.last_seen_at))
          < now() - make_interval(months => v_months)
      and not exists (
        select 1 from public.deals dl
        where dl.company_id = c.id and dl.updated_at >= now() - make_interval(months => v_months))
    returning 1)
  select count(*) into v_count from d;
  insert into public.audit_log (user_id, action, detail)
  values ((select auth.uid()), 'purge_stale_leads', jsonb_build_object('months', v_months, 'deleted', v_count));
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Quyền thực thi
-- ---------------------------------------------------------------------------
revoke execute on function public.deals_before_write(), public.activities_touch_deal(),
  public.team_members(), public.update_company_profile(uuid, text, text), public.import_leads(jsonb),
  public.add_contact(uuid, text, text, text, text), public.purge_stale_leads(int) from public, anon;
grant execute on function public.team_members(), public.update_company_profile(uuid, text, text),
  public.import_leads(jsonb), public.add_contact(uuid, text, text, text, text), public.purge_stale_leads(int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Cấu hình mặc định: lịch 19 điểm chạm, tiêu chí đánh giá, từ khoá broadcaster
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('cadence', $json$[
    {"step": 1,  "day": 0,  "channel": "linkedin", "title": "Gửi kết nối LinkedIn", "hint": "Lời nhắn ngắn, nhắc tới dự án/kênh của họ."},
    {"step": 2,  "day": 0,  "channel": "email",    "title": "Email mở lời cá nhân hoá", "hint": "Dựa trên tín hiệu: kênh YouTube, dự án gần đây, tin tuyển dụng."},
    {"step": 3,  "day": 1,  "channel": "call",     "title": "Gọi điện lần 1", "hint": "Không nghe máy → chuyển sang Zalo ngay trong ngày."},
    {"step": 4,  "day": 2,  "channel": "zalo",     "title": "Gửi Zalo vài bản nhạc mẫu đúng ngành", "hint": "Gửi 2–3 link nhạc hợp với nội dung họ đang làm."},
    {"step": 5,  "day": 4,  "channel": "email",    "title": "Email case study", "hint": "Khách Việt Nam cùng nhóm (đài, MCN, production house)."},
    {"step": 6,  "day": 6,  "channel": "call",     "title": "Gọi điện lần 2", "hint": "Đổi khung giờ so với lần 1."},
    {"step": 7,  "day": 7,  "channel": "linkedin", "title": "Tương tác / nhắn tin LinkedIn", "hint": "Bình luận bài đăng hoặc nhắn tin ngắn."},
    {"step": 8,  "day": 10, "channel": "email",    "title": "Email giá trị: bản quyền & Content ID", "hint": "Rủi ro claim, cách safelist kênh."},
    {"step": 9,  "day": 13, "channel": "zalo",     "title": "Gửi Zalo playlist theo dự án", "hint": "Tuyển chọn nhạc cho một dự án cụ thể của họ."},
    {"step": 10, "day": 16, "channel": "call",     "title": "Gọi điện lần 3", "hint": "Hỏi thẳng nhu cầu nhạc quý tới."},
    {"step": 11, "day": 20, "channel": "email",    "title": "Mời demo 15 phút / dùng thử", "hint": "Đưa 2 khung giờ cụ thể."},
    {"step": 12, "day": 27, "channel": "email",    "title": "Liên hệ người thứ 2 trong công ty", "hint": "Producer / người có thể giới thiệu nội bộ. Hết chặng A không phản hồi → email tạm dừng, chuyển Nuôi dưỡng."},
    {"step": 13, "day": 35, "channel": "meeting",  "title": "Buổi tìm hiểu nhu cầu", "hint": "Xác nhận 8 tiêu chí đánh giá."},
    {"step": 14, "day": 40, "channel": "meeting",  "title": "Demo sản phẩm", "hint": "Dùng nội dung thật của khách."},
    {"step": 15, "day": 44, "channel": "email",    "title": "Gửi đề xuất & báo giá", "hint": "Ghi ARR dự kiến và ngày chốt."},
    {"step": 16, "day": 48, "channel": "call",     "title": "Theo dõi đề xuất", "hint": "Hỏi phản hồi, ai cần duyệt."},
    {"step": 17, "day": 55, "channel": "meeting",  "title": "Gặp người quyết định", "hint": "Có ambassador nội bộ đi cùng nếu được."},
    {"step": 18, "day": 60, "channel": "email",    "title": "Xử lý băn khoăn", "hint": "Giá, điều khoản, kỹ thuật."},
    {"step": 19, "day": 66, "channel": "meeting",  "title": "Ký hợp đồng", "hint": "Chuyển sang Thắng và bàn giao onboarding."}
  ]$json$::jsonb),
  ('qualification_criteria', $json$[
    {"key": "uses_music",   "label": "Họ có dùng nhạc trong nội dung không?"},
    {"key": "outsourcing",  "label": "Nếu không tự chọn nhạc, họ có thuê bên ngoài chọn nhạc không?"},
    {"key": "revenue_fit",  "label": "Doanh thu có đủ trả chi phí Epidemic Sound không?"},
    {"key": "should_budget","label": "Chưa có ngân sách nhạc nhưng rõ ràng nên có?"},
    {"key": "decision_maker","label": "Người đang trao đổi là người quyết định?"},
    {"key": "ambassador",   "label": "Nếu không, họ có thể làm “ambassador” giới thiệu nội bộ?"},
    {"key": "door_opener",  "label": "Có người giới thiệu / “door-opener”?"},
    {"key": "sonic_branding","label": "(Brand) Họ hiểu Sonic Branding và có quan tâm rõ ràng?"}
  ]$json$::jsonb)
on conflict (key) do nothing;

update public.settings
   set value = value || $json${"broadcaster": ["đài truyền hình", "kênh truyền hình", "television station Vietnam",
     "đài phát thanh truyền hình tỉnh", "TV channel Vietnam", "nhà đài sản xuất chương trình"]}$json$::jsonb
 where key = 'keyword_sets' and not (value ? 'broadcaster');
