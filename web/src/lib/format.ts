import type { CompanyStatus, EmailLabel, RunStatus, Segment } from "./api-types";
import type { DncReason, SignalStatus, Step } from "./db-types";

/** Theo thứ tự ưu tiên của nhóm: broadcaster → MCN → production house → hãng phim → brand. */
export const SEGMENTS: Segment[] = ["broadcaster", "mcn", "agency", "film", "brand"];
export const SEGMENT_LABEL: Record<Segment, string> = {
  broadcaster: "Đài truyền hình",
  mcn: "MCN / mạng creator",
  agency: "Production house / agency",
  film: "Hãng phim / hậu kỳ",
  brand: "Nhãn hàng",
};

export const STATUSES: CompanyStatus[] = ["new", "profiled", "enriched", "unreachable", "archived"];
export const STATUS_LABEL: Record<CompanyStatus, string> = {
  new: "Chưa phân tích",
  profiled: "Đã đọc website",
  enriched: "Đã phân tích",
  unreachable: "Không truy cập được",
  archived: "Lưu trữ",
};

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  running: "Đang chạy",
  done: "Xong",
  failed: "Lỗi",
  partial: "Dừng giữa chừng",
};

export const STEPS: Step[] = ["discover", "find_website", "profile", "enrich_youtube", "enrich_contact", "score", "export"];
export const STEP_LABEL: Record<Step, string> = {
  discover: "Tìm công ty",
  find_website: "Tìm website",
  profile: "Đọc website",
  enrich_youtube: "YouTube",
  enrich_contact: "Người liên hệ",
  find_people: "Tìm người phụ trách",
  score: "Chấm điểm",
  export: "Export",
};

export const SIGNAL_STATUS_LABEL: Record<SignalStatus, string> = {
  proposed: "Đề xuất",
  confirmed: "Đã xác nhận",
  rejected: "Từ chối",
};

export const EMAIL_LABEL: Record<EmailLabel, string> = {
  verified: "Đã xác minh",
  published: "Công khai",
  risky: "Email chung / rủi ro",
  guess: "Suy đoán",
  invalid: "Không hợp lệ",
};

export const DNC_REASONS: DncReason[] = ["existing_customer", "competitor", "opted_out", "other"];
export const DNC_REASON_LABEL: Record<DncReason, string> = {
  existing_customer: "Khách hiện tại",
  competitor: "Đối thủ",
  opted_out: "Đã từ chối nhận liên hệ",
  other: "Khác",
};

// Tín hiệu pixel chỉ là "dấu hiệu" có cài đặt, không chứng minh đang chạy quảng cáo (mục 5).
export const HINT_SIGNALS = new Set(["RUNNING_META_ADS", "RUNNING_GOOGLE_ADS"]);

const dtf = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
export function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : dtf.format(d);
}

const nf = new Intl.NumberFormat("vi-VN");
export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return digits > 0
    ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(v)
    : nf.format(v);
}

export function fmtPct(used: number, limit: number): string {
  if (!limit) return "—";
  return `${Math.round((100 * used) / limit)}%`;
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
