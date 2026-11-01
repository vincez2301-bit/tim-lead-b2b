import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { errMsg } from "../lib/format";
import { Notice } from "../components/ui";

// Mục 9 / 10.2: chỉ đăng nhập — không có đăng ký công khai; magic link không tạo tài khoản mới.
export function LoginPage() {
  const { needsMfa, session } = useAuth();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (session && needsMfa) return <MfaChallenge />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setInfo("Nếu email đã được mời vào hệ thống, bạn sẽ nhận được link đăng nhập trong vài phút.");
      }
    } catch (err) {
      const m = errMsg(err);
      setError(
        /invalid login credentials/i.test(m)
          ? "Email hoặc mật khẩu không đúng."
          : /signups not allowed|not found/i.test(m)
            ? "Tài khoản chưa được mời. Liên hệ admin."
            : m,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={(e) => void submit(e)}>
        <h1>Sync Lead Finder</h1>
        <p className="muted">Đăng nhập bằng tài khoản được admin mời.</p>
        <div className="tabs">
          <button type="button" className={mode === "password" ? "tab active" : "tab"} onClick={() => setMode("password")}>
            Mật khẩu
          </button>
          <button type="button" className={mode === "magic" ? "tab active" : "tab"} onClick={() => setMode("magic")}>
            Magic link
          </button>
        </div>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === "password" && (
          <label>
            Mật khẩu
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Đang xử lý…" : mode === "password" ? "Đăng nhập" : "Gửi link đăng nhập"}
        </button>
        {error && <Notice kind="error">{error}</Notice>}
        {info && <Notice kind="ok">{info}</Notice>}
      </form>
    </main>
  );
}

/** Bước xác minh mã TOTP khi tài khoản đã bật MFA (mục 10.2). */
export function MfaChallenge() {
  const { refresh, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factor = data.totp.find((f) => f.status === "verified");
      if (!factor) throw new Error("Không tìm thấy thiết bị xác thực đã đăng ký.");
      const res = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
      if (res.error) throw res.error;
      await refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={(e) => void verify(e)}>
        <h1>Xác minh hai bước</h1>
        <p className="muted">Nhập mã 6 số từ ứng dụng xác thực.</p>
        <label>
          Mã xác thực
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Đang kiểm tra…" : "Xác minh"}
        </button>
        <button type="button" className="btn-link" onClick={() => void signOut()}>
          Đăng xuất
        </button>
        {error && <Notice kind="error">{error}</Notice>}
      </form>
    </main>
  );
}
