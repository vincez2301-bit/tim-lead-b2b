// find_website — tìm website chính thức cho công ty chưa có domain (vd. nhập từ danh sách tên):
// Google Search (Serper) → so tên với domain / tiêu đề; không thấy thì thử Google Maps (lấy cả số điện thoại).
// Mỗi công ty tốn 1–2 lượt Serper; công ty đã có domain được bỏ qua, không tốn lượt.
import { HttpError, json, pool, serve, uuidList } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { must } from "../_shared/db.ts";
import { loadSettings } from "../_shared/settings.ts";
import { refund, reserve } from "../_shared/quota.ts";
import { assertConcurrency, audit, finishRun, startRun } from "../_shared/runs.ts";
import { serperCall, SerperError } from "../_shared/serper.ts";
import { loadDnc } from "../_shared/dnc.ts";
import { formatVnPhone, normalizeVnPhone } from "../_shared/extract.ts";
import { kgAddress, kgPhone, pickFromMaps, pickFromSearch } from "../_shared/website_match.ts";
import { cityFromText } from "../_shared/city.ts";
import type { FindWebsiteResponse } from "../_shared/types.ts";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  city: string | null;
  status: string;
}

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const settings = await loadSettings(ctx.db);
  const ids = uuidList(body.company_ids, settings.limits.max_companies_per_batch);
  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) throw new HttpError(500, "Chưa cấu hình SERPER_API_KEY cho Edge Function", "not_configured");
  await assertConcurrency(ctx, settings.limits.max_concurrent_runs_per_user);

  const [companiesRes, dnc] = await Promise.all([
    ctx.db.from("companies").select("id, name, domain, city, status").in("id", ids),
    loadDnc(ctx.db),
  ]);
  const all = must(companiesRes, "Đọc companies") as Company[];
  const todo = all.filter((c) => !c.domain && c.status !== "archived");
  const region = settings.regions[0];
  const runId = await startRun(ctx, "find_website", { company_ids: ids }, {
    provider: "serper",
    api_units_estimated: todo.length,
  });

  let found = 0, phones = 0, cities = 0, unitsUsed = 0;
  let stopped: "quota" | null = null;
  const notFound: string[] = [];
  const conflicts: { name: string; domain: string }[] = [];
  const remaining: string[] = [];
  const errors: string[] = [];

  /** Một lượt Serper có giữ chỗ hạn mức; null = hết hạn mức. */
  const call = async (kind: "search" | "maps", q: string) => {
    if (stopped || !(await reserve(ctx.db, runId, ctx.userId, "serper", 1))) {
      stopped = "quota";
      return null;
    }
    try {
      const res = await serperCall(kind, { q, gl: region?.gl ?? "vn", hl: region?.hl ?? "vi", page: 1 }, apiKey);
      unitsUsed++;
      return res;
    } catch (e) {
      await refund(ctx.db, runId, ctx.userId, "serper", 1);
      throw e;
    }
  };

  await pool(todo, 3, async (c) => {
    if (stopped) {
      remaining.push(c.id);
      return;
    }
    try {
      const q = [c.name, c.city].filter(Boolean).join(" ");
      const search = await call("search", q);
      if (!search) {
        remaining.push(c.id);
        return;
      }
      let pick = pickFromSearch(c.name, search, settings.aggregator_blocklist);
      let phone = kgPhone(search);
      let address = kgAddress(search);
      let mapsUrl: string | null = null;
      if (!pick) {
        // Không thấy website: thử Google Maps (thêm 1 lượt), lấy cả số điện thoại nếu có.
        const maps = await call("maps", q);
        const place = maps ? pickFromMaps(c.name, maps, settings.aggregator_blocklist) : null;
        if (place) {
          if (!pick && place.domain) pick = { domain: place.domain, website_url: place.website_url!, score: 0.6, via: "maps" };
          phone ??= place.phone;
          address ??= place.address;
          mapsUrl = place.maps_url;
        }
      }
      if (pick && dnc.isDomain(pick.domain)) pick = null;
      const city = c.city ? null : cityFromText(address, region);

      if (pick) {
        const taken = must(
          await ctx.db.from("companies").select("id, name").eq("domain", pick.domain).neq("id", c.id).limit(1),
          "Kiểm tra domain",
        ) as { id: string; name: string }[];
        if (taken.length) {
          conflicts.push({ name: c.name, domain: `${pick.domain} (đã thuộc ${taken[0].name})` });
          pick = null;
        } else {
          must(
            await ctx.db.from("companies").update({ domain: pick.domain, website_url: pick.website_url, ...(city ? { city } : {}) })
              .eq("id", c.id),
            "Ghi website",
          );
          found++;
          if (city) cities++;
        }
      }
      if (!pick) {
        notFound.push(c.name);
        // Không có website nhưng Google Maps có địa chỉ: vẫn điền thành phố (trùng tên + thành phố với công ty khác thì bỏ qua).
        if (city) {
          const { error } = await ctx.db.from("companies").update({ city }).eq("id", c.id);
          if (!error) cities++;
        }
      }

      const norm = phone ? normalizeVnPhone(phone) : null;
      if (norm) {
        const shown = formatVnPhone(norm);
        const exists = must(
          await ctx.db.from("contacts").select("id").eq("company_id", c.id).eq("phone", shown).limit(1),
          "Kiểm tra số điện thoại",
        ) as unknown[];
        if (!exists.length) {
          must(
            await ctx.db.from("contacts").insert({
              company_id: c.id,
              job_title: "Số điện thoại công ty (Google)",
              phone: shown,
              confidence: 0.8,
              source: "google",
              evidence_url: mapsUrl ?? `https://www.google.com/search?q=${encodeURIComponent(q)}`,
            }),
            "Ghi số điện thoại",
          );
          phones++;
        }
      }
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof SerperError ? e.message : (e as Error).message}`.slice(0, 300));
    }
  });

  const stats = {
    checked: todo.length,
    found,
    phones,
    cities,
    not_found: notFound.slice(0, 50),
    conflicts: conflicts.slice(0, 50),
    units_used: unitsUsed,
    errors: errors.slice(0, 30),
  };
  await finishRun(ctx.db, runId, remaining.length ? "partial" : errors.length && !found ? "failed" : "done", stats, {
    progress: remaining.length ? { remaining_ids: remaining } : null,
    error: errors.length ? `${errors.length} công ty lỗi (xem stats.errors)` : null,
  });
  await audit(ctx.db, ctx.userId, "run.find_website", { run_id: runId, companies: ids.length, found, units_used: unitsUsed });

  const res: FindWebsiteResponse = {
    run_id: runId,
    checked: todo.length,
    found,
    phones,
    cities,
    not_found: notFound,
    conflicts: conflicts.map((x) => `${x.name}: ${x.domain}`),
    units_used: unitsUsed,
    remaining_ids: remaining,
    stopped_reason: stopped,
  };
  return json(res);
});
