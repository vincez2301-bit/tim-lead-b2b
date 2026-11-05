-- Email nhắc việc mỗi sáng: cài đặt, nhật ký gửi (mỗi ngày một dòng) và lịch gọi Edge Function daily_digest.

create table public.digest_log (
  day        date primary key,            -- ngày theo giờ Việt Nam
  sent_at    timestamptz not null default now(),
  recipients text[] not null,
  tasks      int not null default 0
);
alter table public.digest_log enable row level security;
revoke all on public.digest_log from anon, authenticated;
grant select on public.digest_log to authenticated;
create policy "admin read digest log" on public.digest_log for select to authenticated
  using ((select public.is_admin()));

-- function_url / app_url do app ghi khi admin bật tính năng (biết đúng địa chỉ của từng môi trường).
insert into public.settings (key, value) values
  ('daily_digest', '{"enabled": false, "hour": 7, "recipients": [], "new_per_day": 2, "app_url": "", "function_url": ""}')
on conflict (key) do nothing;

-- pg_cron gọi hàm này mỗi giờ; chỉ gọi Edge Function khi đã bật, đã tới giờ hẹn và hôm nay chưa gửi.
-- Edge Function kiểm tra lại các điều kiện này và tự khoá để không gửi trùng.
create or replace function public.trigger_daily_digest() returns void
language plpgsql security definer set search_path = '' as $$
declare
  cfg jsonb := public.setting('daily_digest');
  vn timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
begin
  if cfg is null or coalesce((cfg->>'enabled')::boolean, false) is not true then return; end if;
  if coalesce(cfg->>'function_url', '') !~ '^https://[a-z0-9.-]+/functions/v1/daily_digest$' then return; end if;
  if extract(hour from vn) < coalesce((cfg->>'hour')::int, 7) then return; end if;
  if exists (select 1 from public.digest_log where day = vn::date) then return; end if;
  perform net.http_post(
    url := cfg->>'function_url',
    body := '{"source": "cron"}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;
revoke execute on function public.trigger_daily_digest() from public, anon, authenticated;

-- Lịch chạy: phút thứ 5 mỗi giờ. Chỉ tạo khi máy chủ có pg_cron và pg_net (Supabase có sẵn;
-- Postgres thường dùng để chạy test thì không).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('bigfish-daily-digest', '5 * * * *', 'select public.trigger_daily_digest()');
  end if;
end $$;
