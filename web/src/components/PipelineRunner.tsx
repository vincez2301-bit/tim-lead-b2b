import { useRef, useState } from "react";
import { runBatched, sumField, type BatchFn, type BatchProgress } from "../lib/api";
import type { EnrichContactResponse, EnrichYoutubeResponse, ProfileResponse } from "../lib/api-types";
import { STEP_LABEL } from "../lib/format";
import { Notice, Progress } from "./ui";

type StepState = "idle" | "running" | "done" | "error" | "stopped";

interface StepView {
  state: StepState;
  progress: BatchProgress;
  summary: string;
}

const ALL_STEPS: BatchFn[] = ["profile", "enrich_youtube", "enrich_contact"];

function summarize(fn: BatchFn, responses: unknown[]): string {
  if (fn === "profile") {
    const r = responses as ProfileResponse[];
    return `Đã xử lý ${sumField(r, "processed")}, lỗi website ${sumField(r, "failed")}, bỏ qua ${sumField(r, "skipped")}, ${sumField(r, "observations")} observation mới.`;
  }
  if (fn === "enrich_youtube") {
    const r = responses as EnrichYoutubeResponse[];
    return `Đã xử lý ${sumField(r, "processed")}, ${sumField(r, "channels")} kênh, ${sumField(r, "units_used")} đơn vị quota, ${sumField(r, "skipped_no_channel")} công ty không có kênh.`;
  }
  const r = responses as EnrichContactResponse[];
  return `Đã xử lý ${sumField(r, "processed")}, ${sumField(r, "contacts")} liên hệ, ${sumField(r, "decision_makers")} người quyết định.`;
}

/**
 * Chạy lần lượt profile → enrich_youtube → enrich_contact cho danh sách công ty, theo lô nhỏ
 * (mục 10.3: chạy theo lô để không vượt giới hạn thời gian của Edge Function).
 */
export function PipelineRunner({
  companyIds,
  batchSize,
  steps = ALL_STEPS,
  onFinished,
}: {
  companyIds: string[];
  batchSize: number;
  steps?: BatchFn[];
  onFinished?: () => void;
}) {
  const init = (): Record<string, StepView> =>
    Object.fromEntries(
      steps.map((s) => [s, { state: "idle" as StepState, progress: { done: 0, total: companyIds.length, calls: 0 }, summary: "" }]),
    );
  const [views, setViews] = useState<Record<string, StepView>>(init);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const cancelled = useRef(false);

  const update = (fn: BatchFn, patch: Partial<StepView>) =>
    setViews((v) => ({ ...v, [fn]: { ...v[fn], ...patch } }));

  async function start() {
    if (companyIds.length === 0) return;
    cancelled.current = false;
    setRunning(true);
    setError(null);
    setNotes([]);
    setViews(init());
    for (const fn of steps) {
      update(fn, { state: "running" });
      const res = await runBatched(
        fn,
        companyIds,
        batchSize,
        (p) => update(fn, { progress: p }),
        () => cancelled.current,
      );
      const summary = summarize(fn, res.responses);
      if (res.failedIds.length) {
        setNotes((n) => [
          ...n,
          `${STEP_LABEL[fn]}: bỏ qua ${res.failedIds.length} công ty vì server quá tải khi xử lý (website quá nặng hoặc phản hồi chậm). Có thể chạy lại riêng các công ty này ở trang Công ty.`,
        ]);
      }
      if (res.error) {
        update(fn, { state: "error", summary });
        setError(`${STEP_LABEL[fn]}: ${res.error}`);
        break;
      }
      if (res.stoppedReason === "cancelled") {
        update(fn, { state: "stopped", summary });
        setNotes((n) => [...n, "Đã dừng theo yêu cầu."]);
        break;
      }
      if (res.stoppedReason === "quota") {
        update(fn, { state: "stopped", summary });
        setNotes((n) => [
          ...n,
          "YouTube: đã hết quota hôm nay. Run được lưu ở trạng thái 'Dừng giữa chừng' — vào Nhật ký để bấm Tiếp tục sau khi quota đặt lại.",
        ]);
        continue; // các bước sau không tốn quota YouTube nên vẫn chạy tiếp
      }
      if (res.stoppedReason === "stalled") {
        update(fn, { state: "stopped", summary });
        setNotes((n) => [...n, `${STEP_LABEL[fn]}: server không xử lý thêm được công ty nào, đã dừng bước này.`]);
        continue;
      }
      update(fn, { state: "done", summary });
    }
    setRunning(false);
    onFinished?.();
  }

  return (
    <div className="card">
      <div className="row space-between">
        <h3>Chạy pipeline cho {companyIds.length} công ty</h3>
        <div className="row">
          <button type="button" className="btn-primary" disabled={running || companyIds.length === 0} onClick={() => void start()}>
            {running ? "Đang chạy…" : "Chạy pipeline"}
          </button>
          {running && (
            <button type="button" onClick={() => (cancelled.current = true)}>
              Dừng
            </button>
          )}
        </div>
      </div>
      <p className="muted small">
        Thứ tự: {steps.map((s) => STEP_LABEL[s]).join(" → ")}. Mỗi lần gọi tối đa {batchSize} công ty.
      </p>
      <ul className="steps">
        {steps.map((fn) => {
          const v = views[fn];
          return (
            <li key={fn} className={`step step-${v.state}`}>
              <div className="row space-between">
                <strong>{STEP_LABEL[fn]}</strong>
                <span className="muted small">
                  {v.state === "idle" && "Chờ"}
                  {v.state === "running" && "Đang chạy"}
                  {v.state === "done" && "Xong"}
                  {v.state === "error" && "Lỗi"}
                  {v.state === "stopped" && "Đã dừng"}
                </span>
              </div>
              {v.state !== "idle" && <Progress done={v.progress.done} total={v.progress.total} />}
              {v.summary && <p className="small">{v.summary}</p>}
            </li>
          );
        })}
      </ul>
      {error && <Notice kind="error">{error}</Notice>}
      {notes.map((n) => (
        <Notice key={n} kind="warn">
          {n}
        </Notice>
      ))}
    </div>
  );
}
