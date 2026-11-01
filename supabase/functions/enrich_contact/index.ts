// enrich_contact — tìm người quyết định từ trang About/Team, gắn nhãn email (mục 4.4).
// Không gửi thử SMTP; nhãn 'verified' chưa dùng ở bản đầu.
import { json, pool, serve, uuidList } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { assertConcurrency, audit, finishRun, startRun } from "../_shared/runs.ts";
import { crawlSite } from "../_shared/crawler.ts";
import { extractEmails, extractPhones, type FoundValue } from "../_shared/extract.ts";
import { homeUrlFor } from "../_shared/domain.ts";
import { buildContacts, findDecisionMakers } from "../_shared/people.ts";
import { mxStatus, type MxStatus } from "../_shared/mx.ts";
import { loadDnc } from "../_shared/dnc.ts";
import { confirmedSignals, insertObservations, recomputeScores } from "../_shared/signals.ts";
import type { EnrichContactResponse } from "../_shared/types.ts";

interface Company {
  id: string;
  domain: string | null;
  website_url: string | null;
  status: string;
}

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);
  const ids = uuidList(body.company_ids, settings.limits.max_companies_per_batch);
  await assertConcurrency(ctx, settings.limits.max_concurrent_runs_per_user);

  const deadline = Date.now() + settings.crawl.time_budget_ms;
  const runId = await startRun(ctx, "enrich_contact", { company_ids: ids });
  const companies = must(
    await ctx.db.from("companies").select("id, domain, website_url, status").in("id", ids),
    "Đọc companies",
  ) as Company[];
  const confirmed = await confirmedSignals(ctx.db);
  const dnc = await loadDnc(ctx.db);
  const mxCache = new Map<string, Promise<MxStatus>>();
  const mxOf = (d: string) => {
    if (!mxCache.has(d)) mxCache.set(d, mxStatus(d));
    return mxCache.get(d)!;
  };

  let processed = 0, contactsTotal = 0, decisionMakers = 0;
  const remaining: string[] = [];
  const errors: string[] = [];
  const touched: string[] = [];

  await pool(companies, settings.crawl.concurrency, async (c) => {
    if (Date.now() > deadline - 25_000) {
      remaining.push(c.id);
      return;
    }
    if (!c.domain || dnc.isDomain(c.domain) || c.status === "archived" || c.status === "unreachable") return;
    try {
      const crawl = await crawlSite(c.domain, homeUrlFor(c.domain, c.website_url), ["team", "about", "contact"], {
        delayMs: settings.crawl.delay_ms,
        maxPages: 4,
        maxAttempts: settings.crawl.max_attempts_per_company,
        timeoutMs: settings.crawl.timeout_ms,
        userAgent: settings.crawl.user_agent,
        deadline,
      });
      if (!crawl.ok) {
        errors.push(`${c.domain}: ${crawl.errors.map((e) => e.error).join(", ") || "không truy cập được"}`);
        return;
      }

      const people = findDecisionMakers(crawl.pages);
      const emailMap = new Map<string, FoundValue>();
      for (const e of crawl.pages.flatMap(extractEmails)) {
        if (dnc.isEmail(e.value)) continue; // DNC email: không lưu
        const prev = emailMap.get(e.value);
        if (!prev || prev.confidence < e.confidence) emailMap.set(e.value, e);
      }
      const emails = [...emailMap.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 10);
      const phones = [...new Set(crawl.pages.flatMap(extractPhones).map((p) => p.value))].slice(0, 3);

      // MX cho mọi domain email liên quan (domain công ty + domain email công khai)
      const domains = new Set([c.domain, ...emails.map((e) => e.value.split("@")[1])]);
      const mx = new Map<string, MxStatus>();
      for (const d of domains) mx.set(d, await mxOf(d));

      const drafts = buildContacts(c.domain, people, emails, phones, (d) => mx.get(d) ?? "unknown")
        .filter((d) => !dnc.isEmail(d.email));

      // Thay danh sách liên hệ tự động cũ; giữ liên hệ nhập tay.
      must(await ctx.db.from("contacts").delete().eq("company_id", c.id).eq("source", "auto"), "Xoá contacts cũ");
      if (drafts.length) {
        must(
          await ctx.db.from("contacts").insert(drafts.map((d) => ({
            company_id: c.id,
            full_name: d.full_name,
            job_title: d.job_title,
            email: d.email,
            email_label: d.email_label,
            phone: d.phone,
            confidence: d.confidence,
            source: "auto",
            evidence_url: d.evidence_url,
          }))),
          "Ghi contacts",
        );
      }
      await insertObservations(ctx.db, c.id, [{
        code: "DECISION_MAKER_FOUND",
        value_num: people.length,
        value_text: people.map((p) => `${p.full_name} — ${p.job_title}`).join("\n") || null,
        confidence: people.length ? Math.max(...people.map((p) => p.confidence)) : 0.7,
        evidence_url: people[0]?.evidence_url ?? crawl.homeUrl!,
      }], confirmed, runId);
      must(
        await ctx.db.from("companies").update({ contacts_enriched_at: new Date().toISOString() }).eq("id", c.id),
        "Cập nhật company",
      );
      processed++;
      contactsTotal += drafts.length;
      decisionMakers += people.length;
      touched.push(c.id);
    } catch (e) {
      errors.push(`${c.domain}: ${(e as Error).message}`.slice(0, 300));
    }
  });

  if (touched.length) await recomputeScores(ctx.db, touched);

  const stats = { processed, contacts: contactsTotal, decision_makers: decisionMakers, errors: errors.slice(0, 30) };
  await finishRun(ctx.db, runId, remaining.length ? "partial" : "done", stats, {
    progress: remaining.length ? { remaining_ids: remaining } : null,
    error: errors.length ? `${errors.length} công ty lỗi (xem stats.errors)` : null,
  });
  await audit(ctx.db, ctx.userId, "run.enrich_contact", { run_id: runId, companies: ids.length, ...stats });

  const res: EnrichContactResponse = {
    run_id: runId,
    processed,
    contacts: contactsTotal,
    decision_makers: decisionMakers,
    remaining_ids: remaining,
  };
  return json(res);
});
