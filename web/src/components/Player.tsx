import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { PREVIEW_HOST, gradientFor, mmss, type Track } from "../lib/music";

interface PlayerState {
  current: Track | null;
  label: string;
  playing: boolean;
  /** Phát danh sách, bắt đầu từ bài thứ `start`; bấm lại bài đang phát = tạm dừng / tiếp tục. */
  playQueue: (tracks: Track[], start: number, label: string) => void;
  toggle: () => void;
}

const Ctx = createContext<PlayerState>({
  current: null,
  label: "",
  playing: false,
  playQueue: () => undefined,
  toggle: () => undefined,
});
export const usePlayer = () => useContext(Ctx);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [label, setLabel] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = index >= 0 ? (queue[index] ?? null) : null;

  const el = useCallback(() => {
    if (!audio.current) {
      const a = new Audio();
      a.preload = "metadata";
      audio.current = a;
    }
    return audio.current;
  }, []);

  // Gắn sự kiện một lần.
  useEffect(() => {
    const a = el();
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setIndex((i) => i + 1);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [el]);

  // Đổi bài.
  useEffect(() => {
    const a = el();
    if (!current) {
      a.pause();
      return;
    }
    if (!PREVIEW_HOST.test(current.preview)) return;
    setError(null);
    setTime(0);
    setDuration(current.duration_s);
    a.src = current.preview;
    void a.play().catch(() => setError("Không phát được bản nghe thử này."));
  }, [current, el]);

  useEffect(() => {
    el().volume = muted ? 0 : volume;
  }, [volume, muted, el]);

  const playQueue = useCallback(
    (tracks: Track[], start: number, lbl: string) => {
      const t = tracks[start];
      if (current && t && current.id === t.id) {
        const a = el();
        if (a.paused) void a.play();
        else a.pause();
        return;
      }
      setQueue(tracks);
      setLabel(lbl);
      setIndex(start);
    },
    [current, el],
  );

  const toggle = useCallback(() => {
    const a = el();
    if (!current) return;
    if (a.paused) void a.play();
    else a.pause();
  }, [current, el]);

  const value = useMemo(() => ({ current, label, playing, playQueue, toggle }), [current, label, playing, playQueue, toggle]);
  const pct = duration > 0 ? (100 * time) / duration : 0;

  return (
    <Ctx.Provider value={value}>
      {children}
      {current && (
        <div className="player" role="region" aria-label="Trình phát nhạc">
          <div className="player-track">
            <span className="art" style={{ background: gradientFor(current.id) }} aria-hidden="true" />
            <span className="player-text">
              <strong>{current.title}</strong>
              <span className="small">
                {current.artist}
                {label ? ` · ${label}` : ""}
              </span>
            </span>
          </div>
          <div className="player-main">
            <div className="player-buttons">
              <button type="button" className="btn-icon" aria-label="Bài trước" disabled={index <= 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <SkipBack />
              </button>
              <button type="button" className="btn-icon big" aria-label={playing ? "Tạm dừng" : "Phát"} onClick={toggle}>
                {playing ? <Pause /> : <Play />}
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label="Bài tiếp"
                disabled={index >= queue.length - 1}
                onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
              >
                <SkipForward />
              </button>
            </div>
            <div className="seek">
              <span className="small">{mmss(time)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(time, duration || 0)}
                aria-label="Tua đến đoạn muốn nghe"
                style={{ backgroundSize: `${pct}% 100%` }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  el().currentTime = v;
                  setTime(v);
                }}
              />
              <span className="small">{mmss(duration)}</span>
            </div>
            {error && <span className="small player-error">{error}</span>}
          </div>
          <div className="player-side">
            <button type="button" className="btn-icon" aria-label={muted ? "Bật tiếng" : "Tắt tiếng"} onClick={() => setMuted((m) => !m)}>
              {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
            </button>
            <input
              type="range"
              className="volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Âm lượng"
              style={{ backgroundSize: `${(muted ? 0 : volume) * 100}% 100%` }}
              onChange={(e) => {
                setMuted(false);
                setVolume(Number(e.target.value));
              }}
            />
            <button
              type="button"
              className="btn-icon"
              aria-label="Đóng trình phát"
              onClick={() => {
                el().pause();
                setIndex(-1);
              }}
            >
              <X />
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
