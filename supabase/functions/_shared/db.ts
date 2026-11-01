// Client Supabase phía server. service_role BỎ QUA RLS → chỉ dùng trong Edge Function,
// và mọi function phải tự kiểm tra người dùng/vai trò (auth.ts) trước khi ghi.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export type Db = SupabaseClient;

let cached: Db | null = null;

export function serviceClient(): Db {
  if (cached) return cached;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong môi trường function");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/** Ném lỗi nếu truy vấn Supabase thất bại; trả về data. */
export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
