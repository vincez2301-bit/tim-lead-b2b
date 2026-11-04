-- Cohort: thêm bộ lọc thành phố (p_filter.cities: mảng tên thành phố, so khớp không phân biệt hoa thường).
-- Chỉ thay thân hàm, giữ nguyên chữ ký nên quyền execute đã cấp vẫn còn.
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
      array(select lower(btrim(x)) from jsonb_array_elements_text(coalesce(p_filter->'cities', '[]')) x) as cities,
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
      and (cardinality(f.cities) = 0 or lower(btrim(c.city)) = any(f.cities))
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
