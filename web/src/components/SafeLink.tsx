import type { ReactNode } from "react";

/** Chỉ cho phép http/https; mọi URL khác (javascript:, data:, ...) hiển thị dạng văn bản. Mục 10.3. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function SafeLink({ href, children, className }: { href: string | null | undefined; children?: ReactNode; className?: string }) {
  const safe = safeHttpUrl(href);
  const label = children ?? href ?? "";
  if (!safe) return <span className={className}>{label}</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer nofollow" className={className}>
      {label}
    </a>
  );
}

/** Rút gọn URL để hiển thị trong bảng. */
export function shortUrl(url: string | null | undefined, max = 48): string {
  if (!url) return "";
  const s = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
