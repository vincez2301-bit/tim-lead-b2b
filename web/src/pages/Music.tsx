import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Pause, Play } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { Segment } from "../lib/api-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg } from "../lib/format";
import { getPlaylists, type Playlist } from "../lib/pipeline";
import { Badge, EmptyState, Notice, PageHeader, Spinner } from "../components/ui";
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
const KEY = "slf.music.excluded";

function loadExcluded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveExcluded(s: Set<string>) {
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
  const [excluded, setExcluded] = useState<Set<string>>(loadExcluded);
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

  function exclude(id: string) {
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      saveExcluded(n);
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
    const groups = p.segments?.length ? p.segments.map((s) => SEGMENT_LABEL[s]).join(", ") : "mọi nhóm khách";
    await writePlaylists(value, `Đã lưu playlist "${p.title.trim()}" — sẽ hiện trong khung deal của ${groups}.`);
  }

  const savePlaylist = (theme: Theme, url: string) =>
    upsertPlaylist({ title: theme.title, url, segments: theme.segments, note: theme.description });

  const shown = (themes ?? []).filter((t) => !segment || t.segments.includes(segment));
  return (
    <section>
      <PageHeader
        title="Nhạc mẫu"
        description="Danh sách nhạc Epidemic Sound đã lọc sẵn theo chủ đề. Nghe thử, bỏ bài không hợp, rồi tạo playlist trên Epidemic Sound và dán link vào đây để dùng khi gửi Zalo/email."
      />
      {error && <Notice kind="error">{error}</Notice>}
      {info && <Notice kind="ok">{info}</Notice>}
      <Library
        saved={saved}
        canEdit={isAdmin}
        onAdd={(p) => void upsertPlaylist(p)}
        onRemove={(title) => void writePlaylists(saved.filter((x) => x.title !== title), `Đã xoá playlist "${title}".`)}
      />
      <h2 className="section-title">Danh sách đã lọc theo chủ đề</h2>
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
        shown.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            excluded={excluded}
            playing={playing}
            onToggle={toggle}
            onExclude={exclude}
            saved={saved.find((p) => p.title === t.title)}
            canSave={isAdmin}
            onSave={(url) => void savePlaylist(t, url)}
          />
        ))
      )}
    </section>
  );
}

function ThemeCard({
  theme,
  excluded,
  playing,
  onToggle,
  onExclude,
  saved,
  canSave,
  onSave,
}: {
  theme: Theme;
  excluded: Set<string>;
  playing: string | null;
  onToggle: (t: Track) => void;
  onExclude: (id: string) => void;
  saved?: Playlist;
  canSave: boolean;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(saved?.url ?? "");
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(saved?.url ?? ""), [saved?.url]);
  const kept = theme.tracks.filter((x) => !excluded.has(x.id));
  const list = kept.map((x, i) => `${i + 1}. ${x.title} — ${x.artist}`).join("\n");

  return (
    <div className="card theme">
      <div className="row space-between">
        <div>
          <h2>
            {theme.title} <span className="count">{kept.length}</span>
          </h2>
          <div className="row small muted">
            {theme.segments.map((s) => (
              <Badge key={s} tone="blue">
                {SEGMENT_LABEL[s]}
              </Badge>
            ))}
            {theme.description && <span>{theme.description}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(`${theme.title}\n${list}`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          <Copy aria-hidden="true" /> {copied ? "Đã chép" : "Chép danh sách bài"}
        </button>
      </div>
      {theme.official && (
        <div className="official row space-between">
          <span className="small">
            Playlist chính thức trên Epidemic Sound: <SafeLink href={theme.official.url}>{theme.official.title}</SafeLink>
          </span>
          {canSave && (
            <button type="button" className="btn-link small" onClick={() => setUrl(theme.official!.url)}>
              Dùng link này
            </button>
          )}
        </div>
      )}
      <ol className="tracks">
        {theme.tracks.map((x) => {
          const off = excluded.has(x.id);
          return (
            <li key={x.id} className={off ? "off" : ""}>
              <button
                type="button"
                className="btn-icon play"
                aria-label={playing === x.id ? `Dừng ${x.title}` : `Nghe thử ${x.title}`}
                onClick={() => onToggle(x)}
              >
                {playing === x.id ? <Pause /> : <Play />}
              </button>
              <div className="track-main">
                <strong>{x.title}</strong>
                <span className="small muted">
                  {x.artist} · {x.bpm} BPM · {mmss(x.duration_s)}
                  {x.vocals ? " · có lời" : ""}
                </span>
              </div>
              <span className="track-tags small muted">{[...(x.moods ?? []), ...(x.genres ?? [])].slice(0, 4).join(" · ")}</span>
              <button type="button" className="btn-link small" onClick={() => onExclude(x.id)}>
                {off ? "Giữ lại" : "Bỏ"}
              </button>
            </li>
          );
        })}
      </ol>
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
          placeholder="Dán link playlist Epidemic Sound sau khi tạo (https://…)"
          disabled={!canSave}
        />
        <button type="submit" className="btn-primary" disabled={!canSave || !url.trim()}>
          {saved ? "Cập nhật" : "Lưu vào thư viện"}
        </button>
      </form>
    </div>
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
    <div className="card">
      <h2>
        Thư viện playlist <span className="count">{saved.length}</span>
      </h2>
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
    </div>
  );
}
