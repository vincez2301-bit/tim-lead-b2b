// Từ khoá tự loại khi tìm công ty (vd. "event", "sự kiện"): khớp tên hoặc domain, không phân biệt dấu, hoa thường.

/** Bỏ dấu tiếng Việt, viết thường. */
export function foldVi(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/** Trả về hàm cho biết công ty khớp từ khoá loại trừ nào (null nếu không khớp). */
export function excludeMatcher(words: string[]): (name: string, domain: string | null) => string | null {
  const list = [...new Set(words.map((w) => foldVi(w).trim()).filter((w) => w.length >= 2))].slice(0, 100);
  if (!list.length) return () => null;
  return (name, domain) => {
    const hay = ` ${foldVi(name).replace(/[^a-z0-9]+/g, " ")} ${(domain ?? "").toLowerCase()} `;
    for (const w of list) {
      // Từ ngắn (≤ 4 ký tự) phải khớp nguyên từ để tránh loại nhầm (vd. "tv" trong "atv").
      const hit = w.length <= 4 ? hay.includes(` ${w} `) || hay.includes(` ${w}.`) : hay.includes(w);
      if (hit) return w;
    }
    return null;
  };
}
