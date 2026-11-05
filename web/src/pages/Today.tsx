import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { SEGMENT_LABEL } from "../lib/format";
import { rememberFilter, rememberedFilter } from "../lib/settings";
import {
  OPEN_STAGES,
  SEGMENT_PRIORITY,
  STAGE_LABEL,
  TOUCH_GOAL,
  addDays,
  dueState,
  fmtDay,
  todayIso,
  type DealRow,
} from "../lib/pipeline";
import { Badge, EmptyState, Notice, PageHeader, ScorePill, Spinner } from "../components/ui";
import { DealPanel } from "../components/DealPanel";

const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
const rank = (r: DealRow) =>
  (TIER_RANK[r.tier ?? ""] ?? 3) * 100 - (r.segment ? SEGMENT_PRIORITY[r.segment] : 0) - (r.score ?? 0) / 10;

export function TodayPage() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(() => rememberedFilter("today.mine") === "1");
  useEffect(() => rememberFilter("today.mine", mine ? "1" : ""), [mine]);
  const openId = params.get("deal");
  const tab = (params.get("tab") as "qualify" | "touches" | null) ?? undefined;

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("deal_board").select("*").in("stage", [...OPEN_STAGES, "nurture"]).limit(3000);
    if (error) setError(error.message);
    setRows((data ?? []) as DealRow[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const scoped = useMemo(
    () => (rows ?? []).filter((r) => !mine || r.owner_id === session?.user.id || (!r.owner_id && r.created_by === session?.user.id)),
    [rows, mine, session],
  );
  const t = todayIso();
  const due = scoped
    .filter((r) => !["new", "research"].includes(r.stage) && r.next_action_at && r.next_action_at <= t)
    .sort((a, b) => (a.next_action_at! < b.next_action_at! ? -1 : a.next_action_at! > b.next_action_at! ? 1 : rank(a) - rank(b)));
  const toQualify = scoped.filter((r) => ["new", "research"].includes(r.stage)).sort((a, b) => rank(a) - rank(b));
  const soon = scoped
    .filter((r) => !["new", "research"].includes(r.stage) && r.next_action_at && r.next_action_at > t && r.next_action_at <= addDays(t, 3))
    .sort((a, b) => (a.next_action_at! < b.next_action_at! ? -1 : 1));
  const noPlan = scoped.filter((r) => !["new", "research", "nurture"].includes(r.stage) && !r.next_action_at);

  const open = (id: string, tabName: "qualify" | "touches") =>
    setParams((p) => {
      p.set("deal", id);
      p.set("tab", tabName);
      return p;
    });
  const close = useCallback(
    () =>
      setParams((p) => {
        p.delete("deal");
        p.delete("tab");
        return p;
      }),
    [setParams],
  );

  return (
    <section>
      <PageHeader
        title="Việc hôm nay"
        description="Điểm chạm đến hạn theo lịch 19 bước và lead cần đánh giá trước khi tiếp cận."
        actions={
          <label className="checkbox inline">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            Chỉ việc của tôi
          </label>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {!rows ? (
        <Spinner />
      ) : (
        <>
          <div className="grid kpis">
            <div className="card stat">
              <span className="stat-label">Đến hạn / quá hạn</span>
              <span className={due.length ? "stat-value text-danger" : "stat-value"}>{due.length}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Cần đánh giá</span>
              <span className="stat-value">{toQualify.length}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">3 ngày tới</span>
              <span className="stat-value">{soon.length}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Chưa có lịch</span>
              <span className={noPlan.length ? "stat-value text-warn" : "stat-value"}>{noPlan.length}</span>
            </div>
          </div>

          <TaskList
            title="Điểm chạm đến hạn"
            empty="Không có việc đến hạn. Làm tốt lắm!"
            rows={due}
            action="Ghi điểm chạm"
            onOpen={(id) => open(id, "touches")}
          />
          <TaskList
            title="Cần đánh giá trước khi tiếp cận"
            empty="Không còn lead chờ đánh giá."
            rows={toQualify.slice(0, 30)}
            more={toQualify.length - 30}
            action="Đánh giá"
            onOpen={(id) => open(id, "qualify")}
            qualify
          />
          {noPlan.length > 0 && (
            <TaskList title="Chưa đặt việc tiếp theo" empty="" rows={noPlan} action="Đặt lịch" onOpen={(id) => open(id, "touches")} />
          )}
          <TaskList title="3 ngày tới" empty="Chưa có lịch trong 3 ngày tới." rows={soon} action="Mở" onOpen={(id) => open(id, "touches")} />
        </>
      )}
      {openId && <DealPanel dealId={openId} initialTab={tab} onClose={close} onChanged={() => void load()} />}
    </section>
  );
}

function TaskList({
  title,
  empty,
  rows,
  more = 0,
  action,
  onOpen,
  qualify,
}: {
  title: string;
  empty: string;
  rows: DealRow[];
  more?: number;
  action: string;
  onOpen: (id: string) => void;
  qualify?: boolean;
}) {
  return (
    <div className="card">
      <div className="row space-between">
        <h2>
          {title} <span className="count">{rows.length + Math.max(0, more)}</span>
        </h2>
        {qualify && <Link to="/pipeline">Mở bảng pipeline</Link>}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="tasks">
          {rows.map((r) => {
            const st = dueState(r.next_action_at);
            return (
              <li key={r.id}>
                <button type="button" className="task" onClick={() => onOpen(r.id)}>
                  <span className={`tier tier-${r.tier ?? "none"}`}>{r.tier ?? "?"}</span>
                  <span className="task-main">
                    <strong>{r.company_name}</strong>
                    <span className="small muted">
                      {r.segment ? SEGMENT_LABEL[r.segment] : "Chưa phân nhóm"}
                      {r.city ? ` · ${r.city}` : ""} · {STAGE_LABEL[r.stage]} · {r.touches}/{TOUCH_GOAL} điểm chạm
                    </span>
                    {!qualify && r.next_action && <span className="small">{r.next_action}</span>}
                  </span>
                  <span className="task-side">
                    {qualify ? (
                      <ScorePill score={r.score} />
                    ) : (
                      <span className={`due due-${st} small`}>{fmtDay(r.next_action_at)}</span>
                    )}
                    <Badge tone="blue">{action}</Badge>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {more > 0 && <p className="small muted">… và {more} lead khác — xem trên bảng pipeline.</p>}
    </div>
  );
}
