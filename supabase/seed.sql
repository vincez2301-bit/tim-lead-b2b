-- Dữ liệu mẫu cho môi trường DEV (mục 12). Chạy tự động khi `supabase db reset` ở local.
-- KHÔNG chạy trên production: file này tự xác nhận mọi tín hiệu để có dữ liệu demo.
-- Domain dùng TLD .example (dành riêng, không tồn tại) để không ai vô tình đọc website thật.

update public.signal_codes set status = 'confirmed' where status = 'proposed';

insert into public.companies (id, name, domain, website_url, segment, city, status, source) values
  ('a0000000-0000-0000-0000-000000000001', 'Alpha Production House', 'alpha-production.example', 'https://alpha-production.example/', 'agency', 'TP.HCM', 'enriched', 'seed'),
  ('a0000000-0000-0000-0000-000000000002', 'Beta Cosmetics',         'beta-cosmetics.example',   'https://beta-cosmetics.example/',   'brand',  'Hà Nội', 'profiled', 'seed'),
  ('a0000000-0000-0000-0000-000000000003', 'Gamma Films Studio',     'gamma-films.example',      'https://gamma-films.example/',      'film',   'TP.HCM', 'profiled', 'seed'),
  ('a0000000-0000-0000-0000-000000000004', 'Delta Creator Network',  'delta-mcn.example',        'https://delta-mcn.example/',        'mcn',    'Hà Nội', 'enriched', 'seed'),
  ('a0000000-0000-0000-0000-000000000005', 'Quán Phở Epsilon',       null,                       null,                                'brand',  'Đà Nẵng', 'new',     'seed')
on conflict do nothing;

insert into public.observations (company_id, signal_code, value_num, value_text, confidence, evidence_url) values
  ('a0000000-0000-0000-0000-000000000001', 'HIRING_VIDEO_ROLE', 1, 'Video Editor', 0.9, 'https://alpha-production.example/tuyen-dung'),
  ('a0000000-0000-0000-0000-000000000001', 'TVC_PORTFOLIO',     1, 'TVC', 0.85, 'https://alpha-production.example/du-an'),
  ('a0000000-0000-0000-0000-000000000001', 'HAS_SHOWREEL',      1, 'showreel', 0.9, 'https://alpha-production.example/'),
  ('a0000000-0000-0000-0000-000000000001', 'HAS_EMAIL',         1, 'info@alpha-production.example', 0.95, 'https://alpha-production.example/lien-he'),
  ('a0000000-0000-0000-0000-000000000001', 'HAS_YOUTUBE',       1, 'https://www.youtube.com/@alphaproduction', 0.9, 'https://alpha-production.example/'),
  ('a0000000-0000-0000-0000-000000000001', 'ACTIVE_YOUTUBE',    6, '6 video trong 30 ngày', 0.9, 'https://www.youtube.com/@alphaproduction'),
  ('a0000000-0000-0000-0000-000000000001', 'YT_SUBSCRIBERS',    12000, 'Alpha Production', 0.9, 'https://www.youtube.com/@alphaproduction'),
  ('a0000000-0000-0000-0000-000000000001', 'DECISION_MAKER_FOUND', 1, 'Nguyễn Văn An — Giám Đốc Sáng Tạo', 0.75, 'https://alpha-production.example/doi-ngu'),
  ('a0000000-0000-0000-0000-000000000002', 'RUNNING_META_ADS',  1, 'Meta Pixel', 0.9, 'https://beta-cosmetics.example/'),
  ('a0000000-0000-0000-0000-000000000002', 'HAS_TIKTOK',        1, 'https://www.tiktok.com/@betacosmetics', 0.9, 'https://beta-cosmetics.example/'),
  ('a0000000-0000-0000-0000-000000000002', 'HAS_EMAIL',         1, 'marketing@beta-cosmetics.example', 0.8, 'https://beta-cosmetics.example/lien-he'),
  ('a0000000-0000-0000-0000-000000000002', 'HIRING_VIDEO_ROLE', 1, 'Content Creator', 0.7, 'https://beta-cosmetics.example/tuyen-dung'),
  ('a0000000-0000-0000-0000-000000000003', 'TVC_PORTFOLIO',     1, 'TVC', 0.8, 'https://gamma-films.example/'),
  ('a0000000-0000-0000-0000-000000000003', 'ENGLISH_SITE',      1, 'lang=en', 0.9, 'https://gamma-films.example/'),
  ('a0000000-0000-0000-0000-000000000004', 'HAS_YOUTUBE',       3, 'https://www.youtube.com/@delta1', 0.9, 'https://delta-mcn.example/'),
  ('a0000000-0000-0000-0000-000000000004', 'MULTI_CHANNEL_OWNER', 3, '3 kênh', 0.8, 'https://www.youtube.com/@delta1'),
  ('a0000000-0000-0000-0000-000000000004', 'ACTIVE_YOUTUBE',    15, '15 video trong 30 ngày', 0.9, 'https://www.youtube.com/@delta1'),
  ('a0000000-0000-0000-0000-000000000005', 'NO_WEBSITE',        1, 'Chỉ có trên Google Maps', 0.9, 'https://www.google.com/maps/search/?api=1&query=Ph%E1%BB%9F+Epsilon'),
  ('a0000000-0000-0000-0000-000000000005', 'HAS_PHONE',         1, '0901 234 567', 0.8, 'https://www.google.com/maps/search/?api=1&query=Ph%E1%BB%9F+Epsilon');

insert into public.contacts (company_id, full_name, job_title, email, email_label, confidence, evidence_url) values
  ('a0000000-0000-0000-0000-000000000001', 'Nguyễn Văn An', 'Giám Đốc Sáng Tạo', 'annv@alpha-production.example', 'guess', 0.45, 'https://alpha-production.example/doi-ngu'),
  ('a0000000-0000-0000-0000-000000000001', null, null, 'info@alpha-production.example', 'risky', 0.95, 'https://alpha-production.example/lien-he'),
  ('a0000000-0000-0000-0000-000000000002', null, null, 'marketing@beta-cosmetics.example', 'risky', 0.8, 'https://beta-cosmetics.example/lien-he');

insert into public.do_not_contact (kind, value, reason, note) values
  ('domain', 'gamma-films.example', 'existing_customer', 'Dữ liệu mẫu: khách hàng hiện tại')
on conflict do nothing;

select public.recompute_scores(null);
