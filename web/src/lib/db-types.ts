// Kiểu dữ liệu các bảng/view đọc từ client (khớp supabase/migrations).
import type { CompanyStatus, EmailLabel, RunStatus, Segment } from "./api-types";

export type SignalStatus = "proposed" | "confirmed" | "rejected";
export type DncReason = "existing_customer" | "competitor" | "opted_out" | "other";
export type Role = "admin" | "user";
export type Step = "discover" | "profile" | "enrich_youtube" | "enrich_contact" | "score" | "export";

export interface Profile {
  user_id: string;
  email: string | null;
  role: Role;
  created_at: string;
}

export interface BreakdownItem {
  code: string;
  weight: number;
  value_num: number | null;
  strength: number;
  confidence: number | null;
  contribution: number;
  evidence_url: string | null;
  observed_at: string;
}

export interface ScoreBreakdown {
  raw: number;
  max: number;
  computed_at: string;
  signals: BreakdownItem[];
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  segment: Segment | null;
  country: string | null;
  city: string | null;
  status: CompanyStatus;
  score: number | null;
  score_breakdown: ScoreBreakdown | null;
  source: string | null;
  source_run_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  profiled_at: string | null;
  youtube_enriched_at: string | null;
  contacts_enriched_at: string | null;
  last_exported_at: string | null;
  is_dnc?: boolean;
}

export interface Contact {
  id: string;
  company_id: string;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  email_label: EmailLabel | null;
  phone: string | null;
  confidence: number | null;
  source: "auto" | "manual";
  evidence_url: string | null;
  created_at: string;
}

export interface SignalCode {
  code: string;
  description: string;
  source: string;
  cost_note: string | null;
  value_kind: "boolean" | "count" | "number";
  default_weight: number;
  sort_order: number;
  status: SignalStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  updated_at: string;
}

export interface Observation {
  id: number;
  company_id: string;
  signal_code: string;
  value_num: number | null;
  value_text: string | null;
  confidence: number | null;
  evidence_url: string;
  run_id: string | null;
  observed_at: string;
}

export interface Run {
  id: string;
  owner_id: string;
  search_id: string | null;
  step: Step;
  status: RunStatus;
  provider: "serper" | "youtube" | null;
  api_units_estimated: number | null;
  api_units_used: number;
  input: unknown;
  progress: unknown;
  stats: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface SearchRow {
  id: string;
  owner_id: string;
  name: string | null;
  segment: Segment | null;
  keywords: string[];
  region: string;
  location: string | null;
  mode: "search" | "maps" | "both";
  pages: number;
  created_at: string;
}

export interface DncRow {
  id: string;
  kind: "domain" | "email";
  value: string;
  reason: DncReason;
  note: string | null;
  added_by: string | null;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditRow {
  id: number;
  user_id: string | null;
  action: string;
  detail: unknown;
  created_at: string;
}

export interface CohortSaved {
  id: string;
  owner_id: string;
  name: string;
  filter: unknown;
  created_at: string;
}

export interface CompanyStat {
  segment: Segment | null;
  status: CompanyStatus;
  companies: number;
  avg_score: number | null;
}

// Cấu trúc một số khoá settings (mục 1.2, 10.4).
export interface RegionLocation {
  name: string;
  aliases?: string[];
}
export interface Region {
  code: string;
  name: string;
  gl: string;
  hl: string;
  country?: string;
  locations?: (RegionLocation | string)[];
}
export interface Limits {
  serper_daily_global?: number;
  serper_daily_per_user?: number;
  youtube_daily_global?: number;
  youtube_daily_per_user?: number;
  warn_ratio?: number;
  confirm_above_units?: number;
  max_concurrent_runs_per_user?: number;
  max_results_per_discover?: number;
  max_companies_per_batch?: number;
  max_export_rows?: number;
}
