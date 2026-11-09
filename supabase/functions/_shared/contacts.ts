// Tìm người liên hệ từ các trang đã đọc và ghi vào contacts (dùng chung cho profile và enrich_contact).
import { type Db, must } from "./db.ts";
import type { DncList } from "./dnc.ts";
import { extractEmails, extractPhones, type FoundValue, type PageData } from "./extract.ts";
import { mxStatus, type MxStatus } from "./mx.ts";
import { buildContacts, findDecisionMakers } from "./people.ts";
import { insertObservations } from "./signals.ts";

/** Trang cần cho việc tìm liên hệ. “team” chỉ lấy khi trang chủ có link (không đoán đường dẫn). */
export const CONTACT_KINDS = ["contact", "about", "team"] as const;

export type MxLookup = (domain: string) => Promise<MxStatus>;

/** Tra MX một lần cho mỗi domain trong cả lượt chạy. */
export function mxCache(): MxLookup {
  const cache = new Map<string, Promise<MxStatus>>();
  return (d) => {
    if (!cache.has(d)) cache.set(d, mxStatus(d));
    return cache.get(d)!;
  };
}

export interface SavedContacts {
  contacts: number;
  decisionMakers: number;
}

/**
 * Tìm người quyết định + email + điện thoại trên các trang, gắn nhãn email theo MX,
 * thay danh sách liên hệ tự động cũ (giữ liên hệ nhập tay) và ghi tín hiệu DECISION_MAKER_FOUND.
 */
export async function saveContacts(
  db: Db,
  c: { id: string; domain: string },
  pages: PageData[],
  homeUrl: string,
  opts: { dnc: DncList; confirmed: Set<string>; runId: string; mxOf: MxLookup },
): Promise<SavedContacts> {
  const { dnc, mxOf } = opts;
  const people = findDecisionMakers(pages);
  const emailMap = new Map<string, FoundValue>();
  for (const e of pages.flatMap(extractEmails)) {
    if (dnc.isEmail(e.value)) continue; // DNC email: không lưu
    const prev = emailMap.get(e.value);
    if (!prev || prev.confidence < e.confidence) emailMap.set(e.value, e);
  }
  const emails = [...emailMap.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  const phones = [...new Set(pages.flatMap(extractPhones).map((p) => p.value))].slice(0, 3);

  // MX cho mọi domain email liên quan (domain công ty + domain email công khai), tra song song.
  const domains = [...new Set([c.domain, ...emails.map((e) => e.value.split("@")[1])])];
  const statuses = await Promise.all(domains.map(mxOf));
  const mx = new Map(domains.map((d, i) => [d, statuses[i]]));

  const drafts = buildContacts(c.domain, people, emails, phones, (d) => mx.get(d) ?? "unknown")
    .filter((d) => !dnc.isEmail(d.email));

  must(await db.from("contacts").delete().eq("company_id", c.id).eq("source", "auto"), "Xoá contacts cũ");
  if (drafts.length) {
    must(
      await db.from("contacts").insert(drafts.map((d) => ({
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
  // Người tìm được ở nguồn khác (LinkedIn, nhập tay) vẫn tính, để đọc lại website không làm tụt tín hiệu.
  const { count: others, error: othersErr } = await db.from("contacts").select("id", { count: "exact", head: true })
    .eq("company_id", c.id).not("full_name", "is", null).in("source", ["linkedin", "manual"]);
  if (othersErr) throw new Error(`Đếm người liên hệ: ${othersErr.message}`);
  await insertObservations(db, c.id, [{
    code: "DECISION_MAKER_FOUND",
    value_num: people.length + (others ?? 0),
    value_text: people.map((p) => `${p.full_name} — ${p.job_title}`).join("\n") || null,
    confidence: people.length ? Math.max(...people.map((p) => p.confidence)) : 0.7,
    evidence_url: people[0]?.evidence_url ?? homeUrl,
  }], opts.confirmed, opts.runId);
  return { contacts: drafts.length, decisionMakers: people.length };
}
