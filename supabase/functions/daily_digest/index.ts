// daily_digest — email nhắc việc mỗi sáng.
// - pg_cron gọi mỗi giờ (không có JWT): chỉ gửi khi đã bật, đã tới giờ hẹn (giờ Việt Nam) và hôm nay chưa gửi
//   (khoá bằng một dòng digest_log). Gọi thêm từ ngoài cũng không gửi trùng và không trả về nội dung.
// - Admin bấm “Gửi thử” (có JWT, body.test = true): gửi ngay tới người nhận đã lưu (hoặc email của admin),
//   không ghi log.
import { HttpError, json, serve } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { type Db, must, serviceClient } from "../_shared/db.ts";
import {
  addDays,
  buildDigest,
  type DigestDeal,
  digestSubject,
  parseDigestConfig,
  RENEWAL_WINDOW_DAYS,
  renderDigest,
  vnNow,
} from "../_shared/digest.ts";

const COLUMNS =
  "id, company_name, segment, city, stage, tier, score, next_action, next_action_at, renewal_at, est_arr_usd, cadence_started_at";

async function loadDeals(db: Db, today: string): Promise<DigestDeal[]> {
  const open = must(
    await db.from("deal_board").select(COLUMNS)
      .in("stage", ["new", "research", "outreach", "connected", "meeting", "proposal", "commit", "nurture"]).limit(5000),
    "Đọc pipeline",
  ) as DigestDeal[];
  const won = must(
    await db.from("deal_board").select(COLUMNS).eq("stage", "won").not("renewal_at", "is", null)
      .lte("renewal_at", addDays(today, RENEWAL_WINDOW_DAYS)),
    "Đọc khách đã ký",
  ) as DigestDeal[];
  return [...open, ...won];
}

async function sendEmail(to: string[], subject: string, html: string, text: string): Promise<string> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    throw new HttpError(500, "Chưa cấu hình RESEND_API_KEY cho Edge Function (Supabase → Edge Functions → Secrets)", "not_configured");
  }
  const from = Deno.env.get("DIGEST_FROM") || "Bigfish Lead Finder <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({})) as { id?: string; message?: string };
  if (!res.ok) throw new HttpError(502, `Resend từ chối gửi (${res.status}): ${body.message ?? "không rõ lý do"}`, "upstream_error");
  return body.id ?? "";
}

async function adminEmails(db: Db): Promise<string[]> {
  const rows = must(await db.from("profiles").select("email").eq("role", "admin"), "Đọc admin") as { email: string | null }[];
  return rows.map((r) => r.email).filter((e): e is string => !!e).slice(0, 5);
}

serve(async (req, body) => {
  const db = serviceClient();
  const settingRows = must(await db.from("settings").select("key, value").in("key", ["daily_digest", "sender"]), "Đọc cài đặt") as {
    key: string;
    value: unknown;
  }[];
  const get = (k: string) => settingRows.find((r) => r.key === k)?.value;
  const senderName = String((get("sender") as { name?: unknown } | undefined)?.name ?? "").trim();
  const cfg = parseDigestConfig(get("daily_digest"), senderName);
  const { day, hour } = vnNow(new Date());

  if (body.test === true) {
    const ctx = await requireAdmin(req);
    if (!ctx.email) throw new HttpError(400, "Tài khoản admin chưa có email", "bad_request");
    const to = cfg.recipients.length ? cfg.recipients : [ctx.email];
    const digest = buildDigest(await loadDeals(db, day), day, cfg.newPerDay);
    const { html, text } = renderDigest(digest, cfg);
    const id = await sendEmail(to, `[Thử] ${digestSubject(digest)}`, html, text);
    return json({ status: "sent", to, id });
  }

  if (!cfg.enabled) return json({ status: "disabled" });
  if (hour < cfg.hour) return json({ status: "too_early" });
  const recipients = cfg.recipients.length ? cfg.recipients : await adminEmails(db);
  if (!recipients.length) return json({ status: "no_recipient" });

  // Khoá gửi trong ngày: chèn được dòng log thì mới gửi.
  const claim = await db.from("digest_log").insert({ day, recipients, tasks: 0 }).select("day");
  if (claim.error) {
    if (claim.error.code === "23505") return json({ status: "already_sent" });
    throw new Error(`Ghi digest_log: ${claim.error.message}`);
  }
  try {
    const digest = buildDigest(await loadDeals(db, day), day, cfg.newPerDay);
    const { html, text } = renderDigest(digest, cfg);
    await sendEmail(recipients, digestSubject(digest), html, text);
    await db.from("digest_log").update({ tasks: digest.due.length + digest.newLeads.length }).eq("day", day);
    return json({ status: "sent" });
  } catch (e) {
    // Gửi lỗi → bỏ khoá để giờ sau thử lại.
    await db.from("digest_log").delete().eq("day", day);
    throw e;
  }
});
