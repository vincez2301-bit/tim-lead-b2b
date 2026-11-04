import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { callFn, runBatched } from "../lib/api";
import type { EnrichYoutubeResponse, RunStatus } from "../lib/api-types";
import type { AuditRow, Profile, Run, Step } from "../lib/db-types";
import { RUN_STATUS_LABEL, STEPS, STEP_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { getBatchSize, useSettings } from "../lib/settings";
import { JsonText, Notice, PageHeader, RunStatusBadge, Spinner, TableWrap } from "../components/ui";

const RUN_STATUSES: RunStatus[] = ["running", "done", "failed", "partial"];

function statsSummary(s: Record<string, unknown> | null): string {
  if (!s) return "";
  return Object.entries(s)
    .filter(([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

export function LogsPage() {
  const { isAdmin, session } = useAuth();
  const { settings } = useSettings();
  const [step, setStep] = useState<Step | "">("");
  const [status, setStatus] = useState<RunStatus | "">("");
  const [owner, setOwner] = useState("");
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [resumeMsg, setResumeMsg] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [action, setAction] = useState("");
  const [auditUser, setAuditUser] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .then(({ data }) => setProfiles(new Map(((data ?? []) as Profile[]).map((p) => [p.user_id, p]))));
  }, []);

  const loadRuns = useCallback(async () => {
    let qb = supabase.from("runs").select("*").order("started_at", { ascending: false }).limit(200);
    if (step) qb = qb.eq("step", step);
    if (status) qb = qb.eq("status", status);
    if (owner) qb = qb.eq("owner_id", owner);
    const { data, error } = await qb;
    if (error) setError(error.message);
    setRuns((data ?? []) as Run[]);
  }, [step, status, owner]);

  const loadAudit = useCallback(async () => {
    if (!isAdmin) return;
    let qb = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (action) qb = qb.eq("action", action);
    if (auditUser) qb = qb.eq("user_id", auditUser);
    const { data, error } = await qb;
    if (error) setError(error.message);
    setAudit((data ?? []) as AuditRow[]);
  }, [isAdmin, action, auditUser]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);
  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const actions = useMemo(() => {
    const base = [
      "export",
      "forget_subject",
      "purge_stale_leads",
      "signal_codes.update",
      "settings.update",
      "do_not_contact.insert",
      "do_not_contact.delete",
      "profiles.update",
    ];
    for (const a of audit ?? []) if (!base.includes(a.action)) base.push(a.action);
    return base.sort();
  }, [audit]);

  const who = (id: string | null) => (id ? (profiles.get(id)?.email ?? id.slice(0, 8)) : "hệ thống");

  // Tiếp tục run enrich_youtube đã dừng vì hết quota (mục 4.3).
  async function resume(r: Run) {
    setResuming(r.id);
    setResumeMsg(null);
    try {
      const res = await callFn<EnrichYoutubeResponse>("enrich_youtube", { resume_run_id: r.id });
      let text = `Đã xử lý ${res.processed} công ty, ${res.channels} kênh, ${res.units_used} đơn vị quota.`;
      let kind: "ok" | "warn" = "ok";
      if (res.stopped_reason === "quota") {
        text += " Vẫn hết quota — thử lại sau khi quota đặt lại.";
        kind = "warn";
      } else if (res.remaining_ids.length > 0) {
        const more = await runBatched<EnrichYoutubeResponse>("enrich_youtube", res.remaining_ids, getBatchSize(settings));
        text += ` Tiếp tục thêm ${more.done}/${more.total} công ty.`;
        if (more.error) {
          text += ` Lỗi: ${more.error}`;
          kind = "warn";
        } else if (more.stoppedReason === "quota") {
          text += " Hết quota giữa chừng.";
          kind = "warn";
        }
      }
      setResumeMsg({ kind, text });
    } catch (e) {
      setResumeMsg({ kind: "error", text: errMsg(e) });
    } finally {
      setResuming(null);
      await loadRuns();
    }
  }

  return (
    <section>
      <PageHeader title="Nhật ký" description="Các lượt chạy pipeline và thao tác quan trọng (audit log)." />
      {error && <Notice kind="error">{error}</Notice>}
      <div className="card">
        <h2>Lượt chạy pipeline</h2>
        <div className="form-grid">
          <label>
            Bước
            <select value={step} onChange={(e) => setStep(e.target.value as Step | "")}>
              <option value="">Tất cả</option>
              {STEPS.map((s) => (
                <option key={s} value={s}>
                  {STEP_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value as RunStatus | "")}>
              <option value="">Tất cả</option>
              {RUN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RUN_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          {isAdmin && (
            <label>
              Người chạy
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Tất cả</option>
                {[...profiles.values()].map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.email ?? p.user_id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {resumeMsg && <Notice kind={resumeMsg.kind}>{resumeMsg.text}</Notice>}
        {!runs ? (
          <Spinner />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                  <th>Bước</th>
                  <th>Trạng thái</th>
                  {isAdmin && <th>Người chạy</th>}
                  <th className="num">API (dùng/ước tính)</th>
                  <th>Kết quả</th>
                  <th>Lỗi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      Không có lượt chạy.
                    </td>
                  </tr>
                )}
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="small">{fmtDate(r.started_at)}</td>
                    <td className="small">{fmtDate(r.finished_at)}</td>
                    <td>{STEP_LABEL[r.step] ?? r.step}</td>
                    <td>
                      <RunStatusBadge status={r.status} />
                    </td>
                    {isAdmin && <td className="small">{who(r.owner_id)}</td>}
                    <td className="num">
                      {fmtNum(r.api_units_used)}
                      {r.api_units_estimated !== null ? `/${fmtNum(r.api_units_estimated)}` : ""}
                      {r.provider ? <span className="small muted"> {r.provider}</span> : null}
                    </td>
                    <td className="small">
                      {statsSummary(r.stats)}
                      {(r.stats !== null || r.input != null) && (
                        <button type="button" className="btn-link" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                          {expanded === r.id ? "Ẩn" : "Chi tiết"}
                        </button>
                      )}
                      {expanded === r.id && <JsonText value={{ input: r.input, stats: r.stats, progress: r.progress }} />}
                    </td>
                    <td className="small pre-wrap">{r.error ?? ""}</td>
                    <td>
                      {r.step === "enrich_youtube" && r.status === "partial" && (isAdmin || r.owner_id === session?.user.id) && (
                        <button type="button" disabled={resuming !== null} onClick={() => void resume(r)}>
                          {resuming === r.id ? "Đang chạy…" : "Tiếp tục"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>

      {isAdmin && (
        <div className="card">
          <h2>Audit log</h2>
          <div className="form-grid">
            <label>
              Hành động
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">Tất cả</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Người dùng
              <select value={auditUser} onChange={(e) => setAuditUser(e.target.value)}>
                <option value="">Tất cả</option>
                {[...profiles.values()].map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.email ?? p.user_id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!audit ? (
            <Spinner />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Người dùng</th>
                    <th>Hành động</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Trống.
                      </td>
                    </tr>
                  )}
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="small">{fmtDate(a.created_at)}</td>
                      <td className="small">{who(a.user_id)}</td>
                      <td>
                        <code>{a.action}</code>
                      </td>
                      <td>
                        <details>
                          <summary className="small">Xem</summary>
                          <JsonText value={a.detail} />
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      )}
    </section>
  );
}
