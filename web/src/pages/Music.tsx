import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Pause, Play } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { Segment } from "../lib/api-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg } from "../lib/format";
import { getPlaylists, type Playlist } from "../lib/pipeline";
import { EmptyState, Notice, PageHeader, Spinner } from "../components/ui";
import { SafeLink } from "../components/SafeLink";

interface Track {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration_s: number;
  moods?: string[];
  genres?: string[];
  vocals?: boolean;
  preview: string;
}
interface Theme {
  id: string;
  title: string;
  segments: Segment[];
  description?: string;
  official?: { title: string; url: string };
  tracks: Track[];
}

const PREVIEW_HOST = /^https:\/\/audiocdn\.epidemicsound\.com\//;
const KEY = "slf.music.added";

function loadAdded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveAdded(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* trình duyệt chặn bộ nhớ: bỏ qua */
  }
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function MusicPage() {
  const { isAdmin } = useAuth();
  const { settings, reload } = useSettings();
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment | "">("");
  const [added, setAdded] = useState<Set<string>>(loadAdded);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const saved = useMemo(() => getPlaylists(settings), [settings]);

  useEffect(() => {
    fetch("/music-themes.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Theme[]) => setThemes(Array.isArray(d) ? d : []))
      .catch((e) => setError(`Không tải được danh sách nhạc: ${errMsg(e)}`));
    return () => audio.current?.pause();
  }, []);

  function toggle(t: Track) {
    if (!PREVIEW_HOST.test(t.preview)) return;
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.addEventListener("ended", () => setPlaying(null));
    }
    if (playing === t.id) {
      audio.current.pause();
      setPlaying(null);
      return;
    }
    audio.current.src = t.preview;
    void audio.current.play().catch((e) => setError(`Không phát được: ${errMsg(e)}`));
    setPlaying(t.id);
  }

  function mark(id: string) {
    setAdded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      saveAdded(n);
      return n;
    });
  }

  async function writePlaylists(value: Playlist[], msg: string) {
    setError(null);
    const { error } = await supabase.from("settings").upsert({ key: "playlists", value });
    if (error) return setError(error.message);
    setInfo(msg);
    await reload();
  }

  async function upsertPlaylist(p: Playlist) {
    const url = p.url.trim();
    if (!/^https?:\/\//.test(url)) return setError("Link playlist phải bắt đầu bằng https://");
    if (!p.title.trim()) return setError("Cần đặt tên playlist.");
    const value = [...saved.filter((x) => x.title !== p.title.trim()), { ...p, title: p.title.trim(), url }];
    await writePlaylists(value, `Đã lưu playlist "${p.title.trim()}".`);
  }

  const all = themes ?? [];
  const shown = all.filter((t) => !segment || t.segments.includes(segment));
  const total = all.reduce((n, t) => n + t.tracks.length, 0);
  const done = all.reduce((n, t) => n + t.tracks.filter((x) => added.has(x.id)).length, 0);
  return (
    <section>
      <PageHeader
        title="Nhạc mẫu"
        description="Mỗi chủ đề 10 bài đã lọc sẵn. Mở chủ đề, nghe thử, thêm bài vào playlist trên tài khoản Epidemic Sound của công ty rồi tích “đã thêm”. Xong thì dán link playlist vào chủ đề đó."
        actions={themes && <span className="badge">{done}/{total} bài đã thêm</span>}
      />
      {error && <Notice kind="error">{error}</Notice>}
      {info && <Notice kind="ok">{info}</Notice>}
      <div className="chips seg-filter">
        <button type="button" className={segment === "" ? "chip on" : "chip"} onClick={() => setSegment("")}>
          Tất cả
        </button>
        {SEGMENTS.map((s) => (
          <button key={s} type="button" className={segment === s ? "chip on" : "chip"} onClick={() => setSegment(s)}>
            {SEGMENT_LABEL[s]}
          </button>
        ))}
      </div>
      {!themes ? (
        !error && <Spinner />
      ) : themes.length === 0 ? (
        <div className="card">
          <EmptyState title="Chưa có danh sách nhạc">Danh sách nhạc theo chủ đề đang được chuẩn bị.</EmptyState>
        </div>
      ) : (
        <div className="themes">
          {shown.map((t) => (
            <ThemeRow
              key={t.id}
              theme={t}
              added={added}
              playing={playing}
              onToggle={toggle}
              onMark={mark}
              saved={saved.find((p) => p.title === t.title)}
              canSave={isAdmin}
              onSave={(url) => void upsertPlaylist({ title: t.title, url, segments: t.segments, note: t.description })}
            />
          ))}
        </div>
      )}
      <Library
        saved={saved}
        canEdit={isAdmin}
        onAdd={(p) => void upsertPlaylist(p)}
        onRemove={(title) => void writePlaylists(saved.filter((x) => x.title !== title), `Đã xoá playlist "${title}".`)}
      />
    </section>
  );
}

function ThemeRow({
  theme,
  added,
  playing,
  onToggle,
  onMark,
  saved,
  canSave,
  onSave,
}: {
  theme: Theme;
  added: Set<string>;
  playing: string | null;
  onToggle: (t: Track) => void;
  onMark: (id: string) => void;
  saved?: Playlist;
  canSave: boolean;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(saved?.url ?? "");
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(saved?.url ?? ""), [saved?.url]);
  const n = theme.tracks.filter((x) => added.has(x.id)).length;
  const complete = n === theme.tracks.length;
  const list = theme.tracks.map((x, i) => `${i + 1}. ${x.title} — ${x.artist}`).join("\n");

  return (
    <details className={complete ? "theme done" : "theme"}>
      <summary>
        <span className="theme-title">{theme.title}</span>
        <span className="small muted theme-segs">{theme.segments.map((s) => SEGMENT_LABEL[s]).join(" · ")}</span>
        {saved && <span className="badge badge-green">Đã có link</span>}
        <span className={complete ? "badge badge-green" : "badge"}>
          {n}/{theme.tracks.length}
        </span>
      </summary>
      {theme.description && <p className="small muted theme-desc">{theme.description}</p>}
      {theme.official && (
        <p className="small official">
          Có playlist chính thức: <SafeLink href={theme.official.url}>{theme.official.title}</SafeLink>
          {canSave && (
            <button type="button" className="btn-link small" onClick={() => setUrl(theme.official!.url)}>
              Dùng link này
            </button>
          )}
        </p>
      )}
      <ol className="tracks compact">
        {theme.tracks.map((x) => (
          <li key={x.id} className={added.has(x.id) ? "added" : ""}>
            <button
              type="button"
              className="btn-icon play"
              aria-label={playing === x.id ? `Dừng ${x.title}` : `Nghe thử ${x.title}`}
              onClick={() => onToggle(x)}
            >
              {playing === x.id ? <Pause /> : <Play />}
            </button>
            <label className="track-check">
              <input type="checkbox" checked={added.has(x.id)} onChange={() => onMark(x.id)} />
              <span>
                <strong>{x.title}</strong> <span className="muted">— {x.artist}</span>
              </span>
            </label>
            <span className="small muted track-meta">
              {x.bpm} BPM · {mmss(x.duration_s)}
            </span>
          </li>
        ))}
      </ol>
      <div className="row theme-foot">
        <button
          type="button"
          className="btn-link small"
          onClick={() =>
            void navigator.clipboard?.writeText(`${theme.title}\n${list}`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          <Copy aria-hidden="true" /> {copied ? "Đã chép" : "Chép tên 10 bài"}
        </button>
        <form
          className="row playlist-link"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(url);
          }}
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link playlist trên tài khoản công ty"
            disabled={!canSave}
          />
          <button type="submit" disabled={!canSave || !url.trim()}>
            {saved ? "Cập nhật link" : "Lưu link"}
          </button>
        </form>
      </div>
    </details>
  );
}

// ------------------------------------------------------------------ Thư viện playlist đã lưu (dùng trong khung deal)
function Library({
  saved,
  canEdit,
  onAdd,
  onRemove,
}: {
  saved: Playlist[];
  canEdit: boolean;
  onAdd: (p: Playlist) => void;
  onRemove: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [segs, setSegs] = useState<Segment[]>([]);
  return (
    <details className="card library">
      <summary>
        <strong>Thư viện playlist</strong> <span className="count">{saved.length}</span>
        <span className="small muted"> — playlist hiện trong khung deal; thêm playlist khác lấy từ trang chủ Epidemic</span>
      </summary>
      <p className="small muted">
        Playlist ở đây hiện trong mục “Playlist gợi ý” của khung deal, lọc theo nhóm khách. Ưu tiên playlist chính thức trên trang
        chủ Epidemic Sound: mở playlist → Chia sẻ → chép link → dán vào đây.
      </p>
      {saved.length > 0 && (
        <ul className="snippets">
          {saved.map((p) => (
            <li key={p.title} className="row space-between nowrap">
              <span className="small">
                <SafeLink href={p.url}>{p.title}</SafeLink>{" "}
                <span className="muted">
                  · {p.segments?.length ? p.segments.map((x) => SEGMENT_LABEL[x]).join(", ") : "mọi nhóm"}
                </span>
              </span>
              {canEdit && (
                <button type="button" className="btn-link small" onClick={() => onRemove(p.title)}>
                  Xoá
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd({ title, url, segments: segs });
            setTitle("");
            setUrl("");
            setSegs([]);
          }}
        >
          <div className="form-grid">
            <label>
              Tên playlist
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="vd. Epidemic – Cinematic Documentary" />
            </label>
            <label>
              Link
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.epidemicsound.com/…" />
            </label>
          </div>
          <div className="chips" role="group" aria-label="Nhóm khách">
            {SEGMENTS.map((x) => (
              <button
                key={x}
                type="button"
                className={segs.includes(x) ? "chip on" : "chip"}
                aria-pressed={segs.includes(x)}
                onClick={() => setSegs((v) => (v.includes(x) ? v.filter((y) => y !== x) : [...v, x]))}
              >
                {SEGMENT_LABEL[x]}
              </button>
            ))}
          </div>
          <div className="row">
            <button type="submit" className="btn-primary" disabled={!title.trim() || !url.trim()}>
              Thêm vào thư viện
            </button>
            <span className="small muted">Không chọn nhóm = hiện cho mọi nhóm khách.</span>
          </div>
        </form>
      )}
    </details>
  );
}
