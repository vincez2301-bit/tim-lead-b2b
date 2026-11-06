// enrich_contact — tìm người quyết định từ trang About/Team, gắn nhãn email (mục 4.4).
// Không gửi thử SMTP; nhãn 'verified' chưa dùng ở bản đầu.
import { json, pool, serve, uuidList } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { assertConcurrency, audit, finishRun, startRun } from "../_shared/runs.ts";
import { crawlSite } from "../_shared/crawler.ts";
import { homeUrlFor } from "../_shared/domain.ts";
import { loadDnc } from "../_shared/dnc.ts";
import { CONTACT_KINDS, mxCache, saveContacts } from "../_shared/contacts.ts";
import { cityFromPages } from "../_shared/city.ts";
import { confirmedSignals, recomputeScores } from "../_shared/signals.ts";
import type { EnrichContactResponse } from "../_shared/types.ts";

interface Company {
  id: string;
  domain: string | null;
  website_url: string | null;
  city: string | null;
  status: string;
}

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);
  const ids = uuidList(body.company_ids, settings.limits.max_companies_per_batch);
  await assertConcurrency(ctx, settings.limits.max_concurrent_runs_per_user);

  const deadline = Date.now() + settings.crawl.time_budget_ms;
  const runId = await startRun(ctx, "enrich_contact", { company_ids: ids });
  // Ba truy vấn độc lập: chạy song song.
  const [companiesRes, confirmed, dnc] = await Promise.all([
    ctx.db.from("companies").select("id, domain, website_url, city, status").in("id", ids),
    confirmedSignals(ctx.db),
    loadDnc(ctx.db),
  ]);
  const companies = must(companiesRes, "Đọc companies") as Company[];
  const mxOf = mxCache();

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
      const crawl = await crawlSite(c.domain, homeUrlFor(c.domain, c.website_url), [...CONTACT_KINDS], {
        delayMs: settings.crawl.delay_ms,
        maxPages: 4,
        maxAttempts: settings.crawl.max_attempts_per_company,
        timeoutMs: settings.crawl.timeout_ms,
        userAgent: settings.crawl.user_agent,
        deadline,
        linkOnly: ["team"],
      });
      if (!crawl.ok) {
        errors.push(`${c.domain}: ${crawl.errors.map((e) => e.error).join(", ") || "không truy cập được"}`);
        return;
      }
      const city = c.city ? null : cityFromPages(crawl.pages, settings.regions[0]);
      const saved = await saveContacts(ctx.db, { id: c.id, domain: c.domain }, crawl.pages, crawl.homeUrl!, {
        dnc,
        confirmed,
        runId,
        mxOf,
      });
      must(
        await ctx.db.from("companies").update({
          contacts_enriched_at: new Date().toISOString(),
          ...(!c.city && city ? { city } : {}),
        }).eq("id", c.id),
        "Cập nhật company",
      );
      processed++;
      contactsTotal += saved.contacts;
      decisionMakers += saved.decisionMakers;
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
