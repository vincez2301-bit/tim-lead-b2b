-- Sync Lead Finder — schema (mục 7 tài liệu kỹ thuật).
-- gen_random_uuid() có sẵn trong Postgres >= 13 nên không cần extension pgcrypto.

-- ---------------------------------------------------------------------------
-- Người dùng và vai trò
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tìm kiếm và lượt chạy pipeline
-- ---------------------------------------------------------------------------
create table public.searches (            -- cấu hình tìm kiếm đã lưu / đã chạy
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text,
  segment    text check (segment in ('agency','brand','film','mcn')),
  keywords   text[] not null,
  region     text not null,
  location   text,
  mode       text not null default 'search' check (mode in ('search','maps','both')),
  pages      int not null default 1 check (pages between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.runs (                -- mỗi lần chạy một bước pipeline
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  search_id           uuid references public.searches(id) on delete set null,
  step                text not null check (step in ('discover','profile','enrich_youtube','enrich_contact','score','export')),
  status              text not null default 'running' check (status in ('running','done','failed','partial')),
  provider            text check (provider in ('serper','youtube')),
  api_units_estimated int,
  api_units_used      int not null default 0,
  input               jsonb,            -- tham số đầu vào (đã kiểm tra)
  progress            jsonb,            -- phần việc còn lại để chạy tiếp (vd. khi hết quota)
  stats               jsonb,            -- kết quả tóm tắt
  error               text,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

-- Sổ cái sử dụng API để tính hạn mức ngày chính xác (kể cả khi một run kéo dài qua ngày).
create table public.api_usage (
  id         bigint generated always as identity primary key,
  run_id     uuid references public.runs(id) on delete set null,
  user_id    uuid references auth.users(id) on delete set null,
  provider   text not null check (provider in ('serper','youtube')),
  units      int not null,              -- âm = hoàn trả khi lời gọi thất bại
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lead
-- ---------------------------------------------------------------------------
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 1 and 300),
  domain           text unique check (domain is null or domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'),
  website_url      text check (website_url is null or website_url ~* '^https?://'),
  segment          text check (segment in ('agency','brand','film','mcn')),
  country          text default 'VN',
  city             text,
  status           text not null default 'new'
    check (status in ('new','profiled','enriched','unreachable','archived')),
  score            int check (score between 0 and 100),
  score_breakdown  jsonb,
  source           text check (source in ('search','maps','manual','seed')),
  source_run_id    uuid references public.runs(id) on delete set null,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  profiled_at      timestamptz,
  youtube_enriched_at  timestamptz,
  contacts_enriched_at timestamptz,
  last_exported_at timestamptz
);

-- Công ty không có website (từ Google Maps) được khử trùng theo tên + thành phố.
create unique index companies_no_domain_uniq
  on public.companies (lower(name), coalesce(city, ''))
  where domain is null;

create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  full_name    text,
  job_title    text,
  email        text,
  email_label  text check (email_label in ('verified','published','risky','guess','invalid')),
  phone        text,
  confidence   numeric check (confidence between 0 and 1),
  source       text not null default 'auto' check (source in ('auto','manual')),
  evidence_url text check (evidence_url is null or evidence_url ~* '^https?://'),
  created_at   timestamptz not null default now()
);

create table public.signal_codes (
  code           text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  description    text not null,
  source         text not null,
  cost_note      text,
  value_kind     text not null default 'boolean' check (value_kind in ('boolean','count','number')),
  default_weight numeric not null default 0,
  sort_order     int not null default 100,
  status         text not null default 'proposed'
    check (status in ('proposed','confirmed','rejected')),
  confirmed_by   uuid references auth.users(id) on delete set null,
  confirmed_at   timestamptz,
  updated_at     timestamptz not null default now()
);

create table public.observations (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.companies(id) on delete cascade,
  signal_code  text not null references public.signal_codes(code),
  value_num    numeric,
  value_text   text,
  confidence   numeric check (confidence between 0 and 1),
  evidence_url text not null check (evidence_url ~* '^https?://'),
  run_id       uuid references public.runs(id) on delete set null,
  observed_at  timestamptz not null default now()
);

create table public.do_not_contact (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('domain','email')),
  value      text not null check (length(value) between 3 and 320),
  reason     text not null check (reason in ('existing_customer','competitor','opted_out','other')),
  note       text,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  action     text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- Cohort đã lưu (màn hình Cohort builder → "lưu cohort").
create table public.cohorts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(name) between 1 and 120),
  filter     jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------
create index observations_company_signal_time_idx on public.observations (company_id, signal_code, observed_at desc, id desc);
create index observations_signal_value_idx        on public.observations (signal_code, value_num);
create index observations_run_idx                 on public.observations (run_id);
create index companies_score_idx                  on public.companies (score desc nulls last);
create index companies_segment_status_idx         on public.companies (segment, status);
create index companies_source_run_idx             on public.companies (source_run_id);
create index contacts_company_idx                 on public.contacts (company_id);
create index contacts_email_idx                   on public.contacts (lower(email));
create index runs_owner_started_idx               on public.runs (owner_id, started_at desc);
create index runs_search_idx                      on public.runs (search_id);
create index api_usage_provider_time_idx          on public.api_usage (provider, created_at);
create index api_usage_user_idx                   on public.api_usage (user_id, provider, created_at);
create index api_usage_run_idx                    on public.api_usage (run_id);
create index audit_log_created_idx                on public.audit_log (created_at desc);
create index audit_log_user_idx                   on public.audit_log (user_id, created_at desc);
create index searches_owner_idx                   on public.searches (owner_id, created_at desc);
create index cohorts_owner_idx                    on public.cohorts (owner_id);
create index signal_codes_confirmed_by_idx        on public.signal_codes (confirmed_by);
create index do_not_contact_added_by_idx          on public.do_not_contact (added_by);
create index settings_updated_by_idx              on public.settings (updated_by);
