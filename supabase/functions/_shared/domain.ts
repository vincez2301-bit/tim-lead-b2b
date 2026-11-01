// Chuẩn hoá domain (mục 4.1 bước 3) và kiểm tra danh sách chặn.

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z0-9-]{2,63}$/;

/**
 * Từ URL hoặc hostname → domain đã chuẩn hoá: chữ thường, bỏ "www.", bỏ path/port,
 * IDN chuyển sang punycode. Trả về null nếu không hợp lệ hoặc là địa chỉ IP.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `http://${s}`).hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/\.$/, "").replace(/^www\d?\./, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) return null;
  return DOMAIN_RE.test(host) ? host : null;
}

/** host trùng hoặc là subdomain của một mục trong danh sách. */
export function hostInList(host: string, list: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return list.some((raw) => {
    const d = raw.toLowerCase().trim().replace(/^www\./, "");
    return d.length > 0 && (h === d || h.endsWith("." + d));
  });
}

/** URL có thuộc cùng site với domain (kể cả www. và subdomain)? */
export function isSameSite(url: string | URL, domain: string): boolean {
  try {
    const h = (typeof url === "string" ? new URL(url) : url).hostname.toLowerCase().replace(/^www\d?\./, "");
    return h === domain || h.endsWith("." + domain);
  } catch {
    return false;
  }
}

/** URL gốc để đọc website: ưu tiên website_url đã biết, nếu không thì https://domain/. */
export function homeUrlFor(domain: string, websiteUrl?: string | null): string {
  if (websiteUrl) {
    try {
      const u = new URL(websiteUrl);
      if (u.protocol === "http:" || u.protocol === "https:") return `${u.protocol}//${u.host}/`;
    } catch { /* bỏ qua */ }
  }
  return `https://${domain}/`;
}
