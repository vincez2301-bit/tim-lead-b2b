// Client Supabase phía server. service_role BỎ QUA RLS → chỉ dùng trong Edge Function,
// và mọi function phải tự kiểm tra người dùng/vai trò (auth.ts) trước khi ghi.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export type Db = SupabaseClient;

let cached: Db | null = null;

/**
 * Khoá server: ưu tiên khoá legacy `SUPABASE_SERVICE_ROLE_KEY`; nếu project đã tắt khoá legacy thì
 * dùng khoá mới `SUPABASE_SECRET_KEYS` (JSON dạng {"default":"sb_secret_..."}) mà Supabase tự cấp.
 */
export function pickServerKey(get: (name: string) => string | undefined): string | null {
  const legacy = get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  const raw = get("SUPABASE_SECRET_KEYS")?.trim();
  if (!raw) return null;
  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    const k = typeof keys.default === "string" ? keys.default : Object.values(keys).find((v) => typeof v === "string");
    return typeof k === "string" && k ? k : null;
  } catch {
    return raw.startsWith("sb_secret_") ? raw : null;
  }
}

export function serviceClient(): Db {
  if (cached) return cached;
  const url = Deno.env.get("SUPABASE_URL");
  const key = pickServerKey((n) => Deno.env.get(n));
  if (!url || !key) {
    throw new Error("Thiếu SUPABASE_URL hoặc khoá server (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS) trong môi trường function");
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/** Ném lỗi nếu truy vấn Supabase thất bại; trả về data. */
export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
