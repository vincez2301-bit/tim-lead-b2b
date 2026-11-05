import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { Segment } from "../lib/api-types";
import { SEGMENTS, SEGMENT_LABEL } from "../lib/format";
import {
  CHANNEL_LABEL,
  LOST_REASONS,
  LOST_REASON_LABEL,
  LOST_REASON_RULE,
  OBJECTION_TOPICS,
  OBJECTION_TOPIC_LABEL,
  STAGE_LABEL,
  foldVi,
  mergeObjections,
  objectionTopic,
  parseObjectionFile,
  type ObjectionTopic,
  dueState,
  fmtDay,
  getCadence,
  getPlaybook,
  getSender,
  getTemplates,
  renderTemplate,
  signature,
  type Channel,
  type DealRow,
  type LostReason,
  type MessageTemplate,
  type Objection,
} from "../lib/pipeline";
import { Badge, CopyButton, EmptyState, Notice, PageHeader, Spinner, TableWrap } from "../components/ui";
import { DealPanel } from "../components/DealPanel";
import { confirmDialog } from "../components/dialog";

const VARS: [string, string][] = [
  ["{ten}", "tên người nhận"],
  ["{cong_ty}", "tên công ty khách"],
  ["{playlist}", "link playlist hợp nhóm khách"],
  ["{nguoi_gui}", "tên bạn"],
  ["{chuc_danh}", "chức danh"],
  ["{cong_ty_ban}", "công ty bạn"],
  ["{sdt}", "số điện thoại"],
  ["{chu_ky}", "chữ ký đầy đủ"],
];
const MSG_CHANNELS: Channel[] = ["email", "zalo", "call", "linkedin", "meeting"];
const NURTURE_STEP = 90;

function SegChips({ value, onChange, allLabel }: { value: Segment | ""; onChange: (s: Segment | "") => void; allLabel: string }) {
  return (
    <div className="chips" role="group" aria-label="Nhóm khách">
      <button type="button" className={value === "" ? "chip on" : "chip"} aria-pressed={value === ""} onClick={() => onChange("")}>
        {allLabel}
      </button>
      {SEGMENTS.map((s) => (
        <button key={s} type="button" className={value === s ? "chip on" : "chip"} aria-pressed={value === s} onClick={() => onChange(s)}>
          {SEGMENT_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

// ================================================================== Email & tin nhắn mẫu
export function EmailLibraryPage() {
  const { isAdmin } = useAuth();
  const { settings, loading, save } = useSettings();
  const templates = getTemplates(settings);
  const cadence = getCadence(settings);
  const sender = getSender(settings);
  const [segment, setSegment] = useState<Segment | "">("");
  const [channel, setChannel] = useState<Channel | "">("");
  const [preview, setPreview] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<MessageTemplate | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const sample: Record<string, string> = {
    ten: "anh Minh",
    cong_ty: segment === "mcn" ? "Yeah1 Network" : segment === "brand" ? "Vinamilk" : "HTV9",
    playlist: "https://www.epidemicsound.com/playlists/…",
    nguoi_gui: sender.name || "[Tên bạn]",
    chuc_danh: sender.title,
    cong_ty_ban: sender.company,
    sdt: sender.phone || "[số điện thoại]",
    chu_ky: signature(sender),
  };
  const show = (t: string) => (preview ? renderTemplate(t, sample) : t);

  // Gom mẫu theo bước của lịch 19 điểm chạm (bước 90 = nuôi dưỡng sau khi từ chối).
  const groups = useMemo(() => {
    const list = templates
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => !segment || t.segment === segment || t.segment === "all" || (segment === "film" && t.segment === "agency"))
      .filter(({ t }) => !channel || t.channel === channel);
    const steps = [...new Set(list.map(({ t }) => t.step))].sort((a, b) => a - b);
    return steps.map((step) => ({
      step,
      cad: cadence.find((c) => c.step === step),
      items: list.filter(({ t }) => t.step === step),
    }));
  }, [templates, cadence, segment, channel]);

  async function persist(next: MessageTemplate[], ok: string) {
    const err = await save("message_templates", next);
    setMsg(err ? { kind: "error", text: err } : { kind: "ok", text: ok });
    if (!err) {
      setEditing(null);
      setDraft(null);
    }
  }
  function startEdit(i: number | "new", base?: Partial<MessageTemplate>) {
    setMsg(null);
    setEditing(i);
    setDraft(
      i === "new"
        ? { step: base?.step ?? 2, channel: base?.channel ?? "email", segment: segment || "all", title: "", subject: "", body: "" }
        : { ...templates[i] },
    );
  }

  if (loading) return <Spinner />;

  const editor = (
    <TemplateEditor
      draft={draft}
      setDraft={setDraft}
      cadence={cadence.map((c) => ({ step: c.step, label: `Bước ${c.step} · ngày ${c.day} · ${c.title}` }))}
      onCancel={() => {
        setEditing(null);
        setDraft(null);
      }}
      onSave={() => {
        if (!draft || !draft.title.trim() || !draft.body.trim()) {
          setMsg({ kind: "error", text: "Cần tiêu đề mẫu và nội dung." });
          return;
        }
        const clean = { ...draft, subject: draft.channel === "email" ? draft.subject : undefined };
        const next = editing === "new" ? [...templates, clean] : templates.map((t, i) => (i === editing ? clean : t));
        void persist(next, "Đã lưu mẫu.");
      }}
    />
  );

  return (
    <section>
      <PageHeader
        title="Email & tin nhắn mẫu"
        description="Nội dung cho từng bước trong lịch 19 điểm chạm. Khi bạn mở một khách ở Hôm nay, app tự chọn đúng mẫu theo bước và nhóm khách, điền tên, công ty, playlist và chữ ký."
        actions={
          isAdmin && (
            <button type="button" className="btn-primary" onClick={() => startEdit("new")}>
              <Plus aria-hidden="true" /> Thêm mẫu
            </button>
          )
        }
      />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="card filters-card">
        <SegChips value={segment} onChange={setSegment} allLabel="Mọi nhóm khách" />
        <div className="row space-between">
          <div className="chips" role="group" aria-label="Kênh">
            <button type="button" className={channel === "" ? "chip on" : "chip"} onClick={() => setChannel("")}>
              Mọi kênh
            </button>
            {MSG_CHANNELS.map((c) => (
              <button key={c} type="button" className={channel === c ? "chip on" : "chip"} onClick={() => setChannel(c)}>
                {CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>
          <label className="checkbox inline">
            <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
            Xem trước với ví dụ
          </label>
        </div>
        <details className="vars">
          <summary className="small">Các biến app tự điền</summary>
          <div className="var-list">
            {VARS.map(([k, v]) => (
              <span key={k} className="small">
                <code>{k}</code> {v}
              </span>
            ))}
          </div>
        </details>
      </div>

      {editing === "new" && editor}

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState title="Không có mẫu cho bộ lọc này." />
        </div>
      ) : (
        <ol className="tpl-steps">
          {groups.map(({ step, cad, items }) => (
            <li key={step} className="tpl-step">
              <div className="tpl-step-head">
                <span className="step-no">{step === NURTURE_STEP ? "↺" : step}</span>
                <div>
                  <strong>{step === NURTURE_STEP ? "Nuôi dưỡng — sau khi khách từ chối" : (cad?.title ?? `Bước ${step}`)}</strong>
                  <span className="small muted">
                    {step === NURTURE_STEP ? "Gửi vào ngày hẹn liên hệ lại" : cad ? `Ngày ${cad.day} · ${CHANNEL_LABEL[cad.channel]}` : ""}
                  </span>
                </div>
              </div>
              <div className="tpl-items">
                {items.map(({ t, i }) =>
                  editing === i ? (
                    <div key={i}>{editor}</div>
                  ) : (
                    <article key={i} className="card template">
                      <header className="row space-between nowrap">
                        <div className="row">
                          <Badge tone="blue">{CHANNEL_LABEL[t.channel]}</Badge>
                          <Badge>{t.segment === "all" ? "Mọi nhóm" : SEGMENT_LABEL[t.segment]}</Badge>
                          <strong>{t.title}</strong>
                        </div>
                        <div className="row nowrap">
                          <CopyButton text={(t.subject ? `${show(t.subject)}\n\n` : "") + show(t.body)} />
                          {isAdmin && (
                            <>
                              <button type="button" className="btn-link small" onClick={() => startEdit(i)}>
                                <Pencil aria-hidden="true" /> Sửa
                              </button>
                              <button
                                type="button"
                                className="btn-link small danger"
                                aria-label={`Xoá mẫu ${t.title}`}
                                onClick={async () => {
                                  if (await confirmDialog({ title: `Xoá mẫu “${t.title}”?`, confirmLabel: "Xoá", danger: true }))
                                    void persist(templates.filter((_, j) => j !== i), "Đã xoá mẫu.");
                                }}
                              >
                                <Trash2 aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </header>
                      {t.subject && (
                        <p className="subject">
                          <span className="muted">Tiêu đề:</span> {show(t.subject)}
                        </p>
                      )}
                      <div className={expanded.has(i) || t.body.length < 320 ? "template-body pre-wrap" : "template-body pre-wrap clamp"}>
                        {show(t.body)}
                      </div>
                      {t.body.length >= 320 && (
                        <button
                          type="button"
                          className="btn-link small"
                          onClick={() =>
                            setExpanded((s) => {
                              const n = new Set(s);
                              if (n.has(i)) n.delete(i);
                              else n.add(i);
                              return n;
                            })
                          }
                        >
                          {expanded.has(i) ? "Thu gọn" : "Xem đủ nội dung"}
                        </button>
                      )}
                    </article>
                  ),
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function TemplateEditor({
  draft,
  setDraft,
  cadence,
  onCancel,
  onSave,
}: {
  draft: MessageTemplate | null;
  setDraft: (d: MessageTemplate) => void;
  cadence: { step: number; label: string }[];
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!draft) return null;
  const set = (patch: Partial<MessageTemplate>) => setDraft({ ...draft, ...patch });
  return (
    <div className="card editor">
      <div className="form-grid">
        <label>
          Bước
          <select value={draft.step} onChange={(e) => set({ step: Number(e.target.value) })}>
            {cadence.map((c) => (
              <option key={c.step} value={c.step}>
                {c.label}
              </option>
            ))}
            <option value={NURTURE_STEP}>Nuôi dưỡng (sau khi từ chối)</option>
          </select>
        </label>
        <label>
          Kênh
          <select value={draft.channel} onChange={(e) => set({ channel: e.target.value as Channel })}>
            {MSG_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nhóm khách
          <select value={draft.segment} onChange={(e) => set({ segment: e.target.value as Segment | "all" })}>
            <option value="all">Mọi nhóm</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tên mẫu
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="VD: Email mở lời — đài truyền hình" />
        </label>
      </div>
      {draft.channel === "email" && (
        <label>
          Tiêu đề email
          <input value={draft.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} />
        </label>
      )}
      <label>
        Nội dung
        <textarea rows={12} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
      </label>
      <div className="row">
        <button type="button" className="btn-primary" onClick={onSave}>
          Lưu mẫu
        </button>
        <button type="button" onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </div>
  );
}

// ================================================================== Xử lý từ chối
const EMPTY_OBJECTION: Objection = { reason: "other", topic: "price", title: "", short: "", text: "" };

export function ObjectionLibraryPage() {
  const { isAdmin } = useAuth();
  const { settings, loading, save } = useSettings();
  const playbook = getPlaybook(settings);
  const [params, setParams] = useSearchParams();
  const openId = params.get("deal");
  const [topic, setTopic] = useState<ObjectionTopic | "">("");
  const [q, setQ] = useState("");
  const [onlyCheck, setOnlyCheck] = useState(false);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Objection | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);
  const [rejected, setRejected] = useState<DealRow[] | null>(null);
  const [reasonFilter, setReasonFilter] = useState<LostReason | "">("");

  const loadRejected = useCallback(async () => {
    const { data } = await supabase
      .from("deal_board")
      .select("*")
      .in("stage", ["nurture", "lost"])
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .limit(500);
    setRejected((data ?? []) as DealRow[]);
  }, []);
  useEffect(() => {
    void loadRejected();
  }, [loadRejected]);

  async function persist(next: Objection[], ok: string) {
    const err = await save("objection_playbook", next);
    setMsg(err ? { kind: "error", text: err } : { kind: "ok", text: ok });
    if (!err) {
      setEditing(null);
      setDraft(null);
    }
  }

  async function importFile(file: File) {
    setMsg(null);
    try {
      const incoming = parseObjectionFile(await file.text());
      if (!incoming.length) return setMsg({ kind: "warn", text: "File không có câu trả lời nào đọc được." });
      const { list, added, updated } = mergeObjections(playbook, incoming);
      const ok = await confirmDialog({
        title: `Nhập ${incoming.length} câu trả lời?`,
        message: `Thêm mới ${added} câu, thay ${updated} câu trùng tiêu đề. Các câu khác giữ nguyên.`,
        confirmLabel: "Nhập",
      });
      if (ok) await persist(list, `Đã nhập: thêm ${added}, cập nhật ${updated}.`);
    } catch (e) {
      setMsg({ kind: "error", text: `Không đọc được file: ${(e as Error).message}` });
    }
  }

  const items = useMemo(() => {
    const f = foldVi(q.trim());
    return playbook
      .map((o, i) => ({ o, i, t: objectionTopic(o) }))
      .filter(({ o }) => !onlyCheck || o.check || o.draft)
      .filter(({ o }) => !f || foldVi(`${o.title} ${o.short ?? ""} ${o.text}`).includes(f));
  }, [playbook, q, onlyCheck]);
  const count = (t: ObjectionTopic) => items.filter((x) => x.t === t).length;
  const topics = (topic ? [topic] : OBJECTION_TOPICS).filter((t) => count(t) > 0 || (editing === "new" && draft?.topic === t));
  const people = (rejected ?? []).filter((d) => !reasonFilter || (d.lost_reason_code ?? "other") === reasonFilter);

  if (loading) return <Spinner />;

  const editor = draft && (
    <div className="card editor">
      <div className="form-grid">
        <label>
          Chủ đề
          <select value={draft.topic ?? "price"} onChange={(e) => setDraft({ ...draft, topic: e.target.value as ObjectionTopic })}>
            {OBJECTION_TOPICS.map((t) => (
              <option key={t} value={t}>
                {OBJECTION_TOPIC_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Khách nói gì
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="VD: “Bên anh dùng nhạc miễn phí”" />
        </label>
      </div>
      <label>
        Câu trả lời ngắn (khi gọi điện / nhắn Zalo)
        <textarea rows={3} value={draft.short ?? ""} onChange={(e) => setDraft({ ...draft, short: e.target.value })} />
      </label>
      <label>
        Câu trả lời đầy đủ (email / văn bản)
        <textarea rows={8} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
      </label>
      <label>
        Cần kiểm tra trước khi dùng (để trống nếu đã ổn)
        <input value={draft.check ?? ""} onChange={(e) => setDraft({ ...draft, check: e.target.value })} />
      </label>
      <div className="row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const clean: Objection = {
              ...draft,
              title: draft.title.trim(),
              short: draft.short?.trim() || undefined,
              text: draft.text.trim() || draft.short?.trim() || "",
              check: draft.check?.trim() || undefined,
              draft: draft.check?.trim() ? draft.draft : undefined,
            };
            if (!clean.title || !clean.text) return setMsg({ kind: "error", text: "Cần ghi khách nói gì và ít nhất một câu trả lời." });
            void persist(editing === "new" ? [...playbook, clean] : playbook.map((o, i) => (i === editing ? clean : o)), "Đã lưu.");
          }}
        >
          Lưu
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDraft(null);
          }}
        >
          Huỷ
        </button>
      </div>
    </div>
  );

  return (
    <section>
      <PageHeader
        title="Xử lý từ chối"
        description="Khách nói gì — mình trả lời gì. Câu ngắn để nói khi gọi hoặc nhắn Zalo, bản đầy đủ để gửi email."
        actions={
          isAdmin && (
            <>
              <label className="btn file-btn">
                <Upload aria-hidden="true" /> Nhập từ file
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void importFile(f);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditing("new");
                  setDraft({ ...EMPTY_OBJECTION, topic: topic || "price" });
                }}
              >
                <Plus aria-hidden="true" /> Thêm câu trả lời
              </button>
            </>
          )
        }
      />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="card filters-card">
        <div className="row">
          <input className="grow search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm: đắt, hợp đồng, VCPMC, độc quyền… (gõ không dấu cũng được)" aria-label="Tìm câu trả lời" />
          <label className="checkbox inline">
            <input type="checkbox" checked={onlyCheck} onChange={(e) => setOnlyCheck(e.target.checked)} />
            Chỉ mục cần kiểm tra
          </label>
        </div>
        <div className="chips" role="group" aria-label="Chủ đề">
          <button type="button" className={topic === "" ? "chip on" : "chip"} onClick={() => setTopic("")}>
            Tất cả <span className="chip-count">{items.length}</span>
          </button>
          {OBJECTION_TOPICS.map((t) => (
            <button key={t} type="button" className={topic === t ? "chip on" : "chip"} onClick={() => setTopic(t)}>
              {OBJECTION_TOPIC_LABEL[t]} <span className="chip-count">{count(t)}</span>
            </button>
          ))}
        </div>
      </div>
      {editing === "new" && editor}

      {playbook.length === 0 ? (
        <div className="card">
          <EmptyState title="Chưa có câu trả lời mẫu.">Bấm “Nhập từ file” để nạp bộ kịch bản, hoặc “Thêm câu trả lời”.</EmptyState>
        </div>
      ) : topics.length === 0 ? (
        <div className="card">
          <EmptyState title="Không có câu trả lời khớp bộ lọc." />
        </div>
      ) : (
        topics.map((t) => (
          <div key={t} className="card reason-block">
            <h2>
              {OBJECTION_TOPIC_LABEL[t]} <span className="count">{count(t)}</span>
            </h2>
            <div className="objections">
              {items
                .filter((x) => x.t === t)
                .map(({ o, i }) =>
                  editing === i ? (
                    <div key={i}>{editor}</div>
                  ) : (
                    <article key={i} className="objection">
                      <div className="row space-between nowrap">
                        <div className="row">
                          <strong>{o.title}</strong>
                          {o.draft && <Badge tone="orange">Bản nháp</Badge>}
                        </div>
                        <div className="row nowrap">
                          <CopyButton text={o.short ?? o.text} label={o.short ? "Chép câu ngắn" : "Chép"} />
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                className="btn-link small"
                                onClick={() => {
                                  setEditing(i);
                                  setDraft({ ...o, topic: objectionTopic(o) });
                                }}
                              >
                                <Pencil aria-hidden="true" /> Sửa
                              </button>
                              <button
                                type="button"
                                className="btn-link small danger"
                                aria-label={`Xoá ${o.title}`}
                                onClick={async () => {
                                  if (await confirmDialog({ title: `Xoá “${o.title}”?`, confirmLabel: "Xoá", danger: true }))
                                    void persist(playbook.filter((_, j) => j !== i), "Đã xoá.");
                                }}
                              >
                                <Trash2 aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="say">{o.short ?? o.text}</p>
                      {o.short && o.text !== o.short && (
                        <details className="full">
                          <summary className="small">Câu trả lời đầy đủ (email)</summary>
                          <div className="pre-wrap small-body">{o.text}</div>
                          <CopyButton text={o.text} label="Chép bản đầy đủ" />
                        </details>
                      )}
                      {o.check && <p className="small check">Cần kiểm tra: {o.check}</p>}
                      {o.source && <p className="small muted">{o.source}</p>}
                    </article>
                  ),
                )}
            </div>
          </div>
        ))
      )}

      <div className="card">
        <div className="row space-between">
          <h2>
            Khách đã từ chối <span className="count">{rejected?.length ?? 0}</span>
          </h2>
          <select className="input-sm" value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value as LostReason | "")} aria-label="Lọc theo lý do">
            <option value="">Mọi lý do</option>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {LOST_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <p className="small muted">
          Khi khách từ chối: mở khách → tab Điểm chạm → “Khách từ chối…”. App ghi lý do và tự hẹn ngày liên hệ lại.
        </p>
        {!rejected ? (
          <Spinner />
        ) : people.length === 0 ? (
          <EmptyState title="Chưa có khách nào trong nhóm này." />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Công ty</th>
                  <th>Lý do</th>
                  <th>Chi tiết</th>
                  <th>Liên hệ lại</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {people.map((d) => {
                  const r = (d.lost_reason_code ?? "other") as LostReason;
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.company_name}</strong>
                        <div className="small muted">
                          {d.segment ? SEGMENT_LABEL[d.segment] : "—"} · {STAGE_LABEL[d.stage]}
                        </div>
                      </td>
                      <td className="small" title={LOST_REASON_RULE[r]}>
                        {LOST_REASON_LABEL[r]}
                      </td>
                      <td className="small">
                        {d.competitor ? `Đang dùng: ${d.competitor}` : ""}
                        {d.contract_end ? ` · hết HĐ ${fmtDay(d.contract_end)}` : ""}
                      </td>
                      <td>
                        <span className={`due due-${dueState(d.next_action_at)} small`}>{fmtDay(d.next_action_at)}</span>
                      </td>
                      <td>
                        <button type="button" className="btn-sm" onClick={() => setParams({ deal: d.id, tab: "touches" })}>
                          Mở
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>
      {openId && (
        <DealPanel
          dealId={openId}
          initialTab={(params.get("tab") as "touches" | null) ?? "touches"}
          onClose={() => setParams({})}
          onChanged={() => void loadRejected()}
        />
      )}
    </section>
  );
}
