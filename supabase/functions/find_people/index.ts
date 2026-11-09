// find_people — tìm người phụ trách ngoài website (spec 003): hồ sơ LinkedIn công khai qua Google và email của
// công ty xuất hiện trên Internet (Serper), ghép người–email, đoán email theo mẫu khi có email thật làm bằng chứng.
// Tối đa 2 lượt Serper/công ty; chỉ công ty đang trong pipeline; không tìm lại trong 30 ngày (trừ khi force).
import { HttpError, json, pool, serve, uuidList } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { refund, reserve } from "../_shared/quota.ts";
import { assertConcurrency, audit, finishRun, startRun } from "../_shared/runs.ts";
import { serperCall, SerperError } from "../_shared/serper.ts";
import { loadDnc } from "../_shared/dnc.ts";
import { mxCache } from "../_shared/contacts.ts";
import {
  companyKeys,
  emailQuery,
  type FoundPerson,
  hasPersonEmail,
  type KnownContact,
  mergeFound,
  parseLinkedInResults,
  parseWebEmails,
  peopleQuery,
  rolesFor,
  type WebEmail,
} from "../_shared/people_search.ts";
import { confirmedSignals, insertObservations, recomputeScores } from "../_shared/signals.ts";
import type { FindPeopleResponse } from "../_shared/types.ts";

const RESEARCH_DAYS = 30;
const OWN_SOURCES = ["linkedin", "web"];

interface Company {
  id: string;
  name: string;
  domain: string | null;
  segment: string | null;
  status: string;
  people_searched_at: string | null;
}
interface ContactLite extends KnownContact {
  company_id: string;
  source: string;
}

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);
  const ids = uuidList(body.company_ids, settings.limits.max_companies_per_batch);
  const force = body.force === true;
  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) throw new HttpError(500, "Chưa cấu hình SERPER_API_KEY cho Edge Function", "not_configured");
  await assertConcurrency(ctx, settings.limits.max_concurrent_runs_per_user);

  const [companiesRes, dealsRes, contactsRes, dnc, confirmed] = await Promise.all([
    ctx.db.from("companies").select("id, name, domain, segment, status, people_searched_at").in("id", ids),
    ctx.db.from("deals").select("company_id, stage").in("company_id", ids),
    ctx.db.from("contacts").select("company_id, full_name, email, email_label, source").in("company_id", ids),
    loadDnc(ctx.db),
    confirmedSignals(ctx.db),
  ]);
  const companies = must(companiesRes, "Đọc companies") as Company[];
  const deals = must(dealsRes, "Đọc deals") as { company_id: string; stage: string }[];
  const existing = must(contactsRes, "Đọc contacts") as ContactLite[];

  const inPipeline = new Set(deals.filter((d) => d.stage !== "lost").map((d) => d.company_id));
  const cutoff = Date.now() - RESEARCH_DAYS * 86_400_000;
  const eligible = companies.filter((c) => inPipeline.has(c.id) && c.status !== "archived" && !dnc.isDomain(c.domain));
  const todo = eligible.filter((c) => force || !c.people_searched_at || Date.parse(c.people_searched_at) < cutoff);
  const skippedRecent = eligible.length - todo.length;
  const skippedNotInPipeline = companies.filter((c) => !inPipeline.has(c.id)).length;

  const runId = await startRun(ctx, "find_people", { company_ids: ids, force }, {
    provider: "serper",
    api_units_estimated: todo.reduce((n, c) => n + 1 + (c.domain ? 1 : 0), 0),
  });
  const region = settings.regions[0];
  const deadline = Date.now() + settings.crawl.time_budget_ms;
  const mxOf = mxCache();

  let unitsUsed = 0, peopleTotal = 0, emailsTotal = 0, guessed = 0, before = 0, after = 0, checked = 0;
  let stopped: "quota" | null = null;
  const remaining: string[] = [];
  const errors: string[] = [];
  const touched: string[] = [];

  /** Một lượt Serper có giữ chỗ hạn mức; null = hết hạn mức. */
  const call = async (q: string) => {
    if (stopped || !(await reserve(ctx.db, runId, ctx.userId, "serper", 1))) {
      stopped = "quota";
      return null;
    }
    try {
      const res = await serperCall("search", { q, gl: region?.gl ?? "vn", hl: region?.hl ?? "vi", page: 1 }, apiKey);
      unitsUsed++;
      return res;
    } catch (e) {
      await refund(ctx.db, runId, ctx.userId, "serper", 1);
      throw e;
    }
  };

  await pool(todo, 3, async (c) => {
    if (stopped || Date.now() > deadline - 20_000) {
      remaining.push(c.id);
      return;
    }
    try {
      const keys = companyKeys(c.name, c.domain);
      const roles = rolesFor(settings.contact_roles, c.segment);
      let complete = true;
      let people: FoundPerson[] = [];
      if (keys.names.length) {
        const res = await call(peopleQuery(keys, roles));
        if (!res) {
          remaining.push(c.id);
          return;
        }
        people = parseLinkedInResults(res, keys, roles);
      }
      let emails: WebEmail[] = [];
      if (c.domain) {
        const res = await call(emailQuery(c.domain));
        if (res) emails = parseWebEmails(res, c.domain).filter((e) => !dnc.isEmail(e.value));
        else complete = false; // hết hạn mức giữa chừng: lưu phần đã có, hôm sau tìm lại
      }

      const mine = existing.filter((x) => x.company_id === c.id);
      const known = mine.filter((x) => !OWN_SOURCES.includes(x.source));
      const domainMx = c.domain ? await mxOf(c.domain) : "unknown";
      const { drafts } = mergeFound(c.domain, people, emails, known, (d) => (d === c.domain ? domainMx : "unknown"));
      const rows = drafts.filter((d) => !dnc.isEmail(d.email));

      must(
        await ctx.db.from("contacts").delete().eq("company_id", c.id).in("source", OWN_SOURCES),
        "Xoá liên hệ tìm lần trước",
      );
      if (rows.length) must(await ctx.db.from("contacts").insert(rows.map((d) => ({ company_id: c.id, ...d }))), "Ghi liên hệ");
      if (complete) {
        must(
          await ctx.db.from("companies").update({ people_searched_at: new Date().toISOString() }).eq("id", c.id),
          "Cập nhật company",
        );
      } else remaining.push(c.id);

      const named = [...known, ...rows].filter((x) => x.full_name);
      if (rows.some((d) => d.full_name)) {
        await insertObservations(ctx.db, c.id, [{
          code: "DECISION_MAKER_FOUND",
          value_num: named.length,
          value_text: rows.filter((d) => d.full_name).map((d) => `${d.full_name} — ${d.job_title ?? ""}`).join("\n"),
          confidence: Math.max(...rows.map((d) => d.confidence)),
          evidence_url: rows.find((d) => d.full_name)!.evidence_url,
        }], confirmed, runId);
        touched.push(c.id);
      }

      checked++;
      if (hasPersonEmail(mine)) before++;
      if (hasPersonEmail([...known, ...rows])) after++;
      peopleTotal += rows.filter((d) => d.source === "linkedin").length;
      emailsTotal += rows.filter((d) => d.email && d.email_label !== "guess").length;
      guessed += rows.filter((d) => d.email_label === "guess").length;
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof SerperError ? e.message : (e as Error).message}`.slice(0, 300));
    }
  });

  if (touched.length) await recomputeScores(ctx.db, touched);

  const stats = {
    checked,
    skipped_recent: skippedRecent,
    skipped_not_in_pipeline: skippedNotInPipeline,
    people: peopleTotal,
    emails: emailsTotal,
    guessed,
    with_person_email_before: before,
    with_person_email_after: after,
    units_used: unitsUsed,
    errors: errors.slice(0, 30),
  };
  await finishRun(ctx.db, runId, remaining.length ? "partial" : errors.length && !checked ? "failed" : "done", stats, {
    progress: remaining.length ? { remaining_ids: remaining } : null,
    error: errors.length ? `${errors.length} công ty lỗi (xem stats.errors)` : null,
  });
  await audit(ctx.db, ctx.userId, "run.find_people", { run_id: runId, companies: ids.length, ...stats });

  const res: FindPeopleResponse = {
    run_id: runId,
    ...stats,
    remaining_ids: remaining,
    stopped_reason: stopped,
  };
  return json(res);
});
