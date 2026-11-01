// discover — tìm công ty qua Serper (Google Search / Maps) và ghi vào companies (mục 4.1).
import { badRequest, HttpError, intIn, json, oneOf, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { quotaExceeded, refund, reserve } from "../_shared/quota.ts";
import { assertConcurrency, audit, finishRun, startRun } from "../_shared/runs.ts";
import { buildQuery, type Candidate, parseSerperResults, serperCall, SerperError } from "../_shared/serper.ts";
import { confirmedSignals, insertObservations, recomputeScores } from "../_shared/signals.ts";
import { type Finding, formatVnPhone, normalizeVnPhone } from "../_shared/extract.ts";
import { loadDnc } from "../_shared/dnc.ts";
import type { DiscoverMode, DiscoverResponse, Segment } from "../_shared/types.ts";

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);
  const { limits } = settings;

  // ---- kiểm tra input
  const segment = oneOf<Segment>(body.segment, ["agency", "brand", "film", "mcn"], undefined, "segment");
  if (!Array.isArray(body.keywords)) throw badRequest("keywords phải là mảng");
  const keywords = [...new Set(
    (body.keywords as unknown[]).filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean),
  )];
  if (keywords.length < 1 || keywords.length > 20) throw badRequest("Cần 1–20 từ khoá");
  if (keywords.some((k) => k.length > 120)) throw badRequest("Mỗi từ khoá tối đa 120 ký tự");
  const region = settings.regions.find((r) => r.code === body.region);
  if (!region) throw badRequest("Khu vực không có trong cài đặt (settings.regions)");
  const location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
  if (location && location.length > 60) throw badRequest("Địa danh quá dài");
  const pages = intIn(body.pages, 1, 3, 1, "pages");
  const mode = oneOf<DiscoverMode>(body.mode, ["search", "maps", "both"], "search", "mode");
  const maxResults = intIn(body.max_results, 1, limits.max_results_per_discover, limits.max_results_per_discover, "max_results");

  const kinds: ("search" | "maps")[] = mode === "both" ? ["search", "maps"] : [mode];
  const estimated = keywords.length * pages * kinds.length;
  if (estimated > limits.confirm_above_units && body.confirm !== true) {
    throw new HttpError(409, `Lần chạy này cần ${estimated} lượt Serper — cần xác nhận (confirm: true).`, "confirmation_required");
  }

  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) throw new HttpError(500, "Chưa cấu hình SERPER_API_KEY cho Edge Function", "not_configured");

  await assertConcurrency(ctx, limits.max_concurrent_runs_per_user);
  const input = { segment, keywords, region: region.code, location, pages, mode, max_results: maxResults };
  const search = must(
    await ctx.db.from("searches").insert({
      owner_id: ctx.userId, segment, keywords, region: region.code, location, mode, pages,
    }).select("id").single(),
    "Lưu search",
  ) as { id: string };
  const runId = await startRun(ctx, "discover", input, {
    provider: "serper",
    api_units_estimated: estimated,
    search_id: search.id,
  });

  // ---- gọi Serper
  const candidates: Candidate[] = [];
  let skippedBlocked = 0;
  let unitsUsed = 0;
  let stopReason: string | null = null;
  outer:
  for (const keyword of keywords) {
    for (let page = 1; page <= pages; page++) {
      for (const kind of kinds) {
        if (candidates.length >= maxResults * 2) break outer;
        if (!(await reserve(ctx.db, runId, ctx.userId, "serper", 1))) {
          stopReason = "quota";
          break outer;
        }
        try {
          const res = await serperCall(kind, {
            q: buildQuery(keyword, location, region),
            gl: region.gl,
            hl: region.hl,
            page,
          }, apiKey);
          unitsUsed++;
          const parsed = parseSerperResults(kind, res, {
            blocklist: settings.aggregator_blocklist,
            region,
            location,
          });
          skippedBlocked += parsed.blocked;
          candidates.push(...parsed.candidates.map((c) => ({ ...c })));
        } catch (e) {
          await refund(ctx.db, runId, ctx.userId, "serper", 1); // lỗi → không trừ quota nội bộ
          stopReason = e instanceof SerperError ? e.message : `Lỗi gọi Serper: ${(e as Error).message}`;
          break outer;
        }
      }
    }
  }

  // ---- khử trùng trong lô, loại DNC
  const dnc = await loadDnc(ctx.db);
  const seen = new Set<string>();
  const accepted: Candidate[] = [];
  let skippedDnc = 0;
  for (const c of candidates) {
    const key = c.domain ?? `${c.name.toLowerCase()}|${c.city ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (dnc.isDomain(c.domain)) {
      skippedDnc++;
      continue;
    }
    accepted.push(c);
    if (accepted.length >= maxResults) break;
  }

  // ---- upsert
  let upserted: { company_id: string; is_new: boolean; company_domain: string | null; company_name: string }[] = [];
  if (accepted.length) {
    const { data, error } = await ctx.db.rpc("upsert_companies", {
      p_rows: accepted.map((c) => ({
        name: c.name, domain: c.domain, website_url: c.website_url, segment, city: c.city,
        country: region.country ?? region.code, source: c.source,
      })),
      p_run_id: runId,
    });
    if (error) {
      await finishRun(ctx.db, runId, "failed", { units_used: unitsUsed }, { error: error.message });
      throw new Error(`upsert_companies: ${error.message}`);
    }
    upserted = data ?? [];
  }

  // ---- observation từ Maps: SĐT công khai, không có website
  const confirmed = await confirmedSignals(ctx.db);
  const touched: string[] = [];
  for (const c of accepted) {
    const row = upserted.find((u) =>
      c.domain ? u.company_domain === c.domain : u.company_domain === null && u.company_name === c.name
    );
    if (!row || c.source !== "maps" || !c.maps_url) continue;
    const findings: Finding[] = [];
    const phone = c.phone ? normalizeVnPhone(c.phone) : null;
    if (phone) {
      findings.push({ code: "HAS_PHONE", value_num: 1, value_text: formatVnPhone(phone), confidence: 0.8, evidence_url: c.maps_url });
    }
    if (!c.domain) {
      findings.push({ code: "NO_WEBSITE", value_num: 1, value_text: "Chỉ có trên Google Maps", confidence: 0.9, evidence_url: c.maps_url });
    }
    if (findings.length && await insertObservations(ctx.db, row.company_id, findings, confirmed, runId)) {
      touched.push(row.company_id);
    }
  }
  if (touched.length) await recomputeScores(ctx.db, touched);

  const newIds = upserted.filter((u) => u.is_new).map((u) => u.company_id);
  const status = stopReason ? (upserted.length || unitsUsed ? "partial" : "failed") : "done";
  const stats = {
    new: newIds.length,
    existing: upserted.length - newIds.length,
    skipped_dnc: skippedDnc,
    skipped_blocked: skippedBlocked,
    units_used: unitsUsed,
  };
  await finishRun(ctx.db, runId, status, stats, { error: stopReason });
  await audit(ctx.db, ctx.userId, "run.discover", { run_id: runId, ...input, ...stats });

  if (status === "failed" && stopReason === "quota") throw quotaExceeded("serper");
  if (status === "failed") throw new HttpError(502, stopReason ?? "Discover thất bại", "upstream_error");

  const res: DiscoverResponse = {
    run_id: runId,
    status,
    ...stats,
    company_ids: upserted.map((u) => u.company_id),
    new_company_ids: newIds,
    message: stopReason === "quota"
      ? "Dừng sớm vì hết hạn mức Serper hôm nay."
      : stopReason ?? undefined,
  };
  return json(res);
});
