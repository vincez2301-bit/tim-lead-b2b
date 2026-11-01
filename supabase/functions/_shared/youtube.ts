// YouTube Data API v3 — chỉ dùng channels.list và playlistItems.list (~1 đơn vị/lần),
// KHÔNG dùng search.list (100 đơn vị) trong luồng chuẩn (mục 3, mục 4.3).

export class QuotaExceededError extends Error {
  constructor() {
    super("quotaExceeded");
  }
}

export interface ChannelRef {
  url: string; // URL kênh đã chuẩn hoá (từ website)
  id?: string; // UC...
  handle?: string; // @handle
  username?: string; // /user/ hoặc /c/
}

export interface ChannelStats {
  id: string;
  title: string;
  url: string;
  subscribers: number | null; // null nếu kênh ẩn số subscriber
  videoCount: number;
  viewCount: number;
  uploadsPlaylistId: string | null;
  videos30d: number;
  videos90d: number;
}

export function parseChannelUrl(url: string): ChannelRef | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    if (parts[0] === "channel" && /^UC[\w-]{22}$/.test(parts[1] ?? "")) return { url, id: parts[1] };
    if (parts[0].startsWith("@")) return { url, handle: parts[0] };
    if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { url, username: parts[1] };
  } catch { /* bỏ qua */ }
  return null;
}

/** Đếm số video đăng trong N ngày gần nhất từ danh sách thời điểm đăng. */
export function countSince(publishedAt: string[], days: number, now = Date.now()): number {
  const since = now - days * 86_400_000;
  return publishedAt.filter((d) => {
    const t = Date.parse(d);
    return Number.isFinite(t) && t >= since;
  }).length;
}

export interface YoutubeClientOptions {
  apiKey: string;
  /** Được gọi TRƯỚC mỗi request; trả về false nếu đã hết hạn mức nội bộ. */
  beforeCall: (units: number) => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export class YoutubeClient {
  unitsUsed = 0;
  constructor(private opts: YoutubeClientOptions) {}

  private async call(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    if (!(await this.opts.beforeCall(1))) throw new QuotaExceededError();
    this.unitsUsed += 1;
    const qs = new URLSearchParams({ ...params, key: this.opts.apiKey });
    const res = await (this.opts.fetchImpl ?? fetch)(`https://www.googleapis.com/youtube/v3/${path}?${qs}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const err = body.error as { errors?: { reason?: string }[]; message?: string } | undefined;
      const reasons = (err?.errors ?? []).map((e) => e.reason);
      if (reasons.includes("quotaExceeded") || reasons.includes("dailyLimitExceeded")) throw new QuotaExceededError();
      // Không đưa URL (chứa key) vào thông báo lỗi.
      throw new Error(`YouTube API ${res.status}: ${reasons.join(",") || err?.message || "lỗi"}`);
    }
    return body;
  }

  /** Lấy thống kê kênh; trả về null nếu không xác định được kênh. */
  async channel(ref: ChannelRef, now = Date.now()): Promise<ChannelStats | null> {
    const params: Record<string, string> = { part: "snippet,statistics,contentDetails", maxResults: "1" };
    if (ref.id) params.id = ref.id;
    else if (ref.handle) params.forHandle = ref.handle;
    else if (ref.username) params.forUsername = ref.username;
    else return null;

    let body = await this.call("channels", params);
    let item = (body.items as Record<string, unknown>[] | undefined)?.[0];
    // /c/<tên> thường trùng @handle — thử thêm một lần (1 đơn vị) thay vì search.list (100 đơn vị).
    if (!item && ref.username) {
      body = await this.call("channels", { part: "snippet,statistics,contentDetails", forHandle: `@${ref.username}` });
      item = (body.items as Record<string, unknown>[] | undefined)?.[0];
    }
    if (!item) return null;

    const stats = (item.statistics ?? {}) as Record<string, string | boolean>;
    const snippet = (item.snippet ?? {}) as Record<string, string>;
    const uploads = ((item.contentDetails as Record<string, Record<string, string>> | undefined)?.relatedPlaylists
      ?.uploads) ?? null;
    const id = item.id as string;

    // Video gần nhất: tối đa 3 trang × 50 (dừng khi đã qua mốc 90 ngày).
    const published: string[] = [];
    if (uploads) {
      let pageToken = "";
      for (let page = 0; page < 3; page++) {
        const p: Record<string, string> = { part: "contentDetails", playlistId: uploads, maxResults: "50" };
        if (pageToken) p.pageToken = pageToken;
        let pl: Record<string, unknown>;
        try {
          pl = await this.call("playlistItems", p);
        } catch (e) {
          if (e instanceof QuotaExceededError) throw e;
          break; // playlist rỗng / bị ẩn → 404
        }
        const items = (pl.items as { contentDetails?: { videoPublishedAt?: string } }[] | undefined) ?? [];
        const dates = items.map((i) => i.contentDetails?.videoPublishedAt).filter((d): d is string => !!d);
        published.push(...dates);
        pageToken = (pl.nextPageToken as string | undefined) ?? "";
        const oldest = Math.min(...dates.map((d) => Date.parse(d)));
        if (!pageToken || !dates.length || oldest < now - 90 * 86_400_000) break;
      }
    }

    return {
      id,
      title: snippet.title ?? "",
      url: `https://www.youtube.com/channel/${id}`,
      subscribers: stats.hiddenSubscriberCount === true || stats.subscriberCount === undefined
        ? null
        : Number(stats.subscriberCount),
      videoCount: Number(stats.videoCount ?? 0),
      viewCount: Number(stats.viewCount ?? 0),
      uploadsPlaylistId: uploads,
      videos30d: countSince(published, 30, now),
      videos90d: countSince(published, 90, now),
    };
  }
}
