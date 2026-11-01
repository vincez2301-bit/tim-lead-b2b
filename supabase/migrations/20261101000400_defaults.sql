-- Sync Lead Finder — dữ liệu mặc định (danh mục tín hiệu mục 5, cài đặt).
-- Mọi tín hiệu khởi đầu ở trạng thái 'proposed': admin phải duyệt ('confirmed')
-- trên màn hình Tín hiệu thì pipeline mới được thu thập.

insert into public.signal_codes (code, description, source, cost_note, value_kind, default_weight, sort_order) values
  ('ACTIVE_YOUTUBE',       'Kênh YouTube hoạt động: ≥ 4 video trong 30 ngày (value_num = số video 30 ngày)', 'YouTube API',       '~1 đơn vị quota/kênh', 'count',   15, 10),
  ('YT_SUBSCRIBERS',       'Số subscriber của kênh lớn nhất (chuẩn hoá theo thang log)',                    'YouTube API',       '~1 đơn vị quota/kênh', 'number',   8, 20),
  ('YT_UPLOAD_FREQ',       'Số video đăng trong 90 ngày (value_text ghi cả 30/90 ngày)',                    'YouTube API',       '~1 đơn vị quota/kênh', 'count',    8, 30),
  ('MULTI_CHANNEL_OWNER',  'Một đơn vị liên kết nhiều kênh YouTube (MCN) — value_num = số kênh',          'Website + YouTube', '~1 đơn vị quota/kênh', 'count',   12, 40),
  ('HIRING_VIDEO_ROLE',    'Đang tuyển video editor / motion designer / content creator / quay dựng',     'Website',           'Miễn phí',             'boolean', 12, 50),
  ('HAS_SHOWREEL',         'Có showreel (từ khoá hoặc video nhúng)',                                      'Website',           'Miễn phí',             'boolean',  6, 60),
  ('TVC_PORTFOLIO',        'Có portfolio TVC / video quảng cáo',                                          'Website',           'Miễn phí',             'boolean',  8, 70),
  ('ENGLISH_SITE',         'Có phiên bản tiếng Anh',                                                      'Website',           'Miễn phí',             'boolean',  4, 80),
  ('RUNNING_META_ADS',     'Dấu hiệu có cài Meta Pixel (không chứng minh đang chạy quảng cáo)',           'Website',           'Miễn phí',             'boolean',  5, 90),
  ('RUNNING_GOOGLE_ADS',   'Dấu hiệu có cài Google Ads / gtag (không chứng minh đang chạy quảng cáo)',     'Website',           'Miễn phí',             'boolean',  5, 100),
  ('HAS_TIKTOK',           'Có link TikTok trên website (không truy cập TikTok)',                         'Website',           'Miễn phí',             'boolean',  3, 110),
  ('HAS_YOUTUBE',          'Có link kênh YouTube trên website (điều kiện để chạy enrich_youtube)',        'Website',           'Miễn phí',             'count',    0, 115),
  ('HAS_EMAIL',            'Có email liên hệ',                                                            'Website',           'Miễn phí',             'boolean',  4, 120),
  ('HAS_PHONE',            'Có số điện thoại',                                                            'Website / Maps',    'Miễn phí',             'boolean',  3, 130),
  ('HAS_ZALO',             'Có Zalo',                                                                     'Website',           'Miễn phí',             'boolean',  3, 140),
  ('DECISION_MAKER_FOUND', 'Tìm thấy người quyết định (value_num = số người)',                            'Website',           'Miễn phí',             'count',    6, 150),
  ('NO_WEBSITE',           'Không có website hoạt động (domain không phân giải / chỉ có trên Maps)',      'Serper / safeFetch','Miễn phí',             'boolean', -10, 160)
on conflict (code) do nothing;

insert into public.settings (key, value) values
  ('regions', $json$[
    {"code": "VN", "name": "Việt Nam", "gl": "vn", "hl": "vi", "country": "VN",
     "locations": [
       {"name": "TP.HCM",    "aliases": ["TP.HCM", "TP HCM", "Hồ Chí Minh", "Ho Chi Minh", "HCMC", "Sài Gòn", "Saigon"]},
       {"name": "Hà Nội",    "aliases": ["Hà Nội", "Ha Noi", "Hanoi"]},
       {"name": "Đà Nẵng",   "aliases": ["Đà Nẵng", "Da Nang", "Danang"]},
       {"name": "Hải Phòng", "aliases": ["Hải Phòng", "Hai Phong"]},
       {"name": "Cần Thơ",   "aliases": ["Cần Thơ", "Can Tho"]},
       {"name": "Bình Dương","aliases": ["Bình Dương", "Binh Duong"]},
       {"name": "Nha Trang", "aliases": ["Nha Trang", "Khánh Hòa", "Khanh Hoa"]}
     ]}
  ]$json$::jsonb),
  ('keyword_sets', $json${
    "agency": ["công ty sản xuất TVC TP.HCM", "production house Hà Nội", "sản xuất video quảng cáo", "quay dựng sự kiện",
               "video production company Ho Chi Minh City", "commercial production house Vietnam", "event video agency Hanoi"],
    "brand":  ["thương hiệu mỹ phẩm Việt Nam kênh YouTube", "chuỗi nhà hàng tuyển content creator", "công ty du lịch tuyển video editor",
               "Vietnam cosmetics brand marketing team", "real estate developer Vietnam video marketing"],
    "film":   ["hãng phim Việt Nam", "hậu kỳ phim studio", "công ty sản xuất phim truyền hình",
               "post production studio Vietnam", "film production company Saigon"],
    "mcn":    ["MCN Việt Nam", "mạng lưới creator", "công ty quản lý KOL/KOC",
               "multi channel network Vietnam", "creator network Southeast Asia"]
  }$json$::jsonb),
  ('aggregator_blocklist', $json$[
    "facebook.com", "fb.com", "linkedin.com", "youtube.com", "youtu.be", "tiktok.com", "instagram.com", "twitter.com", "x.com",
    "pinterest.com", "reddit.com", "quora.com", "medium.com", "zalo.me", "behance.net", "vimeo.com", "dribbble.com",
    "wikipedia.org", "google.com", "maps.google.com", "apple.com",
    "yellowpages.vn", "trangvangvietnam.com", "masothue.com", "thongtindoanhnghiep.co", "hosocongty.vn", "infodoanhnghiep.com",
    "doanhnghiep.biz", "dnb.com", "companieshouse.gov.uk", "vietnamcompanies.org", "yp.vn", "vinabiz.org",
    "topcv.vn", "vietnamworks.com", "careerviet.vn", "itviec.com", "timviec365.vn", "vieclam24h.vn", "glints.com",
    "indeed.com", "jobstreet.vn", "joboko.com", "careerlink.vn", "123job.vn", "jobsgo.vn", "mywork.com.vn",
    "vnexpress.net", "tuoitre.vn", "thanhnien.vn", "dantri.com.vn", "znews.vn", "zingnews.vn", "kenh14.vn", "cafef.vn",
    "cafebiz.vn", "vietnamnet.vn", "nld.com.vn", "tienphong.vn", "baomoi.com", "24h.com.vn", "soha.vn", "genk.vn",
    "brandsvietnam.com", "advertisingvietnam.com", "clutch.co", "goodfirms.co", "designrush.com", "sortlist.com",
    "shopee.vn", "lazada.vn", "tiki.vn", "sendo.vn", "tripadvisor.com", "foody.vn", "agoda.com", "booking.com"
  ]$json$::jsonb),
  ('limits', $json${
    "serper_daily_global": 200,
    "serper_daily_per_user": 100,
    "youtube_daily_global": 9000,
    "youtube_daily_per_user": 5000,
    "warn_ratio": 0.8,
    "confirm_above_units": 20,
    "max_concurrent_runs_per_user": 2,
    "max_results_per_discover": 100,
    "max_companies_per_batch": 5,
    "max_export_rows": 5000
  }$json$::jsonb),
  ('crawl', $json${
    "delay_ms": 1500,
    "max_pages_per_company": 6,
    "max_attempts_per_company": 10,
    "timeout_ms": 8000,
    "time_budget_ms": 110000,
    "concurrency": 3,
    "user_agent": "SyncLeadFinderBot/1.0 (+https://example.com/bot; contact: licensing@example.com)"
  }$json$::jsonb),
  ('signal_rules', $json${
    "ACTIVE_YOUTUBE":       {"type": "threshold", "min": 4},
    "MULTI_CHANNEL_OWNER":  {"type": "threshold", "min": 2},
    "YT_SUBSCRIBERS":       {"type": "log", "min": 500, "max": 500000},
    "YT_UPLOAD_FREQ":       {"type": "linear", "min": 2, "max": 24},
    "DECISION_MAKER_FOUND": {"type": "threshold", "min": 1},
    "HAS_YOUTUBE":          {"type": "threshold", "min": 1}
  }$json$::jsonb),
  ('retention', '{"months": 12}'::jsonb)
on conflict (key) do nothing;
