// Phân tích robots.txt theo RFC 9309 (mục 3: đọc và tuân thủ robots.txt).
// - Chọn nhóm user-agent khớp với bot của chúng ta; nếu không có thì dùng nhóm "*".
// - Quy tắc khớp dài nhất thắng; bằng nhau thì Allow thắng. Hỗ trợ "*" và "$".

export interface RobotsRules {
  isAllowed(pathWithQuery: string): boolean;
  crawlDelaySec: number | null;
  sitemaps: string[];
}

interface Rule {
  allow: boolean;
  pattern: string;
  re: RegExp;
}
interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay: number | null;
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

export const ALLOW_ALL: RobotsRules = { isAllowed: () => true, crawlDelaySec: null, sitemaps: [] };
export const DISALLOW_ALL: RobotsRules = {
  isAllowed: (p) => p === "/robots.txt",
  crawlDelaySec: null,
  sitemaps: [],
};

/** Lấy "product token" từ User-Agent, ví dụ "SyncLeadFinderBot/1.0 (...)" → "syncleadfinderbot". */
export function productToken(userAgent: string): string {
  return (userAgent.split(/[\/\s]/)[0] || userAgent).toLowerCase();
}

export function parseRobots(txt: string, userAgent: string): RobotsRules {
  const token = productToken(userAgent);
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      if (/^https?:\/\//i.test(value)) sitemaps.push(value);
    } else if (!current) {
      continue;
    } else if (key === "allow" || key === "disallow") {
      if (value === "") continue; // "Disallow:" rỗng = không cấm gì
      current.rules.push({ allow: key === "allow", pattern: value, re: toRegex(value) });
    } else if (key === "crawl-delay") {
      const d = parseFloat(value);
      if (Number.isFinite(d) && d >= 0) current.crawlDelay = d;
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && a.length > 0 && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  const delays = chosen.map((g) => g.crawlDelay).filter((d): d is number => d !== null);

  return {
    crawlDelaySec: delays.length ? Math.max(...delays) : null,
    sitemaps,
    isAllowed(pathWithQuery: string): boolean {
      if (pathWithQuery === "/robots.txt") return true;
      let best: Rule | null = null;
      for (const r of rules) {
        if (!r.re.test(pathWithQuery)) continue;
        if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) {
          best = r;
        }
      }
      return best ? best.allow : true;
    },
  };
}
