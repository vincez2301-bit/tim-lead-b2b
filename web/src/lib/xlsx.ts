// Đọc file Excel (.xlsx) ngay trong trình duyệt, không cần thư viện ngoài:
// .xlsx là file zip chứa XML → giải nén bằng DecompressionStream("deflate-raw"), đọc XML bằng DOMParser.
// Chỉ lấy giá trị ô dạng chữ (đủ cho danh sách lead); không đọc công thức, định dạng, ảnh.

export interface Sheet {
  name: string;
  rows: string[][];
}

const MAX_ENTRY_BYTES = 50 * 1024 * 1024; // chặn file zip “bom” khi giải nén

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

function readEntries(buf: ArrayBuffer): Map<string, ZipEntry> {
  const v = new DataView(buf);
  // Tìm End Of Central Directory (chữ ký 0x06054b50) từ cuối file.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65_535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("File không phải .xlsx hợp lệ (không đọc được cấu trúc zip).");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, ZipEntry>();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("File .xlsx bị hỏng (central directory).");
    const method = v.getUint16(p + 10, true);
    const compressedSize = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out.set(name, { name, method, compressedSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  if (e.size > MAX_ENTRY_BYTES) throw new Error(`Phần ${e.name} trong file quá lớn.`);
  const v = new DataView(buf);
  const nameLen = v.getUint16(e.offset + 26, true);
  const extraLen = v.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, e.compressedSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error(`Không hỗ trợ kiểu nén ${e.method} trong file .xlsx.`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_ENTRY_BYTES) {
      await reader.cancel();
      throw new Error(`Phần ${e.name} trong file quá lớn khi giải nén.`);
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return new TextDecoder().decode(all);
}

const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const byTag = (d: Document | Element, tag: string) => Array.from(d.getElementsByTagNameNS("*", tag));

/** "C12" → cột 2 (0-based). */
function colIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function textOf(el: Element): string {
  // Chuỗi có định dạng (rich text) chia thành nhiều <t>; bỏ phần phiên âm <rPh>.
  return byTag(el, "t")
    .filter((t) => (t.parentElement?.localName ?? "") !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");
}

export async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const entries = readEntries(buf);
  const get = async (path: string) => {
    const e = entries.get(path);
    return e ? readEntry(buf, e) : null;
  };
  const wbXml = await get("xl/workbook.xml");
  if (!wbXml) throw new Error("File không phải .xlsx (thiếu xl/workbook.xml). File .xls cũ: mở bằng Excel rồi lưu lại dạng .xlsx.");
  const relsXml = await get("xl/_rels/workbook.xml.rels");
  const rels = new Map<string, string>();
  if (relsXml) {
    for (const r of byTag(xml(relsXml), "Relationship")) {
      const target = r.getAttribute("Target") ?? "";
      rels.set(r.getAttribute("Id") ?? "", target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`);
    }
  }
  const sstXml = await get("xl/sharedStrings.xml");
  const shared = sstXml ? byTag(xml(sstXml), "si").map(textOf) : [];

  const sheets: Sheet[] = [];
  const wb = xml(wbXml);
  for (const [i, s] of byTag(wb, "sheet").entries()) {
    const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? s.getAttribute("r:id") ?? "";
    const path = rels.get(rid) ?? `xl/worksheets/sheet${i + 1}.xml`;
    const sheetXml = await get(path);
    if (!sheetXml) continue;
    const rows: string[][] = [];
    for (const row of byTag(xml(sheetXml), "row")) {
      const r = Number(row.getAttribute("r") ?? rows.length + 1) - 1;
      if (r < 0 || r > 100_000) continue;
      const cells: string[] = [];
      for (const c of byTag(row, "c")) {
        const ref = c.getAttribute("r");
        const ci = ref ? colIndex(ref) : cells.length;
        if (ci < 0 || ci > 200) continue;
        const t = c.getAttribute("t");
        const vEl = byTag(c, "v")[0];
        let val = "";
        if (t === "s") val = shared[Number(vEl?.textContent ?? -1)] ?? "";
        else if (t === "inlineStr") val = textOf(c);
        else if (t === "b") val = vEl?.textContent === "1" ? "TRUE" : "FALSE";
        else val = vEl?.textContent ?? "";
        cells[ci] = val.trim();
      }
      rows[r] = Array.from(cells, (x) => x ?? "");
    }
    sheets.push({ name: s.getAttribute("name") ?? `Sheet${i + 1}`, rows: Array.from(rows, (x) => x ?? []) });
  }
  if (!sheets.length) throw new Error("Không đọc được trang tính nào trong file.");
  return sheets;
}
