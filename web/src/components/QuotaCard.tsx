import type { QuotaInfo } from "../lib/api-types";
import { fmtNum, fmtPct } from "../lib/format";
import { Notice } from "./ui";

export function quotaWarning(q: QuotaInfo | undefined): boolean {
  if (!q) return false;
  const ratio = q.warn_ratio || 0.8;
  const g = q.limit_global > 0 ? q.used_global / q.limit_global : 0;
  const u = q.limit_user > 0 ? q.used_user / q.limit_user : 0;
  return g >= ratio || u >= ratio;
}

export function QuotaCard({ title, q, unit }: { title: string; q: QuotaInfo | undefined; unit: string }) {
  if (!q) return null;
  const warn = quotaWarning(q);
  return (
    <div className="card stat">
      <div className="muted small">{title}</div>
      <div className="stat-value">
        {fmtNum(q.remaining)} <span className="small muted">{unit} còn lại</span>
      </div>
      <div className="small">
        Toàn hệ thống: {fmtNum(q.used_global)}/{fmtNum(q.limit_global)} ({fmtPct(q.used_global, q.limit_global)})
      </div>
      <div className="small">
        Của bạn: {fmtNum(q.used_user)}/{fmtNum(q.limit_user)} ({fmtPct(q.used_user, q.limit_user)})
      </div>
      {warn && (
        <Notice kind="warn">
          Đã dùng ≥ {Math.round((q.warn_ratio || 0.8) * 100)}% hạn mức hôm nay.
        </Notice>
      )}
    </div>
  );
}
