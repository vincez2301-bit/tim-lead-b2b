import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Briefcase,
  Camera,
  Clapperboard,
  Copy,
  Film,
  Gamepad2,
  Gem,
  Heart,
  Laugh,
  Newspaper,
  Pause,
  Plane,
  Play,
  Rocket,
  Sparkles,
  Trophy,
  Tv,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { Segment } from "../lib/api-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg } from "../lib/format";
import { getPlaylists, type Playlist } from "../lib/pipeline";
import { mmss, toneFor, type Theme, type Track } from "../lib/music";
import { EmptyState, Notice, PageHeader, Spinner } from "../components/ui";
import { SafeLink } from "../components/SafeLink";
import { usePlayer } from "../components/Player";

const ICON: Record<string, LucideIcon> = {
  "bt-news": Newspaper,
  "bt-sports": Trophy,
  "bt-doc": Film,
  "bt-gameshow": Tv,
  "bt-tet": Sparkles,
  "mcn-vlog": Camera,
  "mcn-gaming": Gamepad2,
  "mcn-food": UtensilsCrossed,
  "mcn-beauty": Gem,
  "mcn-comedy": Laugh,
  "ph-tvc-emotional": Heart,
  "ph-corporate": Briefcase,
  "ph-luxury": Gem,
  "ph-travel": Plane,
  "film-trailer": Clapperboard,
  "br-launch": Rocket,
};
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

export function MusicPage() {
  const { isAdmin } = useAuth();
  const { settings, reload } = useSettings();
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment | "">("");
  const [selected, setSelected] = useState<string>("");
  const [added, setAdded] = useState<Set<string>>(loadAdded);
  const saved = useMemo(() => getPlaylists(settings), [settings]);

  useEffect(() => {
    fetch("/music-themes.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Theme[]) => {
        const list = Array.isArray(d) ? d : [];
        setThemes(list);
        setSelected((s) => s || list[0]?.id || "");
      })
      .catch((e) => setError(`Không tải được danh sách nhạc: ${errMsg(e)}`));
  }, []);

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
  const theme = shown.find((t) => t.id === selected) ?? shown[0];
  const total = all.reduce((n, t) => n + t.tracks.length, 0);
  const done = all.reduce((n, t) => n + t.tracks.filter((x) => added.has(x.id)).length, 0);

  return (
    <section className="music">
      <PageHeader
        title="Nhạc mẫu"
        description="16 chủ đề × 10 bài lọc sẵn từ Epidemic Sound. Nghe thử, tua đến đoạn muốn nghe, thêm vào playlist trên tài khoản công ty rồi tích “Đã thêm”."
        actions={
          themes && (
            <div className="music-progress">
              <span>
                <strong>{done}</strong>/{total} bài đã thêm
              </span>
              <span className="bar">
                <span style={{ width: `${total ? (100 * done) / total : 0}%` }} />
              </span>
            </div>
          )
        }
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
          <EmptyState title="Chưa có danh sách nhạc" />
        </div>
      ) : (
        <>
          <div className="theme-grid">
            {shown.map((t) => {
              const Icon = ICON[t.id] ?? Sparkles;
              const n = t.tracks.filter((x) => added.has(x.id)).length;
              const hasLink = saved.some((p) => p.title === t.title);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={theme?.id === t.id ? "theme-card active" : "theme-card"}
                  style={{ ["--tone" as string]: toneFor(t.id) } as CSSProperties}
                  onClick={() => setSelected(t.id)}
                  aria-pressed={theme?.id === t.id}
                >
                  <Icon className="theme-icon" aria-hidden="true" />
                  <span className="theme-name">{t.title}</span>
                  <span className="theme-meta">
                    {n}/{t.tracks.length} đã thêm{hasLink ? " · có link" : ""}
                  </span>
                  <span className="theme-bar">
                    <span style={{ width: `${(100 * n) / Math.max(1, t.tracks.length)}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
          {theme && (
            <ThemeDetail
              key={theme.id}
              theme={theme}
              icon={ICON[theme.id] ?? Sparkles}
              added={added}
              onMark={mark}
              saved={saved.find((p) => p.title === theme.title)}
              canSave={isAdmin}
              onSave={(url) => void upsertPlaylist({ title: theme.title, url, segments: theme.segments, note: theme.description })}
            />
          )}
        </>
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

function Equalizer() {
  return (
    <span className="eq" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function ThemeDetail({
  theme,
  icon: Icon,
  added,
  onMark,
  saved,
  canSave,
  onSave,
}: {
  theme: Theme;
  icon: LucideIcon;
  added: Set<string>;
  onMark: (id: string) => void;
  saved?: Playlist;
  canSave: boolean;
  onSave: (url: string) => void;
}) {
  const player = usePlayer();
  const [url, setUrl] = useState(saved?.url ?? "");
  const [copied, setCopied] = useState(false);
  const n = theme.tracks.filter((x) => added.has(x.id)).length;
  const list = theme.tracks.map((x, i) => `${i + 1}. ${x.title} — ${x.artist}`).join("\n");
  const isCurrent = (t: Track) => player.current?.id === t.id;
  const themePlaying = theme.tracks.some((t) => isCurrent(t)) && player.playing;

  return (
    <div className="card theme-detail" style={{ ["--tone" as string]: toneFor(theme.id) } as CSSProperties}>
      <div className="theme-hero">
        <Icon className="hero-icon" aria-hidden="true" />
        <div className="hero-text">
          <span className="hero-kicker">{theme.segments.map((s) => SEGMENT_LABEL[s]).join(" · ")}</span>
          <h2>{theme.title}</h2>
          {theme.description && <p>{theme.description}</p>}
          <div className="row">
            <button
              type="button"
              className="hero-play"
              onClick={() => (themePlaying ? player.toggle() : player.playQueue(theme.tracks, 0, theme.title))}
            >
              {themePlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {themePlaying ? "Tạm dừng" : "Phát cả chủ đề"}
            </button>
            <span className="hero-count">
              {n}/{theme.tracks.length} bài đã thêm
            </span>
          </div>
        </div>
      </div>
      {theme.official && (
        <p className="small official">
          Có playlist chính thức trên Epidemic Sound: <SafeLink href={theme.official.url}>{theme.official.title}</SafeLink>
          {canSave && (
            <button type="button" className="btn-link small" onClick={() => setUrl(theme.official!.url)}>
              Dùng link này
            </button>
          )}
        </p>
      )}
      <ol className="track-list">
        {theme.tracks.map((x, i) => {
          const cur = isCurrent(x);
          return (
            <li key={x.id} className={`${cur ? "current" : ""} ${added.has(x.id) ? "added" : ""}`}>
              <span className="idx">{cur && player.playing ? <Equalizer /> : i + 1}</span>
              <button
                type="button"
                className="play-btn"
                aria-label={cur && player.playing ? `Tạm dừng ${x.title}` : `Nghe thử ${x.title}`}
                onClick={() => player.playQueue(theme.tracks, i, theme.title)}
              >
                {cur && player.playing ? <Pause /> : <Play />}
              </button>
              <div className="track-main">
                <strong>{x.title}</strong>
                <span className="small muted">{x.artist}</span>
              </div>
              <div className="mood-chips">
                {(x.moods ?? []).slice(0, 2).map((m) => (
                  <span key={m} className="mood">
                    {m}
                  </span>
                ))}
                {x.vocals && <span className="mood vocal">có lời</span>}
              </div>
              <span className="small muted track-meta">
                {x.bpm} BPM · {mmss(x.duration_s)}
              </span>
              <label className="added-check" title="Đã thêm vào playlist trên tài khoản công ty">
                <input type="checkbox" checked={added.has(x.id)} onChange={() => onMark(x.id)} />
                <span className="small">Đã thêm</span>
              </label>
            </li>
          );
        })}
      </ol>
      <div className="theme-foot">
        <button
          type="button"
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
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link playlist trên tài khoản công ty" disabled={!canSave} />
          <button type="submit" className="btn-primary" disabled={!canSave || !url.trim()}>
            {saved ? "Cập nhật link" : "Lưu link"}
          </button>
        </form>
      </div>
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
    <details className="card library">
      <summary>
        <strong>Thư viện playlist</strong> <span className="count">{saved.length}</span>
        <span className="small muted"> — hiện trong khung deal; thêm playlist chính thức lấy từ trang chủ Epidemic</span>
      </summary>
      {saved.length > 0 && (
        <ul className="snippets">
          {saved.map((p) => (
            <li key={p.title} className="row space-between nowrap">
              <span className="small">
                <SafeLink href={p.url}>{p.title}</SafeLink>{" "}
                <span className="muted">· {p.segments?.length ? p.segments.map((x) => SEGMENT_LABEL[x]).join(", ") : "mọi nhóm"}</span>
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
