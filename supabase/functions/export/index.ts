// export — xuất cohort ra CSV (UTF-8 BOM) hoặc Excel (mục 6.4).
// Luôn loại DNC ở phía server (cả công ty lẫn email), chống CSV injection, ghi audit_log.
import { HttpError, json, oneOf, serve } from "../_shared/http.ts";
import { corsHeaders } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { audit, finishRun, startRun } from "../_shared/runs.ts";
import { confirmedSignals } from "../_shared/signals.ts";
import { parseCohortFilter } from "../_shared/cohort.ts";
import { loadDnc } from "../_shared/dnc.ts";
import { type Cell, toCsv } from "../_shared/csv.ts";
import { toXlsx } from "../_shared/xlsx.ts";

const SEGMENT_VI: Record<string, string> = {
  broadcaster: "Đài truyền hình",
  agency: "Production house / agency",
  brand: "Nhãn hàng",
  film: "Hãng phim / hậu kỳ",
  mcn: "MCN",
};
const HEADER = [
  "Tên công ty", "Domain", "Website", "Nhóm", "Thành phố", "Trạng thái", "Điểm", "Tín hiệu",
  "Người quyết định", "Email (nhãn)", "Số điện thoại", "Zalo", "YouTube", "TikTok",
];

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);
  const format = oneOf<"csv" | "xlsx">(body.format, ["csv", "xlsx"], "csv", "format");
  // Export LUÔN loại DNC, bất kể client gửi gì.
  const filter = { ...parseCohortFilter(body.filter, await confirmedSignals(ctx.db)), include_dnc: false };
  const maxRows = settings.limits.max_export_rows;

  const runId = await startRun(ctx, "export", { filter, format });
  try {
    const { data, error } = await ctx.db.rpc("cohort_search", { p_filter: { ...filter, limit: maxRows, offset: 0 } });
    if (error) throw new Error(`cohort_search: ${error.message}`);
    const dnc = await loadDnc(ctx.db);
    const hits = ((data ?? []) as { id: string; domain: string | null; is_dnc: boolean }[])
      .filter((r) => !r.is_dnc && !dnc.isDomain(r.domain)); // lọc lại lần nữa (phòng thủ nhiều lớp)
    const ids = hits.map((h) => h.id);

    type Company = {
      id: string; name: string; domain: string | null; website_url: string | null; segment: string | null;
      city: string | null; status: string; score: number | null;
      score_breakdown: { signals?: { code: string; contribution: number }[] } | null;
    };
    type Contact = {
      company_id: string; full_name: string | null; job_title: string | null; email: string | null;
      email_label: string | null; phone: string | null;
    };
    type Obs = { company_id: string; signal_code: string; value_num: number | null; value_text: string | null };
    const companies: Company[] = [];
    const contacts: Contact[] = [];
    const obs: Obs[] = [];
    for (const part of chunk(ids, 200)) {
      companies.push(...must(
        await ctx.db.from("companies")
          .select("id, name, domain, website_url, segment, city, status, score, score_breakdown").in("id", part),
        "Đọc companies",
      ) as Company[]);
      contacts.push(...must(
        await ctx.db.from("contacts").select("company_id, full_name, job_title, email, email_label, phone")
          .in("company_id", part).order("confidence", { ascending: false }),
        "Đọc contacts",
      ) as Contact[]);
      obs.push(...must(
        await ctx.db.from("latest_observations").select("company_id, signal_code, value_num, value_text")
          .in("company_id", part).in("signal_code", ["HAS_PHONE", "HAS_ZALO", "HAS_YOUTUBE", "HAS_TIKTOK"]),
        "Đọc observations",
      ) as Obs[]);
    }
    const byId = new Map(companies.map((c) => [c.id, c]));
    const obsText = (id: string, code: string) => {
      const o = obs.find((x) => x.company_id === id && x.signal_code === code && (x.value_num ?? 0) > 0);
      return o?.value_text ? o.value_text.split("\n").join("; ") : "";
    };

    const rows: Cell[][] = [];
    for (const id of ids) {
      const c = byId.get(id);
      if (!c) continue;
      const cs = contacts.filter((x) => x.company_id === id && !dnc.isEmail(x.email));
      const people = cs.filter((x) => x.full_name)
        .map((x) => [x.full_name, x.job_title && `(${x.job_title})`, x.email && `<${x.email}>`].filter(Boolean).join(" "));
      const emails = cs.filter((x) => x.email && x.email_label !== "invalid").map((x) => `${x.email} (${x.email_label})`);
      const signals = (c.score_breakdown?.signals ?? []).filter((s) => s.contribution > 0).map((s) => s.code);
      rows.push([
        c.name,
        c.domain,
        c.website_url,
        c.segment ? SEGMENT_VI[c.segment] ?? c.segment : "",
        c.city,
        c.status,
        c.score,
        signals.join(", "),
        people.join("; "),
        [...new Set(emails)].join("; "),
        obsText(id, "HAS_PHONE") || cs.map((x) => x.phone).filter(Boolean).join("; "),
        obsText(id, "HAS_ZALO"),
        obsText(id, "HAS_YOUTUBE"),
        obsText(id, "HAS_TIKTOK"),
      ]);
    }

    const bytes = format === "csv" ? toCsv(HEADER, rows) : toXlsx(HEADER, rows);
    for (const part of chunk(ids, 200)) {
      await ctx.db.from("companies").update({ last_exported_at: new Date().toISOString() }).in("id", part);
    }
    await finishRun(ctx.db, runId, "done", { rows: rows.length, format });
    await audit(ctx.db, ctx.userId, "export", { run_id: runId, filter, format, rows: rows.length });

    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const filename = `sync-leads-${stamp}.${format}`;
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Row-Count": String(rows.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    await finishRun(ctx.db, runId, "failed", {}, { error: (e as Error).message });
    if (e instanceof HttpError) throw e;
    return json({ error: "Export thất bại", code: "internal" }, 500);
  }
});
