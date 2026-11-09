import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Columns3, List } from "lucide-react";
import { useSearchParams } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Segment } from "../lib/api-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg } from "../lib/format";
import { rememberFilter, rememberedFilter, useSettings } from "../lib/settings";
import {
  CLOSED_STAGES,
  OPEN_STAGES,
  STAGE_LABEL,
  outreachSteps,
  progressText,
  dueState,
  fmtDay,
  fmtUsd,
  forecast,
  memberName,
  useMembers,
  type DealRow,
  type Stage,
  type Tier,
  RENEWAL_WINDOW_DAYS,
  addDays,
  todayIso,
  foldVi,
  staleDays,
  CHANNEL_LABEL,
  PHASES,
  PHASE_HINT,
  PHASE_LABEL,
  getCadence,
  leadRank,
  nextMove,
  phaseOf,
  type CadenceStep,
  type Phase,
} from "../lib/pipeline";
import { Badge, EmptyState, Notice, PageHeader, Spinner, TableWrap } from "../components/ui";
import { DealPanel } from "../components/DealPanel";
import { DisqualifyDialog } from "../components/Disqualify";

export function PipelinePage() {
  const { session } = useAuth();
  const members = useMembers();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState(() => rememberedFilter("pipeline.owner"));
  const [segment, setSegment] = useState<Segment | "">("");
  const [tier, setTier] = useState<Tier | "">("");
  const [showClosed, setShowClosed] = useState(false);
  const [view, setView] = useState<"list" | "board">(() => (rememberedFilter("pipeline.view") === "board" ? "board" : "list"));
  useEffect(() => rememberFilter("pipeline.view", view === "board" ? "board" : ""), [view]);
  const [phase, setPhase] = useState<Phase | "">("");
  const [disq, setDisq] = useState<{ id: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { settings } = useSettings();
  const cadence = getCadence(settings);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const openId = params.get("deal");

  useEffect(() => rememberFilter("pipeline.owner", owner), [owner]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("deal_board")
      .select("*")
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .limit(2000);
    if (error) setError(error.message);
    setRows((data ?? []) as DealRow[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = foldVi(q.trim());
    return (rows ?? []).filter(
      (r) =>
        (!s || foldVi(r.company_name).includes(s) || (r.domain ?? "").includes(s)) &&
        (!owner || (owner === "me" ? r.owner_id === session?.user.id : owner === "none" ? !r.owner_id : r.owner_id === owner)) &&
        (!segment || r.segment === segment) &&
        (!tier || r.tier === tier),
    );
  }, [rows, q, owner, segment, tier, session]);

  const fc = useMemo(() => forecast(filtered), [filtered]);
  const overdue = filtered.filter((r) => OPEN_STAGES.includes(r.stage) && dueState(r.next_action_at) === "overdue").length;
  const renewLimit = addDays(todayIso(), RENEWAL_WINDOW_DAYS);
  const renewing = filtered.filter((r) => r.stage === "won" && r.renewal_at && r.renewal_at <= renewLimit);
  const columns = showClosed ? [...OPEN_STAGES, ...CLOSED_STAGES] : OPEN_STAGES;

  async function moveTo(id: string, stage: Stage) {
    const prev = rows;
    setRows((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, stage } : r)));
    const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
    if (error) {
      setError(errMsg(error));
      setRows(prev);
    } else void load();
  }

  function onDrop(e: DragEvent, stage: Stage) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/deal");
    const row = rows?.find((r) => r.id === id);
    if (row && row.stage !== stage) void moveTo(id, stage);
  }

  const open = (id: string) => setParams((p) => {
    p.set("deal", id);
    return p;
  });
  const close = useCallback(() => setParams((p) => {
    p.delete("deal");
    return p;
  }), [setParams]);

  return (
    <section className="wide">
      <PageHeader
        title="Pipeline"
        description="Mỗi khách có một việc tiếp theo. Bấm “Làm” để mở nội dung soạn sẵn; làm xong, app tự hẹn bước kế tiếp."
      />
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="ok">{notice}</Notice>}
      <div className="row space-between view-bar">
        <div className="seg" role="group" aria-label="Kiểu xem">
          <button type="button" className={view === "list" ? "on" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}>
            <List aria-hidden="true" /> Việc tiếp theo
          </button>
          <button type="button" className={view === "board" ? "on" : ""} aria-pressed={view === "board"} onClick={() => setView("board")}>
            <Columns3 aria-hidden="true" /> Bảng kéo thả
          </button>
        </div>
        <div className="row small muted kpi-inline">
          <span>
            Quá hạn <strong className={overdue ? "text-danger" : ""}>{overdue}</strong>
          </span>
          <span>
            Đang trao đổi <strong>{filtered.filter((r) => phaseOf(r.stage) === "talking").length}</strong> · dự báo {fmtUsd(fc.weighted)}
          </span>
          <span>
            Đã ký <strong>{filtered.filter((r) => r.stage === "won").length}</strong> · {fmtUsd(fc.won)}
          </span>
          <span>
            Gia hạn {RENEWAL_WINDOW_DAYS} ngày <strong className={renewing.length ? "text-warn" : ""}>{renewing.length}</strong>
          </span>
        </div>
      </div>
      <div className="card filters">
        {view === "list" && (
          <div className="chips phase-chips" role="group" aria-label="Giai đoạn">
            <button type="button" className={phase === "" ? "chip on" : "chip"} onClick={() => setPhase("")}>
              Tất cả <span className="chip-count">{filtered.length}</span>
            </button>
            {PHASES.map((ph) => (
              <button key={ph} type="button" className={phase === ph ? "chip on" : "chip"} title={PHASE_HINT[ph]} onClick={() => setPhase(ph)}>
                {PHASE_LABEL[ph]} <span className="chip-count">{filtered.filter((r) => phaseOf(r.stage) === ph).length}</span>
              </button>
            ))}
          </div>
        )}
        <div className="form-grid">
          <label>
            Tìm công ty
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên hoặc domain (gõ không dấu cũng được)" />
          </label>
          {members.length > 1 && (
            <label>
              Người phụ trách
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Cả nhóm</option>
                <option value="me">Của tôi</option>
                <option value="none">Chưa giao</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.email}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Nhóm khách
            <select value={segment} onChange={(e) => setSegment(e.target.value as Segment | "")}>
              <option value="">Tất cả</option>
              {SEGMENTS.map((sg) => (
                <option key={sg} value={sg}>
                  {SEGMENT_LABEL[sg]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hạng
            <select value={tier} onChange={(e) => setTier(e.target.value as Tier | "")}>
              <option value="">Tất cả</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>
        </div>
        {view === "board" && (
          <label className="checkbox">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Hiện cột Thắng / Thua / Nuôi dưỡng
          </label>
        )}
      </div>
      {phase && view === "list" && <p className="small muted phase-hint">{PHASE_HINT[phase]}</p>}

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState title="Pipeline đang trống">
            Thêm công ty từ trang Công ty (tích chọn → Thêm vào pipeline) hoặc admin nhập file ở mục Nhập dữ liệu.
          </EmptyState>
        </div>
      ) : view === "list" ? (
        <NextList
          rows={filtered.filter((r) => !phase || phaseOf(r.stage) === phase)}
          cadence={cadence}
          onOpen={open}
          onDisqualify={(r) => setDisq({ id: r.company_id, name: r.company_name })}
        />
      ) : (
        <div className="board">
          {columns.map((stage) => {
            const list = filtered.filter((r) => r.stage === stage);
            const arr = list.reduce((s, r) => s + (r.est_arr_usd ?? 0), 0);
            return (
              <div
                key={stage}
                className={dragOver === stage ? "column over" : "column"}
                data-stage={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage);
                }}
                onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
                onDrop={(e) => onDrop(e, stage)}
              >
                <div className="column-head">
                  <strong>{STAGE_LABEL[stage]}</strong>
                  <span className="count">{list.length}</span>
                  {arr > 0 && <span className="small muted">{fmtUsd(arr)}</span>}
                </div>
                <div className="column-body">
                  {list.map((r) => (
                    <DealCard key={r.id} r={r} owner={memberName(members, r.owner_id)} goal={outreachSteps(cadence).length} onOpen={() => open(r.id)} />
                  ))}
                  {list.length === 0 && <p className="small muted column-empty">Kéo thẻ vào đây</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {openId && <DealPanel dealId={openId} onClose={close} onChanged={() => void load()} />}
      {disq && (
        <DisqualifyDialog
          companies={[disq]}
          onClose={() => setDisq(null)}
          onDone={(msg) => {
            setDisq(null);
            setNotice(msg);
            void load();
          }}
        />
      )}
    </section>
  );
}

function DealCard({ r, owner, goal, onOpen }: { r: DealRow; owner: string; goal: number; onOpen: () => void }) {
  const due = dueState(r.next_action_at);
  const outreach = r.stage === "new" || r.stage === "research" || r.stage === "outreach";
  const pct = outreach ? Math.min(100, Math.round((100 * (r.outreach_emails ?? 0)) / Math.max(1, goal))) : 100;
  const stale = staleDays(r);
  return (
    <button
      type="button"
      className="deal-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/deal", r.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
    >
      <div className="row space-between nowrap">
        <strong className="deal-name">{r.company_name}</strong>
        {r.tier && <span className={`tier tier-${r.tier}`}>{r.tier}</span>}
      </div>
      <div className="row small muted">
        {r.segment ? SEGMENT_LABEL[r.segment] : "Chưa phân nhóm"}
        {r.city ? ` · ${r.city}` : ""}
        {r.is_dnc && <Badge tone="red">DNC</Badge>}
      </div>
      {r.stage === "won" && r.signed_at && (
        <div className="small won-date">
          Ký {fmtDay(r.signed_at)}
          {r.effective_at ? ` · hiệu lực ${fmtDay(r.effective_at)}` : ""}
        </div>
      )}
      {r.stage === "won" && r.renewal_at && (
        <div className={`small due due-${r.renewal_at < todayIso() ? "overdue" : r.renewal_at <= addDays(todayIso(), RENEWAL_WINDOW_DAYS) ? "today" : "later"}`}>
          Gia hạn {fmtDay(r.renewal_at)}
        </div>
      )}
      {stale !== null && <Badge tone="orange">Đứng yên {stale} ngày</Badge>}
      {r.contract_end && (
        <div className="small muted">
          Hết HĐ {r.competitor ? `với ${r.competitor} ` : ""}: {fmtDay(r.contract_end)}
        </div>
      )}
      {r.next_action && !["new", "research"].includes(r.stage) && (
        <div className={`due due-${due} small`}>
          {r.next_action_at ? `${fmtDay(r.next_action_at)} · ` : ""}
          {r.next_action}
        </div>
      )}
      <div className="deal-foot">
        <span className="touch" title={outreach ? `${r.outreach_emails ?? 0}/${goal} email` : `${r.touches} điểm chạm`}>
          <span className="bar">
            <span style={{ width: `${pct}%` }} />
          </span>
          {outreach ? `${r.outreach_emails ?? 0}/${goal}` : r.touches}
        </span>
        <span className="small muted">{r.est_arr_usd ? fmtUsd(r.est_arr_usd) : owner}</span>
      </div>
    </button>
  );
}

const PHASE_TONE: Record<Phase, string> = { start: "gray", outreach: "blue", talking: "orange", won: "green", paused: "gray" };

/** Danh sách khách xếp theo việc cần làm: quá hạn / hôm nay → sắp tới → lead mới chờ tới lượt → còn lại. */
function NextList({
  rows,
  cadence,
  onOpen,
  onDisqualify,
}: {
  rows: DealRow[];
  cadence: CadenceStep[];
  onOpen: (id: string) => void;
  onDisqualify: (r: DealRow) => void;
}) {
  const t = todayIso();
  const items = rows
    .map((r) => ({ r, m: nextMove(r, cadence), ph: phaseOf(r.stage) }))
    .sort((a, b) => {
      const order = (x: typeof a) => (x.r.stage === "lost" ? 4 : x.m.due && x.m.due <= t ? 0 : x.m.due ? 1 : x.ph === "start" ? 2 : 3);
      return order(a) - order(b) || (a.m.due ?? "").localeCompare(b.m.due ?? "") || leadRank(a.r) - leadRank(b.r);
    });
  if (!items.length) {
    return (
      <div className="card">
        <EmptyState title="Không có khách nào trong nhóm này." />
      </div>
    );
  }
  return (
    <TableWrap>
      <table className="next-list">
        <thead>
          <tr>
            <th>Khách</th>
            <th>Giai đoạn</th>
            <th>Việc tiếp theo</th>
            <th>Hạn</th>
            <th aria-label="Hành động"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ r, m, ph }) => {
            const st = dueState(m.due);
            const urgent = st === "overdue" || st === "today";
            return (
              <tr key={r.id} className="clickable" onClick={() => onOpen(r.id)}>
                <td>
                  <div className="row nowrap">
                    <span className={`tier tier-${r.tier ?? "none"}`}>{r.tier ?? "?"}</span>
                    <div>
                      <strong>{r.company_name}</strong>
                      <div className="small muted">
                        {r.segment ? SEGMENT_LABEL[r.segment] : "Chưa phân nhóm"}
                        {r.city ? ` · ${r.city}` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge tone={PHASE_TONE[ph]}>{PHASE_LABEL[ph]}</Badge>
                  <div className="small muted">{progressText(r, cadence)}</div>
                </td>
                <td>
                  <strong className="next-title">{m.title}</strong>
                  <div className="small muted">
                    {m.channel ? CHANNEL_LABEL[m.channel] : ""}
                    {m.step ? ` · bước ${m.step}` : ""}
                  </div>
                </td>
                <td className="small">
                  {m.due ? (
                    <span className={`due due-${st}`}>{fmtDay(m.due)}</span>
                  ) : (
                    <span className="muted">{ph === "start" ? "Chờ tới lượt" : "—"}</span>
                  )}
                </td>
                <td>
                  {r.stage !== "lost" && (
                    <button
                      type="button"
                      className={urgent ? "btn-primary btn-sm" : "btn-sm"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r.id);
                      }}
                    >
                      {ph === "start" ? "Gửi email" : "Làm"}
                    </button>
                  )}
                  {ph === "start" && (
                    <button
                      type="button"
                      className="btn-link small danger"
                      title="Không phù hợp — loại khỏi pipeline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDisqualify(r);
                      }}
                    >
                      Loại
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}
