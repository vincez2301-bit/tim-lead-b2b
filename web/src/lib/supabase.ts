import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Frontend chỉ chứa URL project và khoá anon/publishable (mục 10.1).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const configError: string | null =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Sao chép web/.env.example thành web/.env và điền giá trị."
    : null;

export const supabase: SupabaseClient = configError
  ? (null as unknown as SupabaseClient)
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
