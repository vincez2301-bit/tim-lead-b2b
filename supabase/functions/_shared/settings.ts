// Đọc bảng settings, gộp với giá trị mặc định an toàn.
import { type Db, must } from "./db.ts";

export interface Limits {
  serper_daily_global: number;
  serper_daily_per_user: number;
  youtube_daily_global: number;
  youtube_daily_per_user: number;
  warn_ratio: number;
  confirm_above_units: number;
  max_concurrent_runs_per_user: number;
  max_results_per_discover: number;
  max_companies_per_batch: number;
  max_export_rows: number;
}
export interface CrawlSettings {
  delay_ms: number;
  max_pages_per_company: number;
  max_attempts_per_company: number;
  timeout_ms: number;
  time_budget_ms: number;
  concurrency: number;
  user_agent: string;
}
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
  locations?: RegionLocation[];
}

export const DEFAULT_LIMITS: Limits = {
  serper_daily_global: 200,
  serper_daily_per_user: 100,
  youtube_daily_global: 9000,
  youtube_daily_per_user: 5000,
  warn_ratio: 0.8,
  confirm_above_units: 20,
  max_concurrent_runs_per_user: 2,
  max_results_per_discover: 100,
  max_companies_per_batch: 5,
  max_export_rows: 5000,
};
export const DEFAULT_CRAWL: CrawlSettings = {
  delay_ms: 1500,
  max_pages_per_company: 6,
  max_attempts_per_company: 10,
  timeout_ms: 8000,
  time_budget_ms: 110000,
  concurrency: 3,
  user_agent: "SyncLeadFinderBot/1.0 (+https://example.com/bot)",
};

export interface AppSettings {
  limits: Limits;
  crawl: CrawlSettings;
  regions: Region[];
  aggregator_blocklist: string[];
  signal_rules: Record<string, { type?: string; min?: number; max?: number }>;
}

function num(v: unknown, def: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : def;
}

export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = must(await db.from("settings").select("key, value"), "Đọc settings") as { key: string; value: unknown }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const rawLimits = (map.get("limits") ?? {}) as Record<string, unknown>;
  const rawCrawl = (map.get("crawl") ?? {}) as Record<string, unknown>;
  const limits = Object.fromEntries(
    Object.entries(DEFAULT_LIMITS).map(([k, d]) => [k, num(rawLimits[k], d)]),
  ) as unknown as Limits;
  const crawl: CrawlSettings = {
    delay_ms: num(rawCrawl.delay_ms, DEFAULT_CRAWL.delay_ms),
    max_pages_per_company: Math.min(10, num(rawCrawl.max_pages_per_company, DEFAULT_CRAWL.max_pages_per_company)),
    max_attempts_per_company: Math.min(20, num(rawCrawl.max_attempts_per_company, DEFAULT_CRAWL.max_attempts_per_company)),
    timeout_ms: Math.min(15000, num(rawCrawl.timeout_ms, DEFAULT_CRAWL.timeout_ms)),
    time_budget_ms: Math.min(140000, num(rawCrawl.time_budget_ms, DEFAULT_CRAWL.time_budget_ms)),
    concurrency: Math.max(1, Math.min(5, num(rawCrawl.concurrency, DEFAULT_CRAWL.concurrency))),
    user_agent: typeof rawCrawl.user_agent === "string" && rawCrawl.user_agent.trim()
      ? rawCrawl.user_agent
      : DEFAULT_CRAWL.user_agent,
  };
  return {
    limits,
    crawl,
    regions: Array.isArray(map.get("regions")) ? map.get("regions") as Region[] : [],
    aggregator_blocklist: Array.isArray(map.get("aggregator_blocklist"))
      ? (map.get("aggregator_blocklist") as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    signal_rules: (map.get("signal_rules") ?? {}) as AppSettings["signal_rules"],
  };
}

/** Trần cứng từ biến môi trường (nếu đặt) — chỉ có thể HẠ hạn mức, không nâng. */
export function envCap(provider: "serper" | "youtube"): number | null {
  const raw = Deno.env.get(provider === "serper" ? "DAILY_SERPER_LIMIT" : "DAILY_YT_UNITS_LIMIT");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
