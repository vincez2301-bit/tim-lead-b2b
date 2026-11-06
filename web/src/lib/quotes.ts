// Báo giá nhanh: bảng giá (settings.price_book), tính tiền, đọc số tiền bằng chữ, email gửi báo giá.
import type { SettingsMap } from "./settings";
import { supabase } from "./supabase";
import { addDays, fmtDay, todayIso } from "./pipeline";

export type Currency = "USD" | "VND";
export type QuoteStatus = "sent" | "accepted" | "declined";

export interface PriceItem {
  name: string;
  detail?: string;
  unit_price: number;
  unit?: string;
}
export interface PriceBook {
  currency: Currency;
  /** Tỷ giá quy đổi báo giá VND sang ARR (USD). */
  usd_vnd: number;
  valid_days: number;
  items: PriceItem[];
  terms: string;
}
export interface QuoteLine {
  name: string;
  detail?: string;
  qty: number;
  unit_price: number;
  unit?: string;
}
export interface Quote {
  id: string;
  deal_id: string;
  number: string;
  currency: Currency;
  items: QuoteLine[];
  discount_pct: number;
  total: number;
  annual_usd: number | null;
  valid_until: string;
  terms: string | null;
  contact_name: string | null;
  status: QuoteStatus;
  created_by: string | null;
  created_at: string;
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = { sent: "Đã gửi", accepted: "Khách đồng ý", declined: "Không chọn" };
export const QUOTE_EXPIRY_WARN_DAYS = 2;

const DEFAULT_TERMS =
  "• Giá chưa bao gồm thuế (nếu có).\n• Giấy phép có thời hạn 12 tháng kể từ ngày kích hoạt tài khoản.\n" +
  "• Thanh toán 100% trong 15 ngày kể từ ngày ký hợp đồng.\n• Báo giá có hiệu lực đến ngày ghi ở trên.";

export function getPriceBook(s: SettingsMap): PriceBook {
  const v = (s["price_book"] ?? {}) as Partial<PriceBook>;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : d);
  return {
    currency: v.currency === "VND" ? "VND" : "USD",
    usd_vnd: num(v.usd_vnd, 26000),
    valid_days: Math.round(num(v.valid_days, 14)),
    items: Array.isArray(v.items)
      ? v.items.filter((x): x is PriceItem => !!x && typeof x.name === "string" && x.name.trim() !== "" && typeof x.unit_price === "number")
      : [],
    terms: typeof v.terms === "string" ? v.terms : DEFAULT_TERMS,
  };
}

/** Làm tròn giống database: VND tới đồng, USD tới cent. */
export function roundMoney(v: number, c: Currency): number {
  const f = c === "VND" ? 1 : 100;
  return Math.round(v * f) / f;
}

export function quoteTotals(lines: QuoteLine[], discountPct: number, c: Currency) {
  const subtotal = lines.reduce((s, l) => s + (l.qty > 0 && l.unit_price >= 0 ? l.qty * l.unit_price : 0), 0);
  const total = roundMoney((subtotal * (100 - discountPct)) / 100, c);
  return { subtotal, discount: subtotal - total, total };
}

/** ARR (USD) từ tổng báo giá; báo giá VND quy đổi theo tỷ giá của bảng giá. */
export function toAnnualUsd(total: number, c: Currency, usdVnd: number): number {
  return c === "USD" ? Math.round(total) : Math.round(total / usdVnd);
}

export function fmtMoney(v: number | null | undefined, c: Currency): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: c === "VND" ? 0 : 2 }).format(v);
  return c === "VND" ? `${s} đ` : `${s} USD`;
}

// ------------------------------------------------------------------ Số tiền bằng chữ (VND)
const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const GROUPS = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

function readTriple(n: number, full: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const out: string[] = [];
  if (h > 0 || full) out.push(`${DIGITS[h]} trăm`);
  if (t === 0) {
    if (u > 0 && (h > 0 || full)) out.push("linh");
  } else if (t === 1) out.push("mười");
  else out.push(`${DIGITS[t]} mươi`);
  if (u > 0) {
    if (u === 1 && t >= 2) out.push("mốt");
    else if (u === 5 && t >= 1) out.push("lăm");
    else if (u === 4 && t >= 2) out.push("tư");
    else out.push(DIGITS[u]);
  }
  return out.join(" ");
}

/** 48000000 → "Bốn mươi tám triệu đồng". */
export function vndInWords(v: number): string {
  let n = Math.round(Math.abs(v));
  if (n === 0) return "Không đồng";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(`${readTriple(groups[i], i < groups.length - 1)}${GROUPS[i] ? ` ${GROUPS[i]}` : ""}`);
  }
  const s = parts.join(" ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} đồng`;
}

// ------------------------------------------------------------------ Email gửi báo giá
export function quoteEmail(
  q: Pick<Quote, "number" | "currency" | "items" | "discount_pct" | "total" | "valid_until">,
  v: { xung_ho: string; anh_chi: string; cong_ty: string; chu_ky: string },
): { subject: string; body: string } {
  const lines = q.items.map(
    (l) => `• ${l.name}${l.qty !== 1 ? ` × ${l.qty}` : ""}: ${fmtMoney(l.qty * l.unit_price, q.currency)}${l.unit ? `/${l.unit}` : ""}`,
  );
  if (q.discount_pct > 0) lines.push(`• Ưu đãi: giảm ${q.discount_pct}%`);
  lines.push(`• Tổng cộng: ${fmtMoney(q.total, q.currency)} (chưa gồm thuế, nếu có)`);
  const anh = v.anh_chi.charAt(0).toUpperCase() + v.anh_chi.slice(1);
  return {
    subject: `Báo giá ${q.number} – Epidemic Sound cho ${v.cong_ty}`,
    body:
      `Kính gửi ${v.xung_ho},\n\n` +
      `Em cảm ơn ${v.anh_chi} đã dành thời gian trao đổi. Em xin gửi báo giá số ${q.number} (file PDF đính kèm), tóm tắt như sau:\n` +
      `${lines.join("\n")}\n\n` +
      `Báo giá có hiệu lực đến ngày ${fmtDate(q.valid_until)}. ${anh} chỉ cần trả lời email này để xác nhận, ` +
      `em sẽ gửi hợp đồng ngay trong ngày và kích hoạt tài khoản cho ${v.cong_ty} ngay khi hoàn tất thủ tục.\n\n` +
      `Nếu cần điều chỉnh phạm vi hoặc hình thức thanh toán, ${v.anh_chi} cứ cho em biết.\n\n` +
      `Trân trọng,\n${v.chu_ky}`,
  };
}

/** dd/mm/yyyy (luôn đủ năm, dùng trong văn bản gửi khách). */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Hạn báo giá dễ đọc: “còn 3 ngày”, “hết hạn hôm nay”, “đã hết hạn 05/11”. */
export function expiryText(validUntil: string): { text: string; urgent: boolean; expired: boolean } {
  const t = todayIso();
  if (validUntil < t) return { text: `Báo giá đã hết hạn ${fmtDay(validUntil)}`, urgent: true, expired: true };
  if (validUntil === t) return { text: "Báo giá hết hạn hôm nay", urgent: true, expired: false };
  const days = Math.round((new Date(`${validUntil}T00:00:00`).getTime() - new Date(`${t}T00:00:00`).getTime()) / 86_400_000);
  return { text: `Báo giá còn ${days} ngày (${fmtDay(validUntil)})`, urgent: validUntil <= addDays(t, QUOTE_EXPIRY_WARN_DAYS), expired: false };
}

export async function loadQuotes(dealId: string): Promise<Quote[]> {
  const { data, error } = await supabase.from("quotes").select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Quote[];
}
