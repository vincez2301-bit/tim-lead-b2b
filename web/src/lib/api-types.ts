// Hợp đồng API giữa frontend và Edge Functions (mục 8.1).
// Frontend (web/src/lib/api-types.ts) giữ một bản sao của file này — sửa cả hai khi đổi.
//
// Quy ước chung:
// - Mọi function nhận POST JSON, yêu cầu header Authorization: Bearer <JWT người dùng>.
// - Lỗi trả về JSON { error: string, code?: string } với HTTP status 4xx/5xx.
//   code thường gặp: "unauthorized", "forbidden", "bad_request", "quota_exceeded" (429),
//   "too_many_runs" (429), "not_configured" (500), "upstream_error" (502).
// - Các function xử lý theo lô trả về remaining_ids: những id CHƯA xử lý (hết thời gian
//   của lần gọi). Frontend gửi lại remaining_ids cho tới khi rỗng.

export type Segment = "agency" | "brand" | "film" | "mcn";
export type DiscoverMode = "search" | "maps" | "both";
export type CompanyStatus = "new" | "profiled" | "enriched" | "unreachable" | "archived";
export type RunStatus = "running" | "done" | "failed" | "partial";
export type EmailLabel = "verified" | "published" | "risky" | "guess" | "invalid";

export interface ApiError {
  error: string;
  code?: string;
}

export interface QuotaInfo {
  provider: "serper" | "youtube";
  day_start: string;
  used_global: number;
  limit_global: number;
  used_user: number;
  limit_user: number;
  remaining: number;
  warn_ratio: number;
}

// ---- estimate -------------------------------------------------------------
export interface EstimateRequest {
  keywords?: string[];
  pages?: number; // mặc định 1
  mode?: DiscoverMode; // mặc định "search"
  region?: string;
}
export interface EstimateResponse {
  serper_units: number; // số lượt Serper dự kiến cho yêu cầu này
  remaining_today: number; // lượt Serper còn lại hôm nay (min của hạn mức chung và cá nhân)
  confirm_above_units: number;
  needs_confirmation: boolean; // true → giao diện phải hỏi xác nhận trước khi chạy
  serper: QuotaInfo;
  youtube: QuotaInfo;
  warnings: string[]; // ví dụ đã dùng ≥ 80% hạn mức
}

// ---- discover -------------------------------------------------------------
export interface DiscoverRequest {
  segment: Segment;
  keywords: string[]; // 1..20 từ khoá, mỗi từ khoá ≤ 120 ký tự
  region: string; // mã khu vực trong settings.regions, ví dụ "VN"
  location?: string | null; // tên địa danh trong region.locations (tuỳ chọn)
  pages?: number; // 1..3, mặc định 1
  mode?: DiscoverMode; // mặc định "search"
  max_results?: number; // giới hạn số công ty ghi nhận, mặc định limits.max_results_per_discover
  confirm?: boolean; // bắt buộc true khi serper_units > confirm_above_units
}
export interface DiscoverResponse {
  run_id: string;
  status: RunStatus;
  new: number;
  existing: number;
  skipped_dnc: number;
  skipped_blocked: number;
  company_ids: string[]; // mọi công ty ghi nhận trong lần chạy (mới + đã có)
  new_company_ids: string[];
  units_used: number;
  message?: string;
}

// ---- profile / enrich_contact --------------------------------------------
export interface CompanyBatchRequest {
  company_ids: string[]; // tối đa limits.max_companies_per_batch (mặc định 5)
}
export interface ProfileResponse {
  run_id: string;
  processed: number;
  failed: number; // không truy cập được website
  skipped: number; // DNC / không có domain / bị robots.txt chặn
  observations: number;
  remaining_ids: string[];
}
export interface EnrichContactResponse {
  run_id: string;
  processed: number;
  contacts: number;
  decision_makers: number;
  remaining_ids: string[];
}

// ---- enrich_youtube -------------------------------------------------------
export interface EnrichYoutubeRequest {
  company_ids?: string[];
  resume_run_id?: string; // tiếp tục một run 'partial' đã dừng vì hết quota
}
export interface EnrichYoutubeResponse {
  run_id: string;
  status: RunStatus;
  processed: number;
  channels: number;
  units_used: number;
  skipped_no_channel: number;
  remaining_ids: string[];
  stopped_reason: "quota" | "time" | null;
}

// ---- score ----------------------------------------------------------------
export interface ScoreRequest {
  company_ids: string[] | "all";
}
export interface ScoreResponse {
  updated: number;
}

// ---- cohort_query / export -----------------------------------------------
export interface CohortRange {
  code: string;
  min?: number | null;
  max?: number | null;
}
export interface CohortFilter {
  must?: string[]; // phải có (observation mới nhất có strength > 0)
  exclude?: string[]; // không được có
  ranges?: CohortRange[]; // điều kiện trên value_num của observation mới nhất
  min_score?: number | null;
  max_score?: number | null;
  segments?: Segment[];
  statuses?: CompanyStatus[];
  cities?: string[]; // tên thành phố (companies.city), không phân biệt hoa thường
  q?: string; // tìm theo tên / domain
  include_dnc?: boolean; // chỉ có tác dụng khi xem; export LUÔN loại DNC
}
export interface CohortQueryRequest extends CohortFilter {
  limit?: number; // mặc định 50, tối đa 500
  offset?: number;
}
export interface CohortRow {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  segment: Segment | null;
  city: string | null;
  status: CompanyStatus;
  score: number | null;
  is_dnc: boolean;
}
export interface CohortQueryResponse {
  total: number;
  rows: CohortRow[];
}

export interface ExportRequest {
  filter: CohortFilter;
  format: "csv" | "xlsx";
}
// Phản hồi export: file nhị phân (Content-Type text/csv hoặc
// application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
// Content-Disposition: attachment; filename="..."), header X-Row-Count = số dòng.
