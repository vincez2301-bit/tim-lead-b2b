-- Sync Lead Finder — Row Level Security và quyền (mục 7, mục 10.2).
-- Nguyên tắc: client (khoá anon + JWT) chỉ ĐỌC dữ liệu lead; mọi thao tác ghi pipeline
-- đi qua Edge Function dùng service_role (bỏ qua RLS). Admin ghi trực tiếp một số bảng
-- cấu hình (signal_codes, settings, do_not_contact, profiles.role) — có trigger audit.

alter table public.profiles       enable row level security;
alter table public.companies      enable row level security;
alter table public.contacts       enable row level security;
alter table public.signal_codes   enable row level security;
alter table public.observations   enable row level security;
alter table public.searches       enable row level security;
alter table public.runs           enable row level security;
alter table public.api_usage      enable row level security;
alter table public.do_not_contact enable row level security;
alter table public.settings       enable row level security;
alter table public.audit_log      enable row level security;
alter table public.cohorts        enable row level security;

-- Người chưa đăng nhập không có quyền gì trên schema public.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Dữ liệu lead: người dùng đã đăng nhập được đọc.
create policy "auth read companies"    on public.companies    for select to authenticated using (true);
create policy "auth read contacts"     on public.contacts     for select to authenticated using (true);
create policy "auth read observations" on public.observations for select to authenticated using (true);
create policy "auth read signals"      on public.signal_codes for select to authenticated using (true);

-- Chỉ admin đổi trạng thái / trọng số tín hiệu (giới hạn cột ở dưới).
create policy "admin update signals" on public.signal_codes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Mỗi người chỉ thấy search/run/cohort của mình (admin thấy tất cả).
create policy "own searches read" on public.searches for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "own searches insert" on public.searches for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "own searches update" on public.searches for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own searches delete" on public.searches for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "own runs read" on public.runs for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

create policy "own usage read" on public.api_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "own cohorts read" on public.cohorts for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "own cohorts insert" on public.cohorts for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "own cohorts update" on public.cohorts for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own cohorts delete" on public.cohorts for delete to authenticated
  using (owner_id = (select auth.uid()));

-- DNC: mọi người đọc, admin ghi.
create policy "read dnc" on public.do_not_contact for select to authenticated using (true);
create policy "admin insert dnc" on public.do_not_contact for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update dnc" on public.do_not_contact for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete dnc" on public.do_not_contact for delete to authenticated
  using ((select public.is_admin()));

-- Settings: người dùng đăng nhập ĐỌC được (cần khu vực, bộ từ khoá, hạn mức cho màn hình
-- Tìm kiếm — bảng này không chứa bí mật); chỉ admin ghi.
create policy "auth read settings" on public.settings for select to authenticated using (true);
create policy "admin insert settings" on public.settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin update settings" on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete settings" on public.settings for delete to authenticated
  using ((select public.is_admin()));

-- Audit: chỉ admin đọc; ghi bằng trigger security definer / service_role.
create policy "admin read audit" on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- Profiles: đọc hồ sơ của mình; admin đọc tất cả và đổi vai trò.
create policy "own profile" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "admin update roles" on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Giới hạn cột được phép cập nhật từ client.
revoke update on public.profiles from authenticated;
grant update (role) on public.profiles to authenticated;
revoke update on public.signal_codes from authenticated;
grant update (status, default_weight, description, cost_note, sort_order) on public.signal_codes to authenticated;
-- Bảng chỉ ghi qua Edge Function: thu hồi luôn quyền ghi ở mức GRANT (phòng thủ nhiều lớp).
revoke insert, update, delete on public.companies, public.contacts, public.observations,
  public.runs, public.api_usage, public.audit_log from authenticated;
revoke insert, delete on public.signal_codes, public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Quyền thực thi hàm
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

-- Dùng trong policy / view → authenticated cần quyền gọi.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_domain_dnc(text) to authenticated;
grant execute on function public.is_email_dnc(text) to authenticated;
grant execute on function public.signal_strength(jsonb, numeric) to authenticated;
grant execute on function public.setting(text) to authenticated;
grant execute on function public.cohort_search(jsonb) to authenticated;
-- Tự kiểm tra admin bên trong.
grant execute on function public.forget_subject(text, text, text, text) to authenticated;
grant execute on function public.purge_stale_leads(int) to authenticated;

-- Chỉ Edge Function (service_role) được gọi các hàm ghi pipeline / hạn mức.
revoke execute on function public.recompute_scores(uuid[]) from authenticated;
revoke execute on function public.upsert_companies(jsonb, uuid) from authenticated;
revoke execute on function public.reserve_units(uuid, uuid, text, int, int) from authenticated;
revoke execute on function public.refund_units(uuid, uuid, text, int) from authenticated;
revoke execute on function public.api_usage_today(text, uuid, int) from authenticated;
grant execute on all functions in schema public to service_role;
