import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { Profile, Role } from "../lib/db-types";
import { errMsg, fmtDate } from "../lib/format";
import { Notice, PageHeader, Spinner, TableWrap } from "../components/ui";
import { confirmDialog } from "../components/dialog";
import { getSender, signature, type Sender } from "../lib/pipeline";
import { downloadBackup, downloadPipelineCsv } from "../lib/backup";
import { SignalsPage } from "./Signals";
import { DncPage } from "./Dnc";
import { LogsPage } from "./Logs";

const KEY_INFO: Record<string, { label: string; help: string; shape: "array" | "object" }> = {
  sender: {
    label: "Thông tin người gửi",
    help: 'Dùng cho chữ ký trong nội dung soạn sẵn: {"name":"Tên bạn","title":"Account Manager","company":"Bigfish Agency","phone":"09…"}.',
    shape: "object",
  },
  message_templates: {
    label: "Nội dung soạn sẵn",
    help: 'Mỗi mẫu: {"step":2,"channel":"email","segment":"broadcaster|mcn|agency|film|brand|all","title":"…","subject":"…","body":"…"}. Biến: {ten} {cong_ty} {playlist} {nguoi_gui} {cong_ty_ban} {chu_ky}.',
    shape: "array",
  },
  playlists: {
    label: "Thư viện playlist",
    help: 'Playlist gợi ý khi gửi Zalo/email: [{"title":"Tin tức – nhịp nhanh","url":"https://…","segments":["broadcaster"],"note":"…"}]. segments: broadcaster, mcn, agency, film, brand (bỏ trống = mọi nhóm).',
    shape: "array",
  },
  objection_playbook: {
    label: "Kịch bản xử lý từ chối",
    help: 'Câu trả lời mẫu theo lý do: [{"reason":"price|competitor|no_need|timing|no_contact|other","title":"…","text":"…"}]. Hiện trong tab Điểm chạm của mỗi deal.',
    shape: "array",
  },
  sales_calendar: {
    label: "Lịch bán hàng",
    help: 'budget_month: tháng khách thường lên ngân sách (1–12). Khách chê giá sẽ được hẹn liên hệ lại đầu tháng này.',
    shape: "object",
  },
  cadence: {
    label: "Lịch 19 điểm chạm",
    help: 'Các bước: [{"step":1,"day":0,"channel":"email|call|zalo|linkedin|meeting|event|other","title":"…","hint":"…"}]. day = số ngày kể từ khi bắt đầu tiếp cận.',
    shape: "array",
  },
  qualification_criteria: {
    label: "Tiêu chí đánh giá lead",
    help: 'Các câu hỏi trong tab Đánh giá: [{"key":"uses_music","label":"…"}]. Đổi key sẽ mất câu trả lời cũ của key đó.',
    shape: "array",
  },
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

const TABS = [
  { key: "general", label: "Chung" },
  { key: "signals", label: "Tín hiệu chấm điểm" },
  { key: "dnc", label: "Danh sách loại trừ" },
  { key: "logs", label: "Nhật ký" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "general") as TabKey;
  return (
    <>
      <div className="tabs page-tabs" role="tablist" aria-label="Mục cài đặt">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => setParams(t.key === "general" ? {} : { tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "general" && <GeneralSettings />}
      {tab === "signals" && <SignalsPage />}
      {tab === "dnc" && <DncPage />}
      {tab === "logs" && <LogsPage />}
    </>
  );
}

function SenderForm({ isAdmin }: { isAdmin: boolean }) {
  const { settings, save } = useSettings();
  const [v, setV] = useState<Sender>(() => getSender(settings));
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const field = (k: keyof Sender, label: string, ph: string) => (
    <label>
      {label}
      <input value={v[k]} placeholder={ph} disabled={!isAdmin} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="card">
      <h2>Thông tin người gửi</h2>
      <p className="small muted">Dùng cho chữ ký cuối mọi email / tin nhắn soạn sẵn.</p>
      <div className="form-grid">
        {field("name", "Tên", "Việt")}
        {field("title", "Chức danh", "Licensing Manager")}
        {field("company", "Công ty", "Epidemic Sound tại Việt Nam")}
        {field("phone", "Số điện thoại (Zalo / WhatsApp)", "+84 …")}
      </div>
      <div className="row">
        <button
          type="button"
          className="btn-primary"
          disabled={!isAdmin}
          onClick={async () => {
            const err = await save("sender", v);
            setMsg(err ? { kind: "error", text: err } : { kind: "ok", text: "Đã lưu." });
          }}
        >
          Lưu
        </button>
        <span className="small muted pre-wrap">Chữ ký: {signature(v).replace(/\n/g, " · ")}</span>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

function BackupSection() {
  const [busy, setBusy] = useState<"" | "json" | "csv">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  async function run(kind: "json" | "csv") {
    setBusy(kind);
    setMsg(null);
    try {
      const n = kind === "json" ? await downloadBackup() : await downloadPipelineCsv();
      setMsg({ kind: "ok", text: kind === "json" ? `Đã tải bản sao lưu (${n} dòng dữ liệu).` : `Đã xuất ${n} deal ra file CSV.` });
    } catch (e) {
      setMsg({ kind: "error", text: errMsg(e) });
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="card">
      <h2>Sao lưu dữ liệu</h2>
      <p className="small muted">
        Lịch sử điểm chạm, khách đã ký và ghi chú chỉ nằm trong database. Gói Supabase miễn phí thường không có bản sao lưu tự
        động để khôi phục (xem Supabase → Database → Backups). Nên tải bản sao lưu mỗi tuần và cất vào Google Drive.
      </p>
      <div className="row">
        <button type="button" className="btn-primary" disabled={!!busy} onClick={() => void run("json")}>
          {busy === "json" ? "Đang tải…" : "Tải bản sao lưu (JSON)"}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void run("csv")}>
          {busy === "csv" ? "Đang xuất…" : "Xuất pipeline ra Excel (CSV)"}
        </button>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

function GeneralSettings() {
  const { isAdmin, profile } = useAuth();
  const { rows, settings, loading, error, reload } = useSettings();
  if (loading) return <Spinner />;

  const ordered = [
    ...Object.keys(KEY_INFO).filter((k) => rows.some((r) => r.key === k)),
    ...rows.map((r) => r.key).filter((k) => !(k in KEY_INFO)),
  ].filter((k) => k !== "sender");
  const retention = Number((settings["retention"] as { months?: number } | undefined)?.months ?? 12);

  return (
    <section>
      <PageHeader title="Cài đặt" description="Người gửi, bảo mật, người dùng và cấu hình nâng cao." />
      {!isAdmin && <Notice kind="info">Chỉ admin được sửa cài đặt. Vai trò của bạn: {profile?.role ?? "user"}.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <SenderForm isAdmin={isAdmin} />
      <BackupSection />
      <MfaSection />
      {isAdmin && <UsersSection />}
      {isAdmin && <PurgeSection defaultMonths={retention} />}
      <details className="card advanced">
        <summary>
          <strong>Cấu hình nâng cao (JSON)</strong>
          <span className="small muted"> — email mẫu và kịch bản từ chối sửa dễ hơn ở mục Kho nội dung</span>
        </summary>
        {ordered.map((k) => {
          const r = rows.find((x) => x.key === k)!;
          return <SettingEditor key={k} k={k} value={r.value} updatedAt={r.updated_at} isAdmin={isAdmin} onSaved={() => void reload()} />;
        })}
      </details>
    </section>
  );
}
