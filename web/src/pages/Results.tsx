import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { SEGMENTS, SEGMENT_LABEL } from "../lib/format";
import { CHANNEL_LABEL, addDays, phaseOf, todayIso, type Activity, type Channel, type DealRow } from "../lib/pipeline";
import { EmptyState, Notice, PageHeader, Spinner, TableWrap } from "../components/ui";

type Act = Pick<Activity, "deal_id" | "channel" | "outcome" | "happened_at">;
const PERIODS = [7, 30, 90] as const;
const BUCKETS = ["Sau 1 điểm chạm", "Sau 2–3 điểm chạm", "Sau 4–6 điểm chạm", "Sau 7–12 điểm chạm", "Sau hơn 12 điểm chạm"];
const isReply = (a: Act) => a.outcome === "replied" || a.outcome === "positive";
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const vnDay = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Thứ Hai đầu tuần của một ngày (YYYY-MM-DD). */
function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function ResultsPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [acts, setActs] = useState<Act[] | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [a, d] = await Promise.all([
        supabase.from("activities").select("deal_id, channel, outcome, happened_at").order("happened_at").limit(20000),
        supabase.from("deal_board").select("*").limit(5000),
      ]);
      if (a.error || d.error) setError((a.error ?? d.error)!.message);
      setActs((a.data ?? []) as Act[]);
      setDeals((d.data ?? []) as DealRow[]);
    })();
  }, []);

  const r = useMemo(() => {
    if (!acts) return null;
    const today = todayIso();
    const since = addDays(today, -days + 1);
    const dealById = new Map(deals.map((d) => [d.id, d]));
    const inPeriod = acts.filter((a) => vnDay(a.happened_at) >= since);

    // Điểm chạm đầu tiên của mỗi khách = email mở lời (hoặc kênh đầu tiên).
    const byDeal = new Map<string, Act[]>();
    for (const a of acts) byDeal.set(a.deal_id, [...(byDeal.get(a.deal_id) ?? []), a]);
    const firstTouch = new Map<string, Act>();
    for (const [id, list] of byDeal) firstTouch.set(id, list[0]);
    const started = [...firstTouch.entries()].filter(([, a]) => vnDay(a.happened_at) >= since).map(([id]) => id);

    const contacted = new Set(inPeriod.map((a) => a.deal_id));
    const replied = new Set(inPeriod.filter(isReply).map((a) => a.deal_id));
    const won = deals.filter((d) => d.stage === "won" && d.signed_at && d.signed_at >= since).length;
    const talking = deals.filter((d) => phaseOf(d.stage) === "talking" && d.stage_changed_at && vnDay(d.stage_changed_at) >= since).length;

    // Trả lời sau bao nhiêu điểm chạm (tính trên mọi khách có trả lời trong kỳ).
    const afterTouches = new Map<string, number>();
    for (const id of replied) {
      const list = byDeal.get(id) ?? [];
      const firstReply = list.findIndex(isReply);
      const n = Math.max(0, firstReply);
      const bucket = n <= 1 ? "Sau 1 điểm chạm" : n <= 3 ? "Sau 2–3 điểm chạm" : n <= 6 ? "Sau 4–6 điểm chạm" : n <= 12 ? "Sau 7–12 điểm chạm" : "Sau hơn 12 điểm chạm";
      afterTouches.set(bucket, (afterTouches.get(bucket) ?? 0) + 1);
    }

    const bySegment = SEGMENTS.map((sg) => {
      const c = [...contacted].filter((id) => dealById.get(id)?.segment === sg).length;
      const rp = [...replied].filter((id) => dealById.get(id)?.segment === sg).length;
      return { key: sg, label: SEGMENT_LABEL[sg], contacted: c, replied: rp };
    }).filter((x) => x.contacted > 0);

    const channels = [...new Set(inPeriod.map((a) => a.channel))] as Channel[];
    const byChannel = channels
      .map((ch) => ({
        ch,
        touches: inPeriod.filter((a) => a.channel === ch).length,
        replies: inPeriod.filter((a) => a.channel === ch && isReply(a)).length,
      }))
      .sort((a, b) => b.touches - a.touches);

    const weeks: { start: string; touches: number; started: number; replies: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = weekStart(addDays(today, -7 * i));
      const end = addDays(start, 6);
      const inWeek = (iso: string) => vnDay(iso) >= start && vnDay(iso) <= end;
      weeks.push({
        start,
        touches: acts.filter((a) => inWeek(a.happened_at)).length,
        started: [...firstTouch.values()].filter((a) => inWeek(a.happened_at)).length,
        replies: new Set(acts.filter((a) => isReply(a) && inWeek(a.happened_at)).map((a) => a.deal_id)).size,
      });
    }

    return { touches: inPeriod.length, started: started.length, contacted: contacted.size, replied: replied.size, won, talking, afterTouches, bySegment, byChannel, weeks };
  }, [acts, deals, days]);

  return (
    <section>
      <PageHeader
        title="Kết quả tiếp cận"
        description="Bạn đã liên hệ bao nhiêu khách, bao nhiêu khách trả lời, và cách nào hiệu quả nhất. Số liệu lấy từ các điểm chạm đã ghi trong app."
        actions={
          <div className="seg" role="group" aria-label="Khoảng thời gian">
            {PERIODS.map((p) => (
              <button key={p} type="button" className={days === p ? "on" : ""} aria-pressed={days === p} onClick={() => setDays(p)}>
                {p} ngày
              </button>
            ))}
          </div>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {!r ? (
        <Spinner />
      ) : acts!.length === 0 ? (
        <div className="card">
          <EmptyState title="Chưa có điểm chạm nào được ghi.">
            Gửi email mở lời ở trang Hôm nay và bấm “✓ Đã gửi”; khi khách trả lời, mở khách đó và bấm “Khách đã trả lời”.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid kpis">
            <div className="card stat">
              <span className="stat-label">Khách mới bắt đầu tiếp cận</span>
              <span className="stat-value">{r.started}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Điểm chạm đã làm</span>
              <span className="stat-value">{r.touches}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Khách trả lời</span>
              <span className="stat-value">
                {r.replied} <span className="small muted">/ {r.contacted} khách đã liên hệ</span>
              </span>
            </div>
            <div className="card stat">
              <span className="stat-label">Tỷ lệ trả lời</span>
              <span className="stat-value">{pct(r.replied, r.contacted)}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Sang Đang trao đổi · Đã ký</span>
              <span className="stat-value">
                {r.talking} · {r.won}
              </span>
            </div>
          </div>
          <p className="small muted">
            Khách trả lời chỉ được tính khi bạn bấm “Khách đã trả lời” (hoặc ghi điểm chạm với kết quả “Đã phản hồi”). Nhớ bấm mỗi khi khách hồi
            âm để số liệu đúng.
          </p>

          <div className="grid two">
            <div className="card">
              <h2>Theo nhóm khách</h2>
              {r.bySegment.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu trong khoảng này." />
              ) : (
                <TableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th>Nhóm</th>
                        <th className="num">Đã liên hệ</th>
                        <th className="num">Trả lời</th>
                        <th className="num">Tỷ lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.bySegment.map((x) => (
                        <tr key={x.key}>
                          <td>{x.label}</td>
                          <td className="num">{x.contacted}</td>
                          <td className="num">{x.replied}</td>
                          <td className="num">
                            <strong>{pct(x.replied, x.contacted)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </div>
            <div className="card">
              <h2>Theo kênh</h2>
              {r.byChannel.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu trong khoảng này." />
              ) : (
                <TableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th>Kênh</th>
                        <th className="num">Điểm chạm</th>
                        <th className="num">Khách trả lời qua kênh này</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.byChannel.map((x) => (
                        <tr key={x.ch}>
                          <td>{CHANNEL_LABEL[x.ch]}</td>
                          <td className="num">{x.touches}</td>
                          <td className="num">{x.replies}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </div>
          </div>

          <div className="grid two">
            <div className="card">
              <h2>Khách trả lời sau bao nhiêu lần liên hệ</h2>
              <p className="small muted">Cho biết có nên kiên trì đủ lịch 19 điểm chạm hay không.</p>
              {r.afterTouches.size === 0 ? (
                <EmptyState title="Chưa có khách trả lời trong khoảng này." />
              ) : (
                <ul className="plain">
                  {[...r.afterTouches.entries()].sort((a, b) => BUCKETS.indexOf(a[0]) - BUCKETS.indexOf(b[0])).map(([k, v]) => (
                    <li key={k}>
                      {k}: <strong>{v}</strong> khách
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <h2>8 tuần gần đây</h2>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Tuần từ</th>
                      <th className="num">Khách mới</th>
                      <th className="num">Điểm chạm</th>
                      <th className="num">Khách trả lời</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.weeks.map((w) => (
                      <tr key={w.start}>
                        <td>{w.start.slice(8, 10)}/{w.start.slice(5, 7)}</td>
                        <td className="num">{w.started}</td>
                        <td className="num">{w.touches}</td>
                        <td className="num">{w.replies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
