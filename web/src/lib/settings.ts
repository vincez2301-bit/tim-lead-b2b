import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Limits, Region, SettingRow } from "./db-types";
import type { Segment } from "./api-types";

export interface SettingsMap {
  [key: string]: unknown;
}

interface SettingsState {
  settings: SettingsMap;
  rows: SettingRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Ghi một khoá cài đặt (chỉ admin) rồi cập nhật bộ nhớ đệm. Trả về thông báo lỗi hoặc null. */
  save: (key: string, value: unknown) => Promise<string | null>;
}

const Ctx = createContext<SettingsState | null>(null);

/** Tải bảng settings MỘT lần cho cả phiên; mọi trang dùng chung (trước đây mỗi trang tự tải lại). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("settings").select("*").order("key");
    if (error) setError(error.message);
    else {
      setRows((data ?? []) as SettingRow[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  const save = useCallback(
    async (key: string, value: unknown) => {
      const { error } = await supabase.from("settings").upsert({ key, value });
      if (error) return error.message;
      await reload();
      return null;
    },
    [reload],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<SettingsState>(
    () => ({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])), rows, loading, error, reload, save }),
    [rows, loading, error, reload, save],
  );
  return createElement(Ctx.Provider, { value }, children);
}

export function useSettings(): SettingsState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSettings cần SettingsProvider");
  return c;
}

export function getLimits(s: SettingsMap): Limits {
  const v = s["limits"];
  return v && typeof v === "object" ? (v as Limits) : {};
}

export function getBatchSize(s: SettingsMap): number {
  const n = Number(getLimits(s).max_companies_per_batch);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

export function getRegions(s: SettingsMap): Region[] {
  const v = s["regions"];
  return Array.isArray(v) ? (v as Region[]) : [];
}

export function getKeywordSet(s: SettingsMap, segment: Segment): string[] {
  const v = s["keyword_sets"];
  if (!v || typeof v !== "object") return [];
  const list = (v as Record<string, unknown>)[segment];
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
}

export function locationNames(r: Region | undefined): string[] {
  if (!r?.locations) return [];
  return r.locations.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);
}

/** Mọi địa danh của mọi khu vực (để lọc theo thành phố). */
export function allCityNames(s: SettingsMap): string[] {
  return [...new Set(getRegions(s).flatMap((r) => locationNames(r)))];
}

/** Đọc/ghi một lựa chọn lọc trong localStorage của trình duyệt (bỏ qua nếu bị chặn). */
export function rememberedFilter(key: string): string {
  try {
    return localStorage.getItem(`slf.${key}`) ?? "";
  } catch {
    return "";
  }
}
export function rememberFilter(key: string, value: string) {
  try {
    if (value) localStorage.setItem(`slf.${key}`, value);
    else localStorage.removeItem(`slf.${key}`);
  } catch {
    /* trình duyệt chặn bộ nhớ: bỏ qua */
  }
}
