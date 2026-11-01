// enrich_youtube — bổ sung dữ liệu kênh YouTube qua API chính thức (mục 4.3).
// Kênh lấy từ observation HAS_YOUTUBE (link trên website) — không dùng search.list.
import { badRequest, HttpError, isUuid, json, serve, uuidList } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { reserve } from "../_shared/quota.ts";
import { assertConcurrency, audit, finishRun, startRun } from "../_shared/runs.ts";
import { type ChannelStats, parseChannelUrl, QuotaExceededError, YoutubeClient } from "../_shared/youtube.ts";
import type { Finding } from "../_shared/extract.ts";
import { confirmedSignals, insertObservations, recomputeScores } from "../_shared/signals.ts";
import type { EnrichYoutubeResponse } from "../_shared/types.ts";

const MAX_CHANNELS_PER_COMPANY = 5;

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);
  const batch = settings.limits.max_companies_per_batch;

  // ---- xác định danh sách công ty (mới hoặc tiếp tục run đã dừng vì hết quota)
  let ids: string[];
  let resumedFrom: string | null = null;
  if (body.resume_run_id !== undefined) {
    if (!isUuid(body.resume_run_id)) throw badRequest("resume_run_id không hợp lệ");
    const prev = must(
      await ctx.db.from("runs").select("id, owner_id, step, status, progress").eq("id", body.resume_run_id).maybeSingle(),
      "Đọc run",
    ) as { id: string; owner_id: string; step: string; status: string; progress: { remaining_ids?: string[] } | null } | null;
    if (!prev || (prev.owner_id !== ctx.userId && !ctx.isAdmin)) throw new HttpError(404, "Không tìm thấy run", "not_found");
    if (prev.step !== "enrich_youtube" || prev.status !== "partial" || !prev.progress?.remaining_ids?.length) {
      throw badRequest("Run này không có phần việc để tiếp tục");
    }
    ids = prev.progress.remaining_ids.filter(isUuid);
    resumedFrom = prev.id;
  } else {
    ids = uuidList(body.company_ids, batch);
  }
  const current = ids.slice(0, batch);
  const carry = ids.slice(batch); // phần vượt lô (khi tiếp tục run cũ) → trả về remaining_ids

  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) throw new HttpError(500, "Chưa cấu hình YOUTUBE_API_KEY cho Edge Function", "not_configured");
  await assertConcurrency(ctx, settings.limits.max_concurrent_runs_per_user);

  const deadline = Date.now() + settings.crawl.time_budget_ms;
  const runId = await startRun(ctx, "enrich_youtube", { company_ids: current, resume_run_id: resumedFrom }, {
    provider: "youtube",
    api_units_estimated: current.length * 3,
  });
  if (resumedFrom) {
    await ctx.db.from("runs").update({ progress: { resumed_by: runId } }).eq("id", resumedFrom);
  }

  // Link kênh mới nhất của mỗi công ty
  const links = must(
    await ctx.db.from("latest_observations").select("company_id, value_text, value_num")
      .eq("signal_code", "HAS_YOUTUBE").in("company_id", current),
    "Đọc HAS_YOUTUBE",
  ) as { company_id: string; value_text: string | null; value_num: number | null }[];
  const companies = must(
    await ctx.db.from("companies").select("id, status").in("id", current),
    "Đọc companies",
  ) as { id: string; status: string }[];
  const confirmed = await confirmedSignals(ctx.db);
  const rules = settings.signal_rules;

  const yt = new YoutubeClient({
    apiKey,
    beforeCall: (units) => reserve(ctx.db, runId, ctx.userId, "youtube", units),
  });

  let processed = 0, channelsTotal = 0, skippedNoChannel = 0;
  let stopped: "quota" | "time" | null = null;
  const remaining: string[] = [];
  const touched: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < current.length; i++) {
    const companyId = current[i];
    if (stopped) {
      remaining.push(companyId);
      continue;
    }
    if (Date.now() > deadline - 15_000) {
      stopped = "time";
      remaining.push(companyId);
      continue;
    }
    const company = companies.find((c) => c.id === companyId);
    const link = links.find((l) => l.company_id === companyId);
    const urls = (link?.value_text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (!company || !link || !(link.value_num ?? 0) || !urls.length) {
      skippedNoChannel++;
      continue;
    }

    try {
      const stats: ChannelStats[] = [];
      for (const url of urls.slice(0, MAX_CHANNELS_PER_COMPANY)) {
        const ref = parseChannelUrl(url);
        if (!ref) continue;
        const s = await yt.channel(ref);
        if (s && !stats.some((x) => x.id === s.id)) stats.push(s);
      }
      if (!stats.length) {
        skippedNoChannel++;
        continue;
      }
      channelsTotal += stats.length;
      const main = [...stats].sort((a, b) => (b.subscribers ?? -1) - (a.subscribers ?? -1))[0];
      const subs = stats.map((s) => s.subscribers).filter((n): n is number => n !== null);
      const v30 = stats.reduce((a, s) => a + s.videos30d, 0);
      const v90 = stats.reduce((a, s) => a + s.videos90d, 0);
      const names = stats.map((s) => `${s.title} (${s.url})`).join("\n");
      const findings: Finding[] = [
        {
          code: "YT_SUBSCRIBERS",
          value_num: subs.length ? Math.max(...subs) : null,
          value_text: subs.length ? main.title : "Kênh ẩn số subscriber",
          confidence: 0.9,
          evidence_url: main.url,
        },
        {
          code: "YT_UPLOAD_FREQ",
          value_num: v90,
          value_text: `30 ngày: ${v30} video; 90 ngày: ${v90} video`,
          confidence: 0.9,
          evidence_url: main.url,
        },
        {
          code: "ACTIVE_YOUTUBE",
          value_num: v30,
          value_text: `${v30} video trong 30 ngày (ngưỡng ${rules.ACTIVE_YOUTUBE?.min ?? 4})`,
          confidence: 0.9,
          evidence_url: main.url,
        },
        {
          code: "MULTI_CHANNEL_OWNER",
          value_num: stats.length,
          value_text: names,
          confidence: 0.8,
          evidence_url: main.url,
        },
      ];
      await insertObservations(ctx.db, companyId, findings, confirmed, runId);
      must(
        await ctx.db.from("companies").update({
          youtube_enriched_at: new Date().toISOString(),
          ...(company.status === "profiled" || company.status === "new" ? { status: "enriched" } : {}),
        }).eq("id", companyId),
        "Cập nhật company",
      );
      processed++;
      touched.push(companyId);
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        stopped = "quota";
        remaining.push(companyId);
        continue;
      }
      errors.push(`${companyId}: ${(e as Error).message}`.slice(0, 300));
    }
  }

  if (touched.length) await recomputeScores(ctx.db, touched);

  const allRemaining = [...remaining, ...carry];
  const status = stopped === "quota" ? "partial" : allRemaining.length ? "partial" : "done";
  const stats = {
    processed,
    channels: channelsTotal,
    units_used: yt.unitsUsed,
    skipped_no_channel: skippedNoChannel,
    stopped_reason: stopped,
    errors: errors.slice(0, 20),
  };
  await finishRun(ctx.db, runId, status, stats, {
    progress: allRemaining.length ? { remaining_ids: allRemaining } : null,
    error: stopped === "quota" ? "Hết quota YouTube — chạy tiếp sau khi quota đặt lại (0h giờ Thái Bình Dương)" : null,
  });
  await audit(ctx.db, ctx.userId, "run.enrich_youtube", { run_id: runId, ...stats, resumed_from: resumedFrom });

  const res: EnrichYoutubeResponse = {
    run_id: runId,
    status,
    processed,
    channels: channelsTotal,
    units_used: yt.unitsUsed,
    skipped_no_channel: skippedNoChannel,
    remaining_ids: allRemaining,
    stopped_reason: stopped,
  };
  return json(res);
});
