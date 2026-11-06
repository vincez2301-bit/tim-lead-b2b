// Trang in báo giá: mở ở tab mới, bấm “In / Lưu PDF” rồi chọn “Lưu dưới dạng PDF”.
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { supabase } from "../lib/supabase";
import { useSettings } from "../lib/settings";
import { getSender } from "../lib/pipeline";
import { fmtDate, fmtMoney, quoteTotals, vndInWords, type Quote } from "../lib/quotes";
import { Notice, Spinner } from "../components/ui";

export function QuotePrintPage() {
  const { id } = useParams();
  const { settings } = useSettings();
  const sender = getSender(settings);
  const [q, setQ] = useState<Quote | null>(null);
  const [company, setCompany] = useState<{ company_name: string; city: string | null; domain: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await supabase.from("quotes").select("*").eq("id", id ?? "").maybeSingle();
      if (r.error || !r.data) return setError(r.error?.message ?? "Không tìm thấy báo giá.");
      const quote = r.data as Quote;
      setQ(quote);
      const d = await supabase.from("deal_board").select("company_name,city,domain").eq("id", quote.deal_id).maybeSingle();
      if (d.data) setCompany(d.data as typeof company);
    })();
  }, [id]);

  // Tên file PDF lấy theo tiêu đề trang.
  useEffect(() => {
    if (q && company) document.title = `${q.number} ${company.company_name}`;
  }, [q, company]);

  if (error) return <main className="content"><Notice kind="error">{error}</Notice></main>;
  if (!q || !company) return <main className="content"><Spinner /></main>;
  const t = quoteTotals(q.items, q.discount_pct, q.currency);

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          In / Lưu PDF
        </button>
        <span className="small muted">Trong hộp thoại in, chọn máy in “Lưu dưới dạng PDF” (Save as PDF).</span>
      </div>
      <article className="quote-doc">
        <header className="quote-head">
          <div>
            <div className="quote-from">{sender.company || "Epidemic Sound tại Việt Nam"}</div>
            {sender.name && (
              <div>
                {sender.name}
                {sender.title ? ` · ${sender.title}` : ""}
              </div>
            )}
            <div className="muted">{[sender.email, sender.phone].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="quote-meta">
            <h1>BÁO GIÁ</h1>
            <div>Số: {q.number}</div>
            <div>Ngày: {fmtDate(q.created_at)}</div>
            <div>
              Hiệu lực đến: <strong>{fmtDate(q.valid_until)}</strong>
            </div>
          </div>
        </header>

        <section className="quote-to">
          <div>
            Kính gửi: <strong>{company.company_name}</strong>
          </div>
          {q.contact_name && <div>Người nhận: {q.contact_name}</div>}
          {(company.city || company.domain) && <div className="muted">{[company.city, company.domain].filter(Boolean).join(" · ")}</div>}
        </section>

        <div className="quote-table-wrap">
        <table className="quote-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Hạng mục</th>
              <th className="num">Số lượng</th>
              <th className="num">Đơn giá</th>
              <th className="num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <strong>{l.name}</strong>
                  {l.detail && <div className="muted">{l.detail}</div>}
                </td>
                <td className="num">{l.qty.toLocaleString("vi-VN")}</td>
                <td className="num">
                  {fmtMoney(l.unit_price, q.currency)}
                  {l.unit ? `/${l.unit}` : ""}
                </td>
                <td className="num">{fmtMoney(l.qty * l.unit_price, q.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {q.discount_pct > 0 && (
              <>
                <tr>
                  <td colSpan={4}>Tạm tính</td>
                  <td className="num">{fmtMoney(t.subtotal, q.currency)}</td>
                </tr>
                <tr>
                  <td colSpan={4}>Ưu đãi giảm {q.discount_pct}%</td>
                  <td className="num">−{fmtMoney(t.subtotal - q.total, q.currency)}</td>
                </tr>
              </>
            )}
            <tr className="grand">
              <td colSpan={4}>Tổng cộng (chưa gồm thuế, nếu có)</td>
              <td className="num">{fmtMoney(q.total, q.currency)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
        {q.currency === "VND" && <p className="quote-words">Bằng chữ: {vndInWords(q.total)}.</p>}

        {q.terms && (
          <section>
            <h2>Điều khoản</h2>
            <p className="pre-wrap">{q.terms}</p>
          </section>
        )}

        <footer className="quote-sign">
          <div>
            <div>Người lập báo giá</div>
            <div className="sign-space" />
            <strong>{sender.name || " "}</strong>
            {sender.title && <div>{sender.title}</div>}
          </div>
        </footer>
      </article>
    </div>
  );
}
