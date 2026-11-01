// Chỉ ghi observation cho tín hiệu đã 'confirmed' (mục 5). Trigger DB vẫn là lớp chặn cuối.
import { type Db, must } from "./db.ts";
import type { Finding } from "./extract.ts";

export async function confirmedSignals(db: Db): Promise<Set<string>> {
  const rows = must(
    await db.from("signal_codes").select("code").eq("status", "confirmed"),
    "Đọc signal_codes",
  ) as { code: string }[];
  return new Set(rows.map((r) => r.code));
}

export async function insertObservations(
  db: Db,
  companyId: string,
  findings: Finding[],
  confirmed: Set<string>,
  runId: string | null,
): Promise<number> {
  const rows = findings
    .filter((f) => confirmed.has(f.code) && /^https?:\/\//i.test(f.evidence_url))
    .map((f) => ({
      company_id: companyId,
      signal_code: f.code,
      value_num: f.value_num,
      value_text: f.value_text ? String(f.value_text).slice(0, 2000) : null,
      confidence: Math.max(0, Math.min(1, Math.round(f.confidence * 100) / 100)),
      evidence_url: f.evidence_url.slice(0, 2000),
      run_id: runId,
    }));
  if (!rows.length) return 0;
  must(await db.from("observations").insert(rows), "Ghi observations");
  return rows.length;
}

export async function recomputeScores(db: Db, ids: string[] | null): Promise<number> {
  const { data, error } = await db.rpc("recompute_scores", { p_ids: ids });
  if (error) throw new Error(`recompute_scores: ${error.message}`);
  return (data as number) ?? 0;
}
