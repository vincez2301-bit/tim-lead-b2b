import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { supabase } from "../lib/supabase";
import { callFn, runBatched, type BatchFn } from "../lib/api";
import type { EnrichContactResponse, FindPeopleResponse, ProfileResponse, ScoreResponse } from "../lib/api-types";
import { SOURCE_LABEL, getContactRoles, rankContacts } from "../lib/contacts";
import { useSettings } from "../lib/settings";
import type { Company, Contact, Observation, SignalCode } from "../lib/db-types";
import { HINT_SIGNALS, SEGMENT_LABEL, STEP_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { Badge, EmailLabelBadge, Notice, PageHeader, ScorePill, Spinner, StatusBadge, TableWrap } from "../components/ui";
import { SafeLink, shortUrl } from "../components/SafeLink";

type Action = BatchFn | "score";

export function CompanyDetailPage() {
  const { id = "" } = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const { settings } = useSettings();
  const [signals, setSignals] = useState<Map<string, SignalCode>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [actionMsg, setActionMsg] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [dealId, setDealId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    void supabase
      .from("deals")
      .select("id")
      .eq("company_id", id)
      .maybeSingle()
      .then(({ data }) => setDealId((data as { id: string } | null)?.id ?? null));
  }, [id]);
  async function addDeal() {
    if (!id) return;
    const { data, error } = await supabase.from("deals").insert({ company_id: id, stage: "new" }).select("id").single();
    if (error) setActionMsg({ kind: "error", text: error.message });
    else setDealId((data as { id: string }).id);
  }

  const load = useCallback(async () => {
    const [c, o, ct, s] = await Promise.all([
      supabase.from("company_list").select("*").eq("id", id).maybeSingle(),
      supabase.from("observations").select("*").eq("company_id", id).order("observed_at", { ascending: false }).order("id", { ascending: false }).limit(500),
      supabase.from("contacts").select("*").eq("company_id", id).order("created_at"),
      supabase.from("signal_codes").select("*"),
    ]);
    const err = c.error ?? o.error ?? ct.error ?? s.error;
    setError(err ? err.message : null);
    setCompany((c.data as Company | null) ?? null);
    setObservations((o.data ?? []) as Observation[]);
    setContacts((ct.data ?? []) as Contact[]);
    setSignals(new Map(((s.data ?? []) as SignalCode[]).map((x) => [x.code, x])));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Observation mới nhất của mỗi tín hiệu (danh sách đã sắp theo thời gian giảm dần).
  const latestIds = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<number>();
    for (const o of observations) {
      if (!seen.has(o.signal_code)) {
        seen.add(o.signal_code);
        ids.add(o.id);
      }
    }
    return ids;
  }, [observations]);
  // Cùng thứ tự với khung khách: người đúng vai trò có email lên đầu, email tuyển dụng / CSKH xuống cuối (mờ).
  const { sortedContacts, hiddenIds } = useMemo(() => {
    const r = rankContacts(contacts, company?.segment ?? null, getContactRoles(settings));
    return { sortedContacts: [...r.shown, ...r.hidden], hiddenIds: new Set(r.hidden.map((c) => c.id)) };
  }, [contacts, company?.segment, settings]);
  const shownObs = showHistory ? observations : observations.filter((o) => latestIds.has(o.id));

  async function act(a: Action) {
    setBusy(a);
    setActionMsg(null);
    try {
      if (a === "score") {
        const r = await callFn<ScoreResponse>("score", { company_ids: [id] });
        setActionMsg({ kind: "ok", text: `Đã tính lại điểm (${r.updated}).` });
      } else if (a === "find_people") {
        const r = await callFn<FindPeopleResponse>("find_people", { company_ids: [id], force: true });
        setActionMsg(
          r.stopped_reason === "quota"
            ? { kind: "warn", text: "Đã hết lượt Google hôm nay — thử lại ngày mai." }
            : r.skipped_not_in_pipeline
              ? { kind: "warn", text: "Chỉ tìm cho công ty đang trong pipeline — đưa công ty vào Pipeline trước." }
              : {
                  kind: "ok",
                  text: `Tìm người phụ trách: ${r.people} người qua LinkedIn, ${r.emails} email thật, ${r.guessed} email đoán theo mẫu (dùng ${r.units_used} lượt Google).`,
                },
        );
        await load();
      } else {
        const r = await runBatched<EnrichContactResponse & ProfileResponse>(a, [id], 1);
        const found = r.responses[0];
        if (r.error) setActionMsg({ kind: "error", text: r.error });
        else if (found && a !== "enrich_youtube" && typeof found.contacts === "number")
          setActionMsg({
            kind: "ok",
            text: `${STEP_LABEL[a]}: xong — ${found.contacts} liên hệ${found.decision_makers ? `, ${found.decision_makers} người quyết định` : ""}.`,
          });
        else if (r.stoppedReason === "quota")
          setActionMsg({ kind: "warn", text: "Hết quota YouTube hôm nay — tiếp tục từ Nhật ký sau khi quota đặt lại." });
        else if (r.stoppedReason === "stalled")
          setActionMsg({ kind: "warn", text: `${STEP_LABEL[a]}: server không xử lý được công ty này (hết thời gian).` });
        else setActionMsg({ kind: "ok", text: `${STEP_LABEL[a]}: xong.` });
      }
    } catch (e) {
      setActionMsg({ kind: "error", text: errMsg(e) });
    } finally {
      setBusy(null);
      await load();
    }
  }

  if (loading) return <Spinner />;
  if (!company)
    return (
      <section>
        {error && <Notice kind="error">{error}</Notice>}
        <p>Không tìm thấy công ty.</p>
        <Link to="/companies">← Quay lại danh sách</Link>
      </section>
    );

  const bd = company.score_breakdown;

  return (
    <section>
      <p className="small">
        <Link to="/companies">← Danh sách công ty</Link>
      </p>
      <PageHeader
        title={
          <span className="row">
            {company.name} {company.is_dnc && <Badge tone="red">DNC</Badge>}
          </span>
        }
        description={[company.city, company.domain].filter(Boolean).join(" · ") || undefined}
        actions={
          <span className="row">
            <span className="muted small">Điểm</span>
            <ScorePill score={company.score} />
            {dealId ? (
              <Link className="btn" to={`/pipeline?deal=${dealId}`}>
                Mở trong pipeline
              </Link>
            ) : dealId === null && !company.is_dnc ? (
              <button type="button" className="btn-primary" onClick={() => void addDeal()}>
                Thêm vào pipeline
              </button>
            ) : null}
          </span>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {company.is_dnc && (
        <Notice kind="warn">Công ty thuộc danh sách loại trừ (DNC) — không liên hệ, không export.</Notice>
      )}

      <div className="card">
        <dl className="kv">
          <dt>Website</dt>
          <dd>
            {company.domain ? (
              <SafeLink href={company.website_url ?? `https://${company.domain}/`}>{company.website_url ?? company.domain}</SafeLink>
            ) : (
              "Không có"
            )}
          </dd>
          <dt>Nhóm</dt>
          <dd>{company.segment ? SEGMENT_LABEL[company.segment] : "—"}</dd>
          <dt>Thành phố</dt>
          <dd>{company.city ?? "—"}</dd>
          <dt>Trạng thái</dt>
          <dd>
            <StatusBadge status={company.status} />
          </dd>
          <dt>Nguồn</dt>
          <dd>{company.source ?? "—"}</dd>
          <dt>Thấy lần đầu / cuối</dt>
          <dd>
            {fmtDate(company.first_seen_at)} / {fmtDate(company.last_seen_at)}
          </dd>
          <dt>Đọc website</dt>
          <dd>{fmtDate(company.profiled_at)}</dd>
          <dt>YouTube / liên hệ</dt>
          <dd>
            {fmtDate(company.youtube_enriched_at)} / {fmtDate(company.contacts_enriched_at)}
          </dd>
        </dl>
        <div className="row wrap">
          {(["profile", "enrich_youtube", "enrich_contact", "find_people", "score"] as Action[]).map((a) => (
            <button key={a} type="button" disabled={busy !== null || !!company.is_dnc} onClick={() => void act(a)}>
              {busy === a ? "Đang chạy…" : a === "score" ? "Tính lại điểm" : STEP_LABEL[a]}
            </button>
          ))}
        </div>
        {busy && busy !== "score" && (
          <p className="small muted">
            {busy === "enrich_youtube"
              ? "Đang tìm kênh YouTube…"
              : busy === "find_people"
                ? "Đang tìm trên LinkedIn công khai và email của công ty trên Google (2 lượt Google)…"
              : "Đang đọc trang chủ, Liên hệ, Giới thiệu của website (thường 5–10 giây; app nghỉ giữa các trang để không làm phiền website của khách)…"}
          </p>
        )}
        {actionMsg && <Notice kind={actionMsg.kind}>{actionMsg.text}</Notice>}
      </div>

      <div className="card">
        <h2>Vì sao điểm này?</h2>
        {!bd ? (
          <p className="muted">Chưa chấm điểm.</p>
        ) : (
          <>
            <p className="small muted">
              Điểm = 100 × Σ(trọng số × độ mạnh × độ tin cậy) / Σ trọng số dương = 100 × {fmtNum(bd.raw, 2)} /{" "}
              {fmtNum(bd.max, 2)}. Tính lúc {fmtDate(bd.computed_at)}.
            </p>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Tín hiệu</th>
                    <th className="num">Giá trị</th>
                    <th className="num">Trọng số</th>
                    <th className="num">Độ mạnh</th>
                    <th className="num">Tin cậy</th>
                    <th className="num">Đóng góp</th>
                    <th>Bằng chứng</th>
                  </tr>
                </thead>
                <tbody>
                  {bd.signals.length === 0 && (
                    <tr>
                      <td colSpan={7} className="muted">
                        Chưa có tín hiệu nào.
                      </td>
                    </tr>
                  )}
                  {bd.signals.map((s) => (
                    <tr key={s.code}>
                      <td>
                        <code>{s.code}</code>
                        {HINT_SIGNALS.has(s.code) && <span className="small muted"> (dấu hiệu)</span>}
                      </td>
                      <td className="num">{fmtNum(s.value_num, 2)}</td>
                      <td className="num">{fmtNum(s.weight, 2)}</td>
                      <td className="num">{fmtNum(s.strength, 2)}</td>
                      <td className="num">{fmtNum(s.confidence, 2)}</td>
                      <td className="num">{fmtNum(s.contribution, 2)}</td>
                      <td>
                        <SafeLink href={s.evidence_url}>{shortUrl(s.evidence_url, 40)}</SafeLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </div>

      <div className="card">
        <h2>Người liên hệ</h2>
        {contacts.length === 0 ? (
          <p className="muted">Chưa có liên hệ. Chạy "{STEP_LABEL.enrich_contact}".</p>
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Chức danh</th>
                  <th>Email</th>
                  <th>Nhãn</th>
                  <th>SĐT</th>
                  <th className="num">Tin cậy</th>
                  <th>Nguồn</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {sortedContacts.map((c) => (
                  <tr key={c.id} className={hiddenIds.has(c.id) ? "muted" : undefined}>
                    <td>{c.full_name ?? "—"}</td>
                    <td>{c.job_title ?? "—"}</td>
                    <td>{c.email ?? "—"}</td>
                    <td>
                      <EmailLabelBadge label={c.email_label} />
                    </td>
                    <td>{c.phone ?? "—"}</td>
                    <td className="num">{fmtNum(c.confidence, 2)}</td>
                    <td>
                      {SOURCE_LABEL[c.source] ?? c.source}
                      {c.evidence_url && (
                        <>
                          {" · "}
                          <SafeLink href={c.evidence_url}>{shortUrl(c.evidence_url, 36)}</SafeLink>
                        </>
                      )}
                    </td>
                    <td className="small">{hiddenIds.has(c.id) ? "Ẩn khi gửi (tuyển dụng / CSKH)" : (c.note ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>

      <div className="card">
        <div className="row space-between">
          <h2>Observation</h2>
          <label className="checkbox">
            <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
            Hiện cả lịch sử ({observations.length})
          </label>
        </div>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Tín hiệu</th>
                <th className="num">value_num</th>
                <th>value_text</th>
                <th className="num">Tin cậy</th>
                <th>Bằng chứng</th>
                <th>Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {shownObs.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Chưa có observation.
                  </td>
                </tr>
              )}
              {shownObs.map((o) => (
                <tr key={o.id} className={latestIds.has(o.id) ? "" : "dim"}>
                  <td title={signals.get(o.signal_code)?.description}>
                    <code>{o.signal_code}</code>
                  </td>
                  <td className="num">{fmtNum(o.value_num, 2)}</td>
                  <td className="small pre-wrap">{o.value_text ?? ""}</td>
                  <td className="num">{fmtNum(o.confidence, 2)}</td>
                  <td>
                    <SafeLink href={o.evidence_url}>{shortUrl(o.evidence_url, 40)}</SafeLink>
                  </td>
                  <td className="small">{fmtDate(o.observed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </section>
  );
}
