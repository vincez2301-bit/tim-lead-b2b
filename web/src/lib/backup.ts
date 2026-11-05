// Sao lưu dữ liệu bán hàng ra file trên máy người dùng (JSON đầy đủ, CSV mở bằng Excel).
import { supabase } from "./supabase";
import { STAGE_LABEL, type DealRow } from "./pipeline";
import { SEGMENT_LABEL } from "./format";

const PAGE = 1000;

async function all(table: string, columns = "*"): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

function download(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Toàn bộ dữ liệu bán hàng và cấu hình, đủ để dựng lại nếu database mất. Trả về số dòng. */
export async function downloadBackup(): Promise<number> {
  const tables: Record<string, unknown[]> = {};
  for (const t of ["deals", "activities", "contacts", "companies", "settings", "do_not_contact"]) {
    tables[t] = await all(t);
  }
  const rows = Object.values(tables).reduce((n, x) => n + x.length, 0);
  download(
    JSON.stringify({ app: "bigfish-lead-finder", version: 1, exported_at: new Date().toISOString(), tables }, null, 1),
    "application/json",
    `bigfish-sao-luu-${stamp()}.json`,
  );
  return rows;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Bảng pipeline dạng CSV có BOM để Excel đọc đúng dấu tiếng Việt. */
export async function downloadPipelineCsv(): Promise<number> {
  const deals = (await all("deal_board")) as DealRow[];
  const head = [
    "Công ty", "Website", "Nhóm khách", "Thành phố", "Giai đoạn", "Hạng", "Điểm chạm", "Việc tiếp theo", "Hạn",
    "ARR (USD)", "Ngày ký", "Ngày hiệu lực", "Ngày gia hạn", "Lý do từ chối", "Nhà cung cấp hiện tại", "Hết HĐ của họ",
    "Nguồn", "Ghi chú",
  ];
  const lines = deals.map((d) =>
    [
      d.company_name, d.website_url ?? d.domain, d.segment ? SEGMENT_LABEL[d.segment] : "", d.city, STAGE_LABEL[d.stage],
      d.tier, d.touches, d.next_action, d.next_action_at, d.est_arr_usd, d.signed_at, d.effective_at, d.renewal_at,
      d.lost_reason_code, d.competitor, d.contract_end, d.source, d.notes,
    ].map(csvCell).join(","),
  );
  download("﻿" + [head.join(","), ...lines].join("\r\n"), "text/csv;charset=utf-8", `bigfish-pipeline-${stamp()}.csv`);
  return deals.length;
}
