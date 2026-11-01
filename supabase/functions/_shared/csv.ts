// CSV UTF-8 có BOM để Excel hiển thị đúng tiếng Việt (mục 6.4), chống CSV injection (mục 10.3).

export type Cell = string | number | null | undefined;

/** Ô chuỗi bắt đầu bằng = + - @ (hoặc tab/CR) bị Excel hiểu là công thức → thêm dấu nháy đơn. */
export function neutralizeFormula(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const s = neutralizeFormula(String(v));
  return /[",\r\n;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): Uint8Array {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return new TextEncoder().encode("﻿" + lines.join("\r\n") + "\r\n");
}
