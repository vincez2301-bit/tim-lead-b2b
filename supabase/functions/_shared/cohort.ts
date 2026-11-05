// Kiểm tra bộ lọc cohort từ client trước khi chuyển cho hàm SQL tham số hoá cohort_search.
import { badRequest } from "./http.ts";
import type { CohortFilter, CohortRange, CompanyStatus, Segment } from "./types.ts";

const SEGMENTS: Segment[] = ["broadcaster", "mcn", "agency", "film", "brand"];
const STATUSES: CompanyStatus[] = ["new", "profiled", "enriched", "unreachable", "archived"];

function codeList(v: unknown, field: string, codes: Set<string>): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 20) throw badRequest(`${field} phải là mảng tối đa 20 mã tín hiệu`);
  for (const c of v) {
    if (typeof c !== "string" || !codes.has(c)) throw badRequest(`${field}: "${String(c)}" không phải tín hiệu đã xác nhận`);
  }
  return [...new Set(v as string[])];
}

function optNum(v: unknown, field: string, min = -1e12, max = 1e12): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${field} không hợp lệ`);
  return n;
}

function enumList<T extends string>(v: unknown, allowed: T[], field: string): T[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || !v.every((x) => (allowed as string[]).includes(x as string))) {
    throw badRequest(`${field} chỉ nhận: ${allowed.join(", ")}`);
  }
  return [...new Set(v as T[])];
}

function cityList(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 20 || !v.every((x) => typeof x === "string" && x.trim() && x.length <= 60)) {
    throw badRequest("cities phải là mảng tối đa 20 tên thành phố");
  }
  return [...new Set((v as string[]).map((x) => x.trim()))];
}

export function parseCohortFilter(raw: unknown, confirmedCodes: Set<string>): CohortFilter {
  if (raw !== undefined && (raw === null || typeof raw !== "object" || Array.isArray(raw))) {
    throw badRequest("filter phải là object");
  }
  const f = (raw ?? {}) as Record<string, unknown>;
  const ranges: CohortRange[] = [];
  if (f.ranges !== undefined && f.ranges !== null) {
    if (!Array.isArray(f.ranges) || f.ranges.length > 10) throw badRequest("ranges phải là mảng tối đa 10 điều kiện");
    for (const r of f.ranges as Record<string, unknown>[]) {
      if (!r || typeof r.code !== "string" || !confirmedCodes.has(r.code)) {
        throw badRequest(`ranges: mã tín hiệu không hợp lệ`);
      }
      const min = optNum(r.min, "ranges.min");
      const max = optNum(r.max, "ranges.max");
      if (min === null && max === null) continue;
      ranges.push({ code: r.code, min, max });
    }
  }
  const q = typeof f.q === "string" ? f.q.trim().slice(0, 100) : "";
  return {
    must: codeList(f.must, "must", confirmedCodes),
    exclude: codeList(f.exclude, "exclude", confirmedCodes),
    ranges,
    min_score: optNum(f.min_score, "min_score", 0, 100),
    max_score: optNum(f.max_score, "max_score", 0, 100),
    segments: enumList(f.segments, SEGMENTS, "segments"),
    statuses: enumList(f.statuses, STATUSES, "statuses"),
    cities: cityList(f.cities),
    q: q || undefined,
    include_dnc: f.include_dnc === true,
  };
}
