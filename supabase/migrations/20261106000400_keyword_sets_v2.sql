-- Bộ từ khoá mặc định v2 cho trang Tìm công ty: rộng hơn theo từng nhóm, không kèm tên thành phố
-- (app tự thêm địa danh đã chọn). Từ khoá admin tự thêm được giữ lại (xếp sau), từ khoá mặc định cũ bị thay; tối đa 20/nhóm.

with fresh(seg, kw) as (values
  ('broadcaster', $j$["đài phát thanh truyền hình tỉnh", "kênh truyền hình cáp", "kênh truyền hình thể thao",
    "công ty sản xuất chương trình truyền hình", "sản xuất gameshow truyền hình", "sản xuất talkshow",
    "nền tảng truyền hình OTT", "ứng dụng xem phim trực tuyến", "đài phát thanh", "TV production company Vietnam"]$j$::jsonb),
  ('mcn', $j$["MCN Việt Nam", "công ty quản lý kênh YouTube", "đối tác YouTube Việt Nam", "công ty quản lý KOL KOC",
    "agency TikTok", "đối tác TikTok Shop", "studio livestream bán hàng", "công ty sản xuất nội dung số",
    "multi channel network Vietnam", "YouTube certified partner Vietnam"]$j$::jsonb),
  ('agency', $j$["công ty sản xuất TVC", "production house", "sản xuất video quảng cáo", "sản xuất video doanh nghiệp",
    "quay phim sự kiện", "sản xuất video TikTok", "motion graphics studio", "social media agency",
    "digital marketing agency", "công ty truyền thông sự kiện", "video production company"]$j$::jsonb),
  ('film', $j$["hãng phim", "công ty sản xuất phim điện ảnh", "sản xuất phim truyền hình", "studio hậu kỳ", "dựng phim hậu kỳ",
    "studio hoạt hình 2D 3D", "phòng thu lồng tiếng", "công ty phát hành phim", "post production studio",
    "animation studio Vietnam"]$j$::jsonb),
  ('brand', $j$["thương hiệu mỹ phẩm Việt Nam", "thương hiệu thời trang Việt", "chuỗi cà phê", "chuỗi nhà hàng",
    "chủ đầu tư bất động sản", "công ty du lịch lữ hành", "khu nghỉ dưỡng resort", "chuỗi phòng gym fitness",
    "nền tảng học trực tuyến", "studio game Việt Nam"]$j$::jsonb)
),
old(seg, kw) as (values
  ('broadcaster', $j$["đài truyền hình", "kênh truyền hình", "television station Vietnam", "đài phát thanh truyền hình tỉnh",
    "TV channel Vietnam", "nhà đài sản xuất chương trình"]$j$::jsonb),
  ('mcn', $j$["MCN Việt Nam", "mạng lưới creator", "công ty quản lý KOL/KOC", "multi channel network Vietnam",
    "creator network Southeast Asia"]$j$::jsonb),
  ('agency', $j$["công ty sản xuất TVC TP.HCM", "production house Hà Nội", "sản xuất video quảng cáo", "quay dựng sự kiện",
    "video production company Ho Chi Minh City", "commercial production house Vietnam", "event video agency Hanoi"]$j$::jsonb),
  ('film', $j$["hãng phim Việt Nam", "hậu kỳ phim studio", "công ty sản xuất phim truyền hình", "post production studio Vietnam",
    "film production company Saigon"]$j$::jsonb),
  ('brand', $j$["thương hiệu mỹ phẩm Việt Nam kênh YouTube", "chuỗi nhà hàng tuyển content creator",
    "công ty du lịch tuyển video editor", "Vietnam cosmetics brand marketing team",
    "real estate developer Vietnam video marketing"]$j$::jsonb)
),
cur as (select coalesce((select value from public.settings where key = 'keyword_sets'), '{}'::jsonb) as v),
merged as (
  select f.seg, (
    select coalesce(jsonb_agg(k order by ord), '[]'::jsonb) from (
      select k, min(ord) as ord from (
        select e.k, e.ord from jsonb_array_elements_text(f.kw) with ordinality e(k, ord)
        union all
        select e.k, 1000 + e.ord
          from jsonb_array_elements_text(
                 case when jsonb_typeof(cur.v -> f.seg) = 'array' then cur.v -> f.seg else '[]'::jsonb end
               ) with ordinality e(k, ord)
         where not (o.kw ? e.k) and btrim(e.k) <> ''
      ) u group by k order by min(ord) limit 20
    ) x
  ) as kw
  from fresh f join old o using (seg), cur
)
insert into public.settings (key, value)
select 'keyword_sets', cur.v || (select jsonb_object_agg(seg, kw) from merged) from cur
on conflict (key) do update set value = excluded.value, updated_at = now();
