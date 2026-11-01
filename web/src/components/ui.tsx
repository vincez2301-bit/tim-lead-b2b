import type { ReactNode } from "react";
import type { CompanyStatus, EmailLabel, RunStatus } from "../lib/api-types";
import type { SignalStatus } from "../lib/db-types";
import { EMAIL_LABEL, RUN_STATUS_LABEL, SIGNAL_STATUS_LABEL, STATUS_LABEL } from "../lib/format";

export function Notice({ kind = "info", children }: { kind?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

export function Spinner({ label = "Đang tải…" }: { label?: string }) {
  return <p className="muted">{label}</p>;
}

export function Badge({ tone = "gray", children, title }: { tone?: string; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

const EMAIL_TONE: Record<EmailLabel, string> = {
  verified: "green",
  published: "blue",
  risky: "orange",
  guess: "gray",
  invalid: "red",
};
export function EmailLabelBadge({ label }: { label: EmailLabel | null }) {
  if (!label) return <Badge>—</Badge>;
  return <Badge tone={EMAIL_TONE[label]}>{EMAIL_LABEL[label]}</Badge>;
}

const STATUS_TONE: Record<CompanyStatus, string> = {
  new: "gray",
  profiled: "blue",
  enriched: "green",
  unreachable: "red",
  archived: "gray",
};
export function StatusBadge({ status }: { status: CompanyStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>;
}

const RUN_TONE: Record<RunStatus, string> = { running: "blue", done: "green", failed: "red", partial: "orange" };
export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge tone={RUN_TONE[status]}>{RUN_STATUS_LABEL[status] ?? status}</Badge>;
}

const SIGNAL_TONE: Record<SignalStatus, string> = { proposed: "orange", confirmed: "green", rejected: "red" };
export function SignalStatusBadge({ status }: { status: SignalStatus }) {
  return <Badge tone={SIGNAL_TONE[status]}>{SIGNAL_STATUS_LABEL[status] ?? status}</Badge>;
}

export function ScorePill({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="muted">—</span>;
  const tone = score >= 60 ? "green" : score >= 30 ? "orange" : "gray";
  return <Badge tone={tone}>{score}</Badge>;
}

/** Hiển thị JSON dạng văn bản thuần (không bao giờ dựng HTML từ dữ liệu). */
export function JsonText({ value, max = 4000 }: { value: unknown; max?: number }) {
  let s: string;
  try {
    s = JSON.stringify(value, null, 2) ?? "";
  } catch {
    s = String(value);
  }
  if (s.length > max) s = `${s.slice(0, max)}\n…`;
  return <pre className="json">{s}</pre>;
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((100 * done) / total) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <progress max={100} value={pct} />
      <span className="muted">
        {done}/{total} ({pct}%)
      </span>
    </div>
  );
}
