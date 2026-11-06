// profile — đọc website công khai của công ty bằng regex, ghi observations (mục 4.2).
// Cùng lượt đọc này tìm luôn người liên hệ (không phải đọc lại website ở bước enrich_contact).
import { json, pool, serve, uuidList } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { assertConcurrency, audit, finishRun, startRun } from "../_shared/runs.ts";
import { crawlSite } from "../_shared/crawler.ts";
import { extractSite, type Finding } from "../_shared/extract.ts";
import { homeUrlFor } from "../_shared/domain.ts";
import { confirmedSignals, insertObservations, recomputeScores } from "../_shared/signals.ts";
import { loadDnc } from "../_shared/dnc.ts";
import { mxCache, saveContacts } from "../_shared/contacts.ts";
import type { ProfileResponse } from "../_shared/types.ts";

interface Company {
  id: string;
  name: string;
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
  const runId = await startRun(ctx, "profile", { company_ids: ids });
  const [companiesRes, confirmed, dnc] = await Promise.all([
    ctx.db.from("companies").select("id, name, domain, website_url, status").in("id", ids),
    confirmedSignals(ctx.db),
    loadDnc(ctx.db),
  ]);
  const companies = must(companiesRes, "Đọc companies") as Company[];
  const mxOf = mxCache();

  let processed = 0, failed = 0, skipped = 0, observations = 0, contacts = 0, decisionMakers = 0;
  const remaining: string[] = [];
  const errors: { company: string; url: string; error: string }[] = [];
  const touched: string[] = [];

  await pool(companies, settings.crawl.concurrency, async (c) => {
    // Không bắt đầu công ty mới nếu không đủ thời gian cho ~1 công ty.
    if (Date.now() > deadline - 25_000) {
      remaining.push(c.id);
      return;
    }
    if (!c.domain || dnc.isDomain(c.domain) || c.status === "archived") {
      skipped++;
      return;
    }
    try {
      const crawl = await crawlSite(c.domain, homeUrlFor(c.domain, c.website_url), [
        "contact",
        "about",
        "careers",
        "portfolio",
        "team",
      ], {
        delayMs: settings.crawl.delay_ms,
        maxPages: settings.crawl.max_pages_per_company,
        maxAttempts: settings.crawl.max_attempts_per_company,
        timeoutMs: settings.crawl.timeout_ms,
        userAgent: settings.crawl.user_agent,
        deadline,
        linkOnly: ["team"],
      });
      for (const e of crawl.errors.slice(0, 10)) errors.push({ company: c.domain, ...e });

      if (!crawl.ok) {
        if (crawl.robotsBlocked) {
          skipped++;
          return;
        }
        failed++;
        const findings: Finding[] = crawl.dnsFail
          ? [{
            code: "NO_WEBSITE",
            value_num: 1,
            value_text: "Domain không phân giải được",
            confidence: 1,
            evidence_url: `https://${c.domain}/`,
          }]
          : [];
        observations += await insertObservations(ctx.db, c.id, findings, confirmed, runId);
        must(
          await ctx.db.from("companies").update({ status: "unreachable", profiled_at: new Date().toISOString() })
            .eq("id", c.id),
          "Cập nhật company",
        );
        touched.push(c.id);
        return;
      }

      const ex = extractSite(crawl.pages, { excludeEmail: (e) => dnc.isEmail(e) });
      const findings: Finding[] = [
        ...ex.findings,
        {
          code: "NO_WEBSITE",
          value_num: 0,
          value_text: null,
          confidence: 1,
          evidence_url: crawl.homeUrl!,
        },
      ];
      observations += await insertObservations(ctx.db, c.id, findings, confirmed, runId);
      const saved = await saveContacts(ctx.db, { id: c.id, domain: c.domain }, crawl.pages, crawl.homeUrl!, {
        dnc,
        confirmed,
        runId,
        mxOf,
      });
      contacts += saved.contacts;
      decisionMakers += saved.decisionMakers;
      const now = new Date().toISOString();
      must(
        await ctx.db.from("companies").update({
          status: c.status === "enriched" ? "enriched" : "profiled",
          profiled_at: now,
          contacts_enriched_at: now,
          website_url: crawl.homeUrl,
        }).eq("id", c.id),
        "Cập nhật company",
      );
      processed++;
      touched.push(c.id);
    } catch (e) {
      failed++;
      errors.push({ company: c.domain, url: "", error: (e as Error).message.slice(0, 300) });
    }
  });

  if (touched.length) await recomputeScores(ctx.db, touched);

  const stats = { processed, failed, skipped, observations, contacts, decision_makers: decisionMakers, remaining: remaining.length, fetch_errors: errors.slice(0, 50) };
  await finishRun(ctx.db, runId, remaining.length ? "partial" : "done", stats, {
    progress: remaining.length ? { remaining_ids: remaining } : null,
    error: errors.length ? `${errors.length} lỗi tải trang (xem stats.fetch_errors)` : null,
  });
  await audit(ctx.db, ctx.userId, "run.profile", { run_id: runId, companies: ids.length, processed, failed, skipped });

  const res: ProfileResponse = {
    run_id: runId,
    processed,
    failed,
    skipped,
    observations,
    contacts,
    decision_makers: decisionMakers,
    remaining_ids: remaining,
  };
  return json(res);
});
