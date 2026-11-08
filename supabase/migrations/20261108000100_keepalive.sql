-- Gói Free của Supabase tạm dừng project nếu 7 ngày không có hoạt động.
-- Edge Function keepalive (GitHub Actions gọi mỗi ngày) ghi một dòng heartbeat duy nhất;
-- bị gọi dồn dập thì mỗi phút cũng chỉ ghi một lần. Không ai ngoài service_role đọc/gọi được.
create table if not exists public.heartbeat (
  id    smallint primary key default 1 check (id = 1),
  at    timestamptz not null default now(),
  beats bigint not null default 0
);
alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from public, anon, authenticated;

create or replace function public.keepalive() returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare v timestamptz;
begin
  insert into public.heartbeat as h (id, at, beats) values (1, now(), 1)
  on conflict (id) do update set at = now(), beats = h.beats + 1
   where h.at < now() - interval '1 minute'
  returning h.at into v;
  return coalesce(v, (select h.at from public.heartbeat h where h.id = 1));
end $$;
revoke execute on function public.keepalive() from public, anon, authenticated;
grant execute on function public.keepalive() to service_role;
