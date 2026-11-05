import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { SEGMENT_LABEL } from "../lib/format";
import { rememberFilter, rememberedFilter, useSettings } from "../lib/settings";
import {
  CHANNEL_LABEL,
  DEFAULT_NEW_PER_DAY,
  LOST_REASON_LABEL,
  OPEN_STAGES,
  RENEWAL_WINDOW_DAYS,
  STAGE_LABEL,
  TOUCH_GOAL,
  addDays,
  dueState,
  fmtDay,
  fmtUsd,
  getCadence,
  leadRank,
  nextMove,
  todayIso,
  type DealRow,
} from "../lib/pipeline";
import { EmptyState, Notice, PageHeader, Spinner } from "../components/ui";
import { DealPanel } from "../components/DealPanel";

interface Task {
  row: DealRow;
  title: string;
  date: string | null;
  action: string;
  extra?: string;
}

export function TodayPage() {
  const { session } = useAuth();
  const { settings } = useSettings();
  const cadence = getCadence(settings);
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [renewals, setRenewals] = useState<DealRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(() => rememberedFilter("today.mine") === "1");
  useEffect(() => rememberFilter("today.mine", mine ? "1" : ""), [mine]);
  const [perDay, setPerDay] = useState(() => {
    const n = Number(rememberedFilter("today.newPerDay"));
    return Number.isInteger(n) && n > 0 ? n : DEFAULT_NEW_PER_DAY;
  });
  useEffect(() => rememberFilter("today.newPerDay", String(perDay)), [perDay]);
  const [showAllNew, setShowAllNew] = useState(false);
  const openId = params.get("deal");
  const [queue, setQueue] = useState<string[] | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const tab = (params.get("tab") as "qualify" | "touches" | null) ?? undefined;

  const load = useCallback(async () => {
    const [openRes, wonRes] = await Promise.all([
      supabase.from("deal_board").select("*").in("stage", [...OPEN_STAGES, "nurture"]).limit(3000),
      supabase
        .from("deal_board")
        .select("*")
        .eq("stage", "won")
        .not("renewal_at", "is", null)
        .lte("renewal_at", addDays(todayIso(), RENEWAL_WINDOW_DAYS))
        .order("renewal_at"),
    ]);
    if (openRes.error || wonRes.error) setError((openRes.error ?? wonRes.error)!.message);
    setRows((openRes.data ?? []) as DealRow[]);
    setRenewals((wonRes.data ?? []) as DealRow[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const scoped = useMemo(
    () => (rows ?? []).filter((r) => !mine || r.owner_id === session?.user.id || (!r.owner_id && r.created_by === session?.user.id)),
    [rows, mine, session],
  );
  const t = todayIso();
  const isNew = (r: DealRow) => r.stage === "new" || r.stage === "research";
  const byDate = (a: Task, b: Task) => (a.date ?? "9") < (b.date ?? "9") ? -1 : (a.date ?? "9") > (b.date ?? "9") ? 1 : leadRank(a.row) - leadRank(b.row);
  const task = (r: DealRow, action = "Làm"): Task => {
    const m = nextMove(r, cadence);
    return { row: r, title: m.title, date: m.due, action, extra: m.channel ? CHANNEL_LABEL[m.channel] : undefined };
  };

  // Điểm chạm đến hạn (khách đã bắt đầu tiếp cận).
  const due = scoped.filter((r) => !isNew(r) && r.next_action_at && r.next_action_at <= t).map((r) => task(r)).sort(byDate);
  // Lead mới: mỗi ngày gửi email mở lời cho vài lead ưu tiên nhất.
  const allNew = scoped.filter(isNew).sort((a, b) => leadRank(a) - leadRank(b));
  const startedToday = scoped.filter((r) => r.stage === "outreach" && r.cadence_started_at === t).length;
  const quota = Math.max(0, perDay - startedToday);
  const todayNew = allNew.slice(0, quota).map((r) => ({ ...task(r, "Gửi email"), date: t }));
  const waitingNew = allNew.slice(quota);
  const todayTasks = [...due, ...todayNew];
  const soon = scoped
    .filter((r) => !isNew(r) && r.next_action_at && r.next_action_at > t && r.next_action_at <= addDays(t, 3))
    .map((r) => task(r, "Mở"))
    .sort(byDate);
  const noPlan = scoped.filter((r) => !isNew(r) && OPEN_STAGES.includes(r.stage) && !r.next_action_at).map((r) => task(r, "Đặt lịch"));
  const renewTasks = renewals.map((r) => ({
    row: r,
    title: `Gọi chốt gia hạn${r.est_arr_usd ? ` · ARR ${fmtUsd(r.est_arr_usd)}` : ""}`,
    date: r.renewal_at,
    action: "Mở",
    extra: "hết hạn hợp đồng",
  }));

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
        title="Hôm nay"
        description="Những việc nên làm hôm nay. Bấm “Bắt đầu”: app mở lần lượt từng khách với email / Zalo / kịch bản gọi soạn sẵn, gửi xong bấm “Đã gửi” là sang khách kế tiếp."
        actions={
          <label className="checkbox inline">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            Chỉ việc của tôi
          </label>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {doneMsg && <Notice kind="ok">{doneMsg}</Notice>}
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card start-session">
          <div>
            <strong>Pipeline chưa có khách nào</strong>
            <div className="small muted">Tìm công ty trên Google hoặc nhập file lead có sẵn. Khách mới sẽ hiện ở đây để gửi email mở lời.</div>
          </div>
          <div className="row nowrap">
            <Link className="btn btn-primary" to="/search">
              Tìm khách mới
            </Link>
            <Link className="btn" to="/import">
              Nhập file
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card start-session">
            <div>
              <strong>
                {todayTasks.length ? `Hôm nay có ${todayTasks.length} việc` : "Hôm nay đã xong việc"}
              </strong>
              <div className="small muted">
                {due.length} điểm chạm đến hạn · {todayNew.length} lead mới gửi email mở lời
                {startedToday ? ` (đã gửi ${startedToday} hôm nay)` : ""}
              </div>
              <label className="row small per-day">
                Lead mới mỗi ngày
                <select className="input-sm" value={perDay} onChange={(e) => setPerDay(Number(e.target.value))}>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!todayTasks.length}
              onClick={() => {
                setDoneMsg(null);
                setQueue(todayTasks.map((x) => x.row.id));
                open(todayTasks[0].row.id, "touches");
              }}
            >
              Bắt đầu
            </button>
          </div>

          <TaskList title="Việc hôm nay" empty="Không còn việc nào hôm nay. Làm tốt lắm!" tasks={todayTasks} onOpen={(id) => open(id, "touches")} />
          {renewTasks.length > 0 && (
            <TaskList title={`Sắp gia hạn hợp đồng (${RENEWAL_WINDOW_DAYS} ngày tới)`} empty="" tasks={renewTasks} onOpen={(id) => open(id, "touches")} />
          )}
          {noPlan.length > 0 && (
            <TaskList title="Chưa đặt việc tiếp theo" empty="" tasks={noPlan} onOpen={(id) => open(id, "touches")} />
          )}
          <TaskList title="3 ngày tới" empty="Chưa có lịch trong 3 ngày tới." tasks={soon} onOpen={(id) => open(id, "touches")} />
          {waitingNew.length > 0 && (
            <TaskList
              title="Lead mới đang chờ tới lượt"
              hint="Xếp theo hạng A/B/C rồi nhóm khách (đài → MCN → production house → hãng phim → nhãn hàng). Muốn gửi thêm hôm nay thì bấm Gửi email."
              empty=""
              tasks={(showAllNew ? waitingNew : waitingNew.slice(0, 5)).map((r) => ({ ...task(r, "Gửi email"), date: null }))}
              more={showAllNew ? 0 : waitingNew.length - 5}
              onMore={() => setShowAllNew(true)}
              onOpen={(id) => open(id, "touches")}
            />
          )}
        </>
      )}
      {openId && (
        <DealPanel
          dealId={openId}
          initialTab={tab}
          onClose={() => {
            setQueue(null);
            close();
          }}
          onChanged={() => void load()}
          queue={
            queue && queue.includes(openId)
              ? {
                  pos: queue.indexOf(openId) + 1,
                  total: queue.length,
                  autoNext: true,
                  prev: () => {
                    const i = queue.indexOf(openId);
                    if (i > 0) open(queue[i - 1], "touches");
                  },
                  next: () => {
                    const i = queue.indexOf(openId);
                    if (i < queue.length - 1) open(queue[i + 1], "touches");
                    else {
                      setQueue(null);
                      close();
                      setDoneMsg(`Xong ${queue.length} việc hôm nay. Làm tốt lắm!`);
                    }
                  },
                }
              : undefined
          }
        />
      )}
    </section>
  );
}

function TaskList({
  title,
  hint,
  empty,
  tasks,
  more = 0,
  onMore,
  onOpen,
}: {
  title: string;
  hint?: string;
  empty: string;
  tasks: Task[];
  more?: number;
  onMore?: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="card">
      <h2>
        {title} <span className="count">{tasks.length + Math.max(0, more)}</span>
      </h2>
      {hint && <p className="small muted">{hint}</p>}
      {tasks.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="tasks">
          {tasks.map(({ row: r, title: what, date, action, extra }) => (
            <li key={r.id}>
              <button type="button" className="task" onClick={() => onOpen(r.id)}>
                <span className={`tier tier-${r.tier ?? "none"}`}>{r.tier ?? "?"}</span>
                <span className="task-main">
                  <strong>{r.company_name}</strong>
                  <span className="task-next">
                    → {what}
                    {extra ? <span className="small muted"> · {extra}</span> : null}
                  </span>
                  <span className="small muted">
                    {r.segment ? SEGMENT_LABEL[r.segment] : "Chưa phân nhóm"}
                    {r.city ? ` · ${r.city}` : ""} · {STAGE_LABEL[r.stage]} · {r.touches}/{TOUCH_GOAL} điểm chạm
                    {r.stage === "nurture" && r.lost_reason_code ? ` · từ chối vì ${LOST_REASON_LABEL[r.lost_reason_code].toLowerCase()}` : ""}
                  </span>
                </span>
                <span className="task-side">
                  {date && <span className={`due due-${dueState(date)} small`}>{fmtDay(date)}</span>}
                  <span className={dueState(date) === "overdue" || dueState(date) === "today" ? "btn btn-primary btn-sm" : "btn btn-sm"}>{action}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && (
        <button type="button" className="btn-link small show-more" onClick={onMore}>
          Hiện thêm {more}
        </button>
      )}
    </div>
  );
}
