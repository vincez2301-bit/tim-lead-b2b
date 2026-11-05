import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Segment } from "../lib/api-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg } from "../lib/format";
import { rememberFilter, rememberedFilter } from "../lib/settings";
import {
  CLOSED_STAGES,
  OPEN_STAGES,
  STAGE_LABEL,
  TOUCH_GOAL,
  dueState,
  fmtDay,
  fmtUsd,
  forecast,
  memberName,
  useMembers,
  type DealRow,
  type Stage,
  type Tier,
} from "../lib/pipeline";
import { Badge, EmptyState, Notice, PageHeader, Spinner } from "../components/ui";
import { DealPanel } from "../components/DealPanel";

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
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!s || r.company_name.toLowerCase().includes(s) || (r.domain ?? "").includes(s)) &&
        (!owner || (owner === "me" ? r.owner_id === session?.user.id : owner === "none" ? !r.owner_id : r.owner_id === owner)) &&
        (!segment || r.segment === segment) &&
        (!tier || r.tier === tier),
    );
  }, [rows, q, owner, segment, tier, session]);

  const fc = useMemo(() => forecast(filtered), [filtered]);
  const overdue = filtered.filter((r) => OPEN_STAGES.includes(r.stage) && dueState(r.next_action_at) === "overdue").length;
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
        description="Kéo thẻ sang cột khác để đổi giai đoạn. Bấm vào thẻ để đánh giá lead, ghi điểm chạm và cập nhật dự báo."
      />
      {error && <Notice kind="error">{error}</Notice>}
      <div className="grid kpis">
        <div className="card stat">
          <span className="stat-label">Commit (khách đã OK)</span>
          <span className="stat-value">{fmtUsd(fc.commit)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Forecast (ARR × xác suất)</span>
          <span className="stat-value">{fmtUsd(fc.weighted)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Best case (từ demo trở đi)</span>
          <span className="stat-value">{fmtUsd(fc.best)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Việc quá hạn</span>
          <span className={overdue ? "stat-value text-danger" : "stat-value"}>{overdue}</span>
        </div>
      </div>
      <div className="card filters">
        <div className="form-grid">
          <label>
            Tìm công ty
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên hoặc domain" />
          </label>
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
          <label>
            Nhóm khách
            <select value={segment} onChange={(e) => setSegment(e.target.value as Segment | "")}>
              <option value="">Tất cả</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABEL[s]}
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
        <label className="checkbox">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Hiện cột Thắng / Thua / Nuôi dưỡng
        </label>
      </div>

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState title="Pipeline đang trống">
            Thêm công ty từ trang Công ty (tích chọn → Thêm vào pipeline) hoặc admin nhập file ở mục Nhập dữ liệu.
          </EmptyState>
        </div>
      ) : (
        <div className="board">
          {columns.map((stage) => {
            const list = filtered.filter((r) => r.stage === stage);
            const arr = list.reduce((s, r) => s + (r.est_arr_usd ?? 0), 0);
            return (
              <div
                key={stage}
                className={dragOver === stage ? "column over" : "column"}
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
                    <DealCard key={r.id} r={r} owner={memberName(members, r.owner_id)} onOpen={() => open(r.id)} />
                  ))}
                  {list.length === 0 && <p className="small muted column-empty">Kéo thẻ vào đây</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {openId && <DealPanel dealId={openId} onClose={close} onChanged={() => void load()} />}
    </section>
  );
}

function DealCard({ r, owner, onOpen }: { r: DealRow; owner: string; onOpen: () => void }) {
  const due = dueState(r.next_action_at);
  const pct = Math.min(100, Math.round((100 * r.touches) / TOUCH_GOAL));
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
      {r.contract_end && (
        <div className="small muted">
          Hết HĐ {r.competitor ? `với ${r.competitor} ` : ""}: {fmtDay(r.contract_end)}
        </div>
      )}
      {r.next_action && (
        <div className={`due due-${due} small`}>
          {fmtDay(r.next_action_at)} · {r.next_action}
        </div>
      )}
      <div className="deal-foot">
        <span className="touch" title={`${r.touches}/${TOUCH_GOAL} điểm chạm`}>
          <span className="bar">
            <span style={{ width: `${pct}%` }} />
          </span>
          {r.touches}/{TOUCH_GOAL}
        </span>
        <span className="small muted">{r.est_arr_usd ? fmtUsd(r.est_arr_usd) : owner}</span>
      </div>
    </button>
  );
}
