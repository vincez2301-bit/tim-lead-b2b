import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Limits, Region, SettingRow } from "./db-types";
import type { Segment } from "./api-types";

export interface SettingsMap {
  [key: string]: unknown;
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("*").order("key");
    if (error) setError(error.message);
    else {
      const list = (data ?? []) as SettingRow[];
      setRows(list);
      setSettings(Object.fromEntries(list.map((r) => [r.key, r.value])));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settings, rows, loading, error, reload };
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
