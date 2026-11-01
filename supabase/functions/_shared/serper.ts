// Serper.dev — Google Search / Maps (mục 3, mục 4.1).
import { hostInList, normalizeDomain } from "./domain.ts";
import type { Region } from "./settings.ts";

export class SerperError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Candidate {
  name: string;
  domain: string | null;
  website_url: string | null;
  city: string | null;
  phone: string | null;
  maps_url: string | null;
  source: "search" | "maps";
}

export interface SerperQuery {
  q: string;
  gl: string;
  hl: string;
  page: number;
}

export async function serperCall(
  kind: "search" | "maps",
  query: SerperQuery,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(`https://google.serper.dev/${kind}`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query.q, gl: query.gl, hl: query.hl, page: query.page, num: 10 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 200);
    throw new SerperError(res.status, `Serper ${kind} trả về HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return await res.json() as Record<string, unknown>;
}

/** Bỏ phần đuôi kiểu " - Trang chủ", " | Công ty ABC" khỏi tiêu đề kết quả tìm kiếm. */
export function cleanTitle(title: string): string {
  const parts = title.split(/\s+[|\-–—:»]\s+/).map((p) => p.trim()).filter(Boolean);
  const generic = /^(trang chủ|home( ?page)?|welcome|chào mừng.*|official (web)?site|website chính thức)$/i;
  const pick = parts.find((p) => !generic.test(p)) ?? parts[0] ?? title;
  return pick.slice(0, 200);
}

export function detectCity(text: string | null | undefined, region: Region | undefined): string | null {
  if (!text || !region?.locations) return null;
  const t = text.toLowerCase();
  for (const loc of region.locations) {
    for (const alias of [loc.name, ...(loc.aliases ?? [])]) {
      if (alias && t.includes(alias.toLowerCase())) return loc.name;
    }
  }
  return null;
}

export function mapsUrl(place: Record<string, unknown>): string {
  if (place.cid) return `https://www.google.com/maps?cid=${encodeURIComponent(String(place.cid))}`;
  const q = [place.title, place.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Chuyển kết quả Serper → ứng viên công ty (đã lọc aggregator). */
export function parseSerperResults(
  kind: "search" | "maps",
  body: Record<string, unknown>,
  ctx: { blocklist: string[]; region?: Region; location?: string | null },
): { candidates: Candidate[]; blocked: number } {
  const out: Candidate[] = [];
  let blocked = 0;
  if (kind === "search") {
    for (const r of (body.organic as Record<string, unknown>[] | undefined) ?? []) {
      const link = typeof r.link === "string" ? r.link : null;
      const domain = normalizeDomain(link);
      if (!link || !domain) continue;
      if (hostInList(domain, ctx.blocklist)) {
        blocked++;
        continue;
      }
      out.push({
        name: cleanTitle(String(r.title ?? domain)),
        domain,
        website_url: link,
        city: ctx.location ?? detectCity(`${r.title ?? ""} ${r.snippet ?? ""}`, ctx.region),
        phone: null,
        maps_url: null,
        source: "search",
      });
    }
  } else {
    for (const p of (body.places as Record<string, unknown>[] | undefined) ?? []) {
      const name = typeof p.title === "string" ? p.title.trim().slice(0, 200) : "";
      if (!name) continue;
      const website = typeof p.website === "string" ? p.website : null;
      const domain = normalizeDomain(website);
      if (domain && hostInList(domain, ctx.blocklist)) {
        // Website là trang mạng xã hội/aggregator → coi như không có website riêng.
        out.push({
          name,
          domain: null,
          website_url: null,
          city: detectCity(String(p.address ?? ""), ctx.region) ?? ctx.location ?? null,
          phone: typeof p.phoneNumber === "string" ? p.phoneNumber : null,
          maps_url: mapsUrl(p),
          source: "maps",
        });
        continue;
      }
      out.push({
        name,
        domain,
        website_url: domain ? website : null,
        city: detectCity(String(p.address ?? ""), ctx.region) ?? ctx.location ?? null,
        phone: typeof p.phoneNumber === "string" ? p.phoneNumber : null,
        maps_url: mapsUrl(p),
        source: "maps",
      });
    }
  }
  return { candidates: out, blocked };
}

/** Ghép từ khoá với địa danh nếu từ khoá chưa chứa địa danh đó. */
export function buildQuery(keyword: string, location: string | null | undefined, region: Region | undefined): string {
  const k = keyword.trim();
  if (!location) return k;
  const loc = region?.locations?.find((l) => l.name === location);
  const aliases = [location, ...(loc?.aliases ?? [])].map((a) => a.toLowerCase());
  return aliases.some((a) => k.toLowerCase().includes(a)) ? k : `${k} ${location}`;
}
