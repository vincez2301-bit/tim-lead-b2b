-- Tìm đúng người phụ trách (spec 003):
--   runs.step 'find_people'          : Edge Function tìm người trên LinkedIn công khai (qua Google) và email công ty trên Internet
--   contacts.source linkedin|web|youtube : nguồn mới; Đọc website chỉ thay liên hệ 'auto', không xoá các nguồn này
--   contacts.note                     : giải thích ngắn, vd. email dự đoán theo mẫu nào, từ nguồn nào
--   companies.people_searched_at      : lần tìm gần nhất (không tìm lại trong 30 ngày, trừ khi bấm tìm lại)
--   settings.contact_roles            : vai trò cần tìm theo nhóm khách (sửa ở Cài đặt)

alter table public.runs drop constraint if exists runs_step_check;
alter table public.runs add constraint runs_step_check
  check (step in ('discover','find_website','profile','enrich_youtube','enrich_contact','find_people','score','export'));

alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source in ('auto','manual','google','linkedin','web','youtube'));

alter table public.contacts add column if not exists note text
  check (note is null or length(note) <= 300);

alter table public.companies add column if not exists people_searched_at timestamptz;

insert into public.settings (key, value) values
  ('contact_roles', $j${
    "broadcaster": ["Giám đốc nội dung", "Trưởng ban sản xuất", "Producer", "Head of Content"],
    "mcn": ["CEO", "Founder", "Head of Partnerships", "Content Manager"],
    "agency": ["Producer", "Executive Producer", "Head of Production", "Creative Director", "Post-production"],
    "film": ["Producer", "Post-production Supervisor", "Music Supervisor", "Editor"],
    "brand": ["Marketing Manager", "Brand Manager", "Head of Content", "Digital Marketing Manager"]
  }$j$::jsonb)
on conflict (key) do nothing;
