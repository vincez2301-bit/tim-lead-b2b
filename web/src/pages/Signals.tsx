import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { callFn } from "../lib/api";
import type { ScoreResponse } from "../lib/api-types";
import type { SignalCode, SignalStatus } from "../lib/db-types";
import { HINT_SIGNALS, SIGNAL_STATUS_LABEL, errMsg, fmtDate } from "../lib/format";
import { Notice, PageHeader, SignalStatusBadge, Spinner, TableWrap } from "../components/ui";

const STATUSES: SignalStatus[] = ["proposed", "confirmed", "rejected"];

export function SignalsPage() {
  const { isAdmin } = useAuth();
  const [signals, setSignals] = useState<SignalCode[] | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("signal_codes").select("*").order("sort_order").order("code");
    if (error) setError(error.message);
    const list = (data ?? []) as SignalCode[];
    setSignals(list);
    setWeights(Object.fromEntries(list.map((s) => [s.code, String(s.default_weight)])));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(code: string, status: SignalStatus) {
    setBusy(code);
    setError(null);
    setInfo(null);
    const { error } = await supabase.from("signal_codes").update({ status }).eq("code", code);
    if (error) setError(error.message);
    else setInfo(`${code}: đã chuyển sang "${SIGNAL_STATUS_LABEL[status]}". Bấm "Tính lại điểm" để áp dụng.`);
    await load();
    setBusy(null);
  }

  async function saveWeight(code: string) {
    const w = Number(weights[code]);
    if (!Number.isFinite(w) || Math.abs(w) > 1000) {
      setError(`Trọng số của ${code} không hợp lệ.`);
      return;
    }
    setBusy(code);
    setError(null);
    setInfo(null);
    const { error } = await supabase.from("signal_codes").update({ default_weight: w }).eq("code", code);
    if (error) setError(error.message);
    else setInfo(`${code}: đã lưu trọng số ${w}. Bấm "Tính lại điểm" để áp dụng.`);
    await load();
    setBusy(null);
  }

  async function rescoreAll() {
    setBusy("__all");
    setError(null);
    setInfo(null);
    try {
      const r = await callFn<ScoreResponse>("score", { company_ids: "all" });
      setInfo(`Đã tính lại điểm cho ${r.updated} công ty.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  if (!signals) return <Spinner />;
  const confirmedCount = signals.filter((s) => s.status === "confirmed").length;

  return (
    <section>
      <PageHeader
        title="Tín hiệu"
        description={
          <>
            Pipeline chỉ thu thập tín hiệu <strong>Đã xác nhận</strong> ({confirmedCount}/{signals.length}). Chỉ admin được
            duyệt và chỉnh trọng số. Trọng số âm (ví dụ NO_WEBSITE) trừ điểm nhưng không tính vào mẫu số.
          </>
        }
        actions={
          <button type="button" disabled={busy !== null} onClick={() => void rescoreAll()}>
            {busy === "__all" ? "Đang tính…" : "Tính lại điểm tất cả công ty"}
          </button>
        }
      />
      {!isAdmin && <Notice kind="info">Bạn đang xem ở chế độ chỉ đọc.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {info && <Notice kind="ok">{info}</Notice>}
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Mô tả / dữ liệu thu thập</th>
              <th>Nguồn</th>
              <th>Chi phí</th>
              <th className="num">Trọng số</th>
              <th>Trạng thái</th>
              <th>Duyệt lúc</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.code}>
                <td>
                  <code>{s.code}</code>
                </td>
                <td>
                  {s.description}
                  {HINT_SIGNALS.has(s.code) && (
                    <div className="small muted">Chỉ là dấu hiệu đã cài pixel — không chứng minh đang chạy quảng cáo.</div>
                  )}
                </td>
                <td>{s.source}</td>
                <td className="small">{s.cost_note ?? "—"}</td>
                <td className="num">
                  {isAdmin ? (
                    <div className="row nowrap">
                      <input
                        className="input-sm"
                        type="number"
                        step="1"
                        value={weights[s.code] ?? ""}
                        onChange={(e) => setWeights((w) => ({ ...w, [s.code]: e.target.value }))}
                        aria-label={`Trọng số ${s.code}`}
                      />
                      {weights[s.code] !== String(s.default_weight) && (
                        <button type="button" disabled={busy === s.code} onClick={() => void saveWeight(s.code)}>
                          Lưu
                        </button>
                      )}
                    </div>
                  ) : (
                    s.default_weight
                  )}
                </td>
                <td>
                  {isAdmin ? (
                    <select
                      value={s.status}
                      disabled={busy === s.code}
                      onChange={(e) => void setStatus(s.code, e.target.value as SignalStatus)}
                      aria-label={`Trạng thái ${s.code}`}
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {SIGNAL_STATUS_LABEL[st]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <SignalStatusBadge status={s.status} />
                  )}
                </td>
                <td className="small">{fmtDate(s.confirmed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </section>
  );
}
