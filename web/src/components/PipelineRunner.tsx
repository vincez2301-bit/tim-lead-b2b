import { useEffect, useRef, useState } from "react";
import { runBatched, sumField, type BatchFn, type BatchProgress } from "../lib/api";
import type { EnrichContactResponse, EnrichYoutubeResponse, FindWebsiteResponse, ProfileResponse } from "../lib/api-types";
import { STEP_LABEL } from "../lib/format";
import { Notice, Progress } from "./ui";

type StepState = "idle" | "running" | "done" | "error" | "stopped";

interface StepView {
  state: StepState;
  progress: BatchProgress;
  summary: string;
}

// Bước đọc website tìm luôn người liên hệ, nên không chạy enrich_contact (đọc lại cùng các trang) nữa.
const ALL_STEPS: BatchFn[] = ["profile", "enrich_youtube"];

function summarize(fn: BatchFn, responses: unknown[]): string {
  if (fn === "find_website") {
    const r = responses as FindWebsiteResponse[];
    const checked = sumField(r, "checked");
    if (!checked) return "Mọi công ty đều đã có website.";
    return `Tìm thấy website cho ${sumField(r, "found")}/${checked} công ty, ${sumField(r, "phones")} số điện thoại từ Google, dùng ${sumField(r, "units_used")} lượt Google.`;
  }
  if (fn === "profile") {
    const r = responses as ProfileResponse[];
    return `Đã xử lý ${sumField(r, "processed")}, lỗi website ${sumField(r, "failed")}, bỏ qua ${sumField(r, "skipped")}, ${sumField(r, "observations")} observation mới, ${sumField(r, "contacts")} liên hệ (${sumField(r, "decision_makers")} người quyết định).`;
  }
  if (fn === "enrich_youtube") {
    const r = responses as EnrichYoutubeResponse[];
    return `Đã xử lý ${sumField(r, "processed")}, ${sumField(r, "channels")} kênh, ${sumField(r, "units_used")} đơn vị quota, ${sumField(r, "skipped_no_channel")} công ty không có kênh.`;
  }
  const r = responses as EnrichContactResponse[];
  return `Đã xử lý ${sumField(r, "processed")}, ${sumField(r, "contacts")} liên hệ, ${sumField(r, "decision_makers")} người quyết định.`;
}

/**
 * Chạy lần lượt profile (kèm tìm liên hệ) → enrich_youtube cho danh sách công ty, theo lô nhỏ
 * (mục 10.3: chạy theo lô để không vượt giới hạn thời gian của Edge Function).
 */
export function PipelineRunner({
  companyIds,
  batchSize,
  steps: stepsProp,
  findWebsite = false,
  autoStart = false,
  onFinished,
}: {
  companyIds: string[];
  batchSize: number;
  steps?: BatchFn[];
  /** Thêm bước tìm website trên Google cho công ty chưa có domain (vd. nhập từ danh sách tên). */
  findWebsite?: boolean;
  autoStart?: boolean;
  onFinished?: () => void;
}) {
  const steps = stepsProp ?? (findWebsite ? (["find_website", ...ALL_STEPS] as BatchFn[]) : ALL_STEPS);
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
      if (fn === "find_website") {
        const r = res.responses as FindWebsiteResponse[];
        const missing = r.flatMap((x) => x.not_found ?? []);
        const conflicts = r.flatMap((x) => x.conflicts ?? []);
        if (missing.length)
          setNotes((n) => [
            ...n,
            `Chưa tìm được website cho ${missing.length} công ty (tên chung chung, hoặc chỉ có Facebook/YouTube): ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? "…" : ""}. Có thể điền tay ở trang công ty.`,
          ]);
        if (conflicts.length) setNotes((n) => [...n, `Website trùng với công ty đã có (kiểm tra có phải cùng một công ty không): ${conflicts.slice(0, 10).join("; ")}`]);
      }
      if (res.failedIds.length) {
        setNotes((n) => [
          ...n,
          `${STEP_LABEL[fn]}: bỏ qua ${res.failedIds.length} công ty vì server quá tải khi xử lý (website quá nặng hoặc phản hồi chậm). Có thể phân tích lại riêng các công ty này sau.`,
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
          fn === "find_website"
            ? "Google (Serper): đã hết hạn mức lượt hôm nay. Chạy lại phân tích cho danh sách này vào ngày mai — công ty đã có website không tốn lượt."
            : "YouTube: đã hết quota hôm nay. Run được lưu ở trạng thái 'Dừng giữa chừng' — vào Nhật ký để bấm Tiếp tục sau khi quota đặt lại.",
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

  // Mở từ trang Nhập file sau khi nhập danh sách: chạy luôn, không bắt bấm thêm.
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && !started.current && companyIds.length) {
      started.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="card">
      <div className="row space-between">
        <h3>Phân tích website cho {companyIds.length} công ty</h3>
        <div className="row">
          <button type="button" className="btn-primary" disabled={running || companyIds.length === 0} onClick={() => void start()}>
            {running ? "Đang phân tích…" : "Bắt đầu phân tích"}
          </button>
          {running && (
            <button type="button" onClick={() => (cancelled.current = true)}>
              Dừng
            </button>
          )}
        </div>
      </div>
      <p className="muted small">
        {steps.includes("find_website") ? "Tìm website trên Google (công ty chưa có website, 1–2 lượt Google mỗi công ty) → " : ""}
        Đọc website (tìm luôn email, người phụ trách) → kênh YouTube → chấm điểm. Mỗi lượt {batchSize} công ty; có thể để chạy, xong sẽ báo.
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
