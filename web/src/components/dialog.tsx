import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

/** Hộp thoại xác nhận / nhập liệu thay cho window.confirm / window.prompt (dùng <dialog> gốc của trình duyệt). */
interface Request {
  kind: "confirm" | "prompt";
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  placeholder?: string;
  defaultValue?: string;
  resolve: (v: boolean | string | null) => void;
}

let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function open(req: Request) {
  current?.resolve(req.kind === "confirm" ? false : null); // chỉ một hộp thoại tại một thời điểm
  current = req;
  emit();
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => open({ kind: "confirm", ...opts, resolve: (v) => resolve(v === true) }));
}

export function promptDialog(
  opts: ConfirmOptions & { placeholder?: string; defaultValue?: string },
): Promise<string | null> {
  return new Promise((resolve) =>
    open({ kind: "prompt", ...opts, resolve: (v) => resolve(typeof v === "string" ? v : null) }),
  );
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function DialogHost() {
  const req = useSyncExternalStore(subscribe, () => current);
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req && !d.open) {
      setValue(req.defaultValue ?? "");
      d.showModal();
    } else if (!req && d.open) d.close();
  }, [req]);

  function finish(v: boolean | string | null) {
    const r = current;
    current = null;
    emit();
    r?.resolve(v);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!req) return;
    if (req.kind === "prompt") {
      const v = value.trim();
      if (!v) return;
      finish(v);
    } else finish(true);
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dlg-title"
      onCancel={(e) => {
        e.preventDefault();
        finish(req?.kind === "confirm" ? false : null);
      }}
    >
      {req && (
        <form onSubmit={submit}>
          <h2 id="dlg-title">{req.title}</h2>
          {req.message && <p>{req.message}</p>}
          {req.kind === "prompt" && (
            <input autoFocus value={value} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)} />
          )}
          <div className="actions">
            <button type="button" onClick={() => finish(req.kind === "confirm" ? false : null)}>
              {req.cancelLabel ?? "Huỷ"}
            </button>
            <button type="submit" className={req.danger ? "btn-danger" : "btn-primary"} autoFocus={req.kind === "confirm"}>
              {req.confirmLabel ?? "Đồng ý"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
