import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { Profile, Role } from "../lib/db-types";
import { errMsg, fmtDate } from "../lib/format";
import { Notice, PageHeader, Spinner, TableWrap } from "../components/ui";
import { confirmDialog } from "../components/dialog";

const KEY_INFO: Record<string, { label: string; help: string; shape: "array" | "object" }> = {
  regions: {
    label: "Khu vực",
    help: "Mã khu vực, gl/hl của Serper, danh sách địa danh (name + aliases dùng để nhận diện thành phố).",
    shape: "array",
  },
  keyword_sets: {
    label: "Bộ từ khoá mặc định",
    help: "Từ khoá gợi ý theo nhóm: agency, brand, film, mcn. Người dùng sửa được trước mỗi lần chạy.",
    shape: "object",
  },
  aggregator_blocklist: {
    label: "Danh sách aggregator bị chặn",
    help: "Domain thư mục, báo chí, sàn việc làm, mạng xã hội… bị loại khi Discover (khớp cả subdomain).",
    shape: "array",
  },
  limits: {
    label: "Hạn mức và ngưỡng",
    help: "Hạn mức API mỗi ngày (toàn hệ thống / mỗi người), warn_ratio (cảnh báo), confirm_above_units (hỏi xác nhận), kích thước lô, số run đồng thời, số dòng export tối đa.",
    shape: "object",
  },
  crawl: {
    label: "Đọc website",
    help: "Khoảng nghỉ giữa request cùng domain (ms), số trang tối đa mỗi công ty, timeout, ngân sách thời gian mỗi lần gọi, User-Agent (chỉ ký tự ASCII).",
    shape: "object",
  },
  signal_rules: {
    label: "Quy tắc chuẩn hoá tín hiệu",
    help: 'Theo mã tín hiệu: {"type":"threshold","min":4}, {"type":"linear","min":..,"max":..} hoặc {"type":"log",...}. Mặc định: giá trị > 0 = có.',
    shape: "object",
  },
  retention: {
    label: "Thời hạn lưu trữ",
    help: "Số tháng giữ lead không có tương tác trước khi xoá (đề xuất 12 — cần pháp chế xác nhận).",
    shape: "object",
  },
};

function SettingEditor({
  k,
  value,
  updatedAt,
  isAdmin,
  onSaved,
}: {
  k: string;
  value: unknown;
  updatedAt: string;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const original = JSON.stringify(value, null, 2);
  const [text, setText] = useState(original);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const info = KEY_INFO[k];

  useEffect(() => setText(original), [original]);

  async function save() {
    setError(null);
    setOk(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(`JSON không hợp lệ: ${errMsg(e)}`);
      return;
    }
    if (info?.shape === "array" && !Array.isArray(parsed)) {
      setError("Giá trị phải là một mảng JSON [...].");
      return;
    }
    if (info?.shape === "object" && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) {
      setError("Giá trị phải là một object JSON {...}.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("settings").update({ value: parsed }).eq("key", k);
    setBusy(false);
    if (error) setError(error.message);
    else {
      setOk("Đã lưu.");
      onSaved();
    }
  }

  return (
    <div className="card">
      <div className="row space-between">
        <h3>
          {info?.label ?? k} <code className="small">{k}</code>
        </h3>
        <span className="small muted">Cập nhật {fmtDate(updatedAt)}</span>
      </div>
      {info && <p className="small muted">{info.help}</p>}
      <textarea
        className="code"
        rows={Math.min(18, Math.max(4, text.split("\n").length))}
        value={text}
        readOnly={!isAdmin}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        aria-label={`Giá trị ${k}`}
      />
      {isAdmin && (
        <div className="row">
          <button type="button" className="btn-primary" disabled={busy || text === original} onClick={() => void save()}>
            Lưu
          </button>
          {text !== original && (
            <button type="button" className="btn-link" onClick={() => setText(original)}>
              Hoàn tác
            </button>
          )}
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}
    </div>
  );
}

function UsersSection() {
  const { session } = useAuth();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at");
    if (error) setError(error.message);
    setUsers((data ?? []) as Profile[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(p: Profile, role: Role) {
    if (
      p.user_id === session?.user.id &&
      role !== "admin" &&
      !(await confirmDialog({ title: "Tự hạ quyền admin?", message: "Bạn sẽ mất quyền quản trị ngay sau khi lưu.", confirmLabel: "Hạ quyền", danger: true }))
    )
      return;
    setError(null);
    const { error } = await supabase.from("profiles").update({ role }).eq("user_id", p.user_id);
    if (error) setError(error.message);
    await load();
  }

  return (
    <div className="card">
      <h2>Người dùng</h2>
      <p className="small muted">
        Tài khoản được tạo bằng lời mời từ Supabase Dashboard (Authentication → Users → Invite). Đăng ký công khai đã tắt.
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {!users ? (
        <Spinner />
      ) : (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.email ?? u.user_id}</td>
                  <td>
                    <select value={u.role} onChange={(e) => void setRole(u, e.target.value as Role)} aria-label={`Vai trò ${u.email ?? ""}`}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="small">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}

function PurgeSection({ defaultMonths }: { defaultMonths: number }) {
  const [months, setMonths] = useState(String(defaultMonths));
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function purge() {
    const m = Number(months);
    if (!Number.isInteger(m) || m < 1) {
      setMsg({ kind: "error", text: "Số tháng phải là số nguyên ≥ 1." });
      return;
    }
    if (!(await confirmDialog({ title: "Xoá lead cũ?", message: `Xoá vĩnh viễn mọi lead không có tương tác trong ${m} tháng qua. Không thể hoàn tác.`, confirmLabel: "Xoá vĩnh viễn", danger: true }))) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("purge_stale_leads", { p_months: m });
    setBusy(false);
    if (error) setMsg({ kind: "error", text: error.message });
    else setMsg({ kind: "ok", text: `Đã xoá ${String(data ?? 0)} công ty.` });
  }

  return (
    <div className="card danger">
      <h2>Xoá lead cũ</h2>
      <p className="small muted">
        Xoá công ty (kèm observation, liên hệ) không được tìm thấy lại, đọc website hay export trong số tháng chỉ định.
        Nên lên lịch tự động bằng pg_cron (xem README).
      </p>
      <div className="row">
        <label className="row">
          Số tháng
          <input className="input-sm" type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
        </label>
        <button type="button" className="btn-danger" disabled={busy} onClick={() => void purge()}>
          {busy ? "Đang xoá…" : "Xoá lead cũ"}
        </button>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

/** Bật xác thực hai bước (TOTP) cho tài khoản của chính mình — mục 10.2. */
function MfaSection() {
  const [factors, setFactors] = useState<{ id: string; status: string; friendly_name?: string | null }[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setMsg({ kind: "error", text: error.message });
    setFactors(data?.totp ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `TOTP ${new Date().toISOString().slice(0, 10)}` });
    if (error) {
      setMsg({ kind: "error", text: `Không bật được MFA (có thể gói Supabase chưa hỗ trợ): ${error.message}` });
      return;
    }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify() {
    if (!enroll) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    if (error) setMsg({ kind: "error", text: error.message });
    else {
      setMsg({ kind: "ok", text: "Đã bật xác thực hai bước." });
      setEnroll(null);
      setCode("");
      await load();
    }
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Tắt thiết bị xác thực này?", confirmLabel: "Tắt", danger: true }))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) setMsg({ kind: "error", text: error.message });
    await load();
  }

  const verified = factors.filter((f) => f.status === "verified");
  const qrSrc = enroll && enroll.qr.startsWith("data:image/") ? enroll.qr : null;

  return (
    <div className="card">
      <h2>Bảo mật tài khoản</h2>
      {verified.length > 0 ? (
        <>
          <p>Xác thực hai bước: <strong>đang bật</strong>.</p>
          {verified.map((f) => (
            <div className="row" key={f.id}>
              <span className="small">{f.friendly_name ?? f.id}</span>
              <button type="button" className="btn-link" onClick={() => void remove(f.id)}>
                Tắt
              </button>
            </div>
          ))}
        </>
      ) : (
        <p className="small muted">Khuyến nghị bật xác thực hai bước, bắt buộc với tài khoản admin.</p>
      )}
      {!enroll && verified.length === 0 && (
        <button type="button" onClick={() => void start()}>
          Bật xác thực hai bước
        </button>
      )}
      {enroll && (
        <div>
          <p className="small">Quét mã bằng ứng dụng xác thực (Google Authenticator, 1Password…), rồi nhập mã 6 số.</p>
          {qrSrc && <img className="qr" src={qrSrc} alt="Mã QR đăng ký TOTP" width={180} height={180} />}
          <p className="small">
            Hoặc nhập khoá: <code>{enroll.secret}</code>
          </p>
          <div className="row">
            <input
              className="input-sm"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Mã xác thực"
            />
            <button type="button" className="btn-primary" onClick={() => void verify()}>
              Xác minh
            </button>
          </div>
        </div>
      )}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

export function SettingsPage() {
  const { isAdmin, profile } = useAuth();
  const { rows, settings, loading, error, reload } = useSettings();
  if (loading) return <Spinner />;

  const ordered = [
    ...Object.keys(KEY_INFO).filter((k) => rows.some((r) => r.key === k)),
    ...rows.map((r) => r.key).filter((k) => !(k in KEY_INFO)),
  ];
  const retention = Number((settings["retention"] as { months?: number } | undefined)?.months ?? 12);

  return (
    <section>
      <PageHeader title="Cài đặt" description="Bảo mật tài khoản, người dùng, hạn mức API và bộ từ khoá mặc định." />
      {!isAdmin && <Notice kind="info">Chỉ admin được sửa cài đặt. Vai trò của bạn: {profile?.role ?? "user"}.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <MfaSection />
      {isAdmin && <UsersSection />}
      {isAdmin && <PurgeSection defaultMonths={retention} />}
      <p className="small muted">Trọng số tín hiệu chỉnh ở màn hình Tín hiệu.</p>
      {ordered.map((k) => {
        const r = rows.find((x) => x.key === k)!;
        return <SettingEditor key={k} k={k} value={r.value} updatedAt={r.updated_at} isAdmin={isAdmin} onSaved={() => void reload()} />;
      })}
    </section>
  );
}
