// Nhạc mẫu Epidemic Sound: kiểu dữ liệu + màu sắc hiển thị.
import type { Segment } from "./api-types";

export interface Track {
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

export interface Theme {
  id: string;
  title: string;
  segments: Segment[];
  description?: string;
  official?: { title: string; url: string };
  tracks: Track[];
}

export const PREVIEW_HOST = /^https:\/\/audiocdn\.epidemicsound\.com\//;

/** Bảng màu rực rỡ (tông Epidemic Sound). */
export const PALETTE: [string, string][] = [
  ["#ff3d7f", "#ff8a3d"],
  ["#7c5cff", "#3d8bff"],
  ["#00c2a8", "#3dd68c"],
  ["#ff8a3d", "#ffc93d"],
  ["#3d8bff", "#00c2ff"],
  ["#c13dff", "#ff3d7f"],
  ["#ff5252", "#ff3dc8"],
  ["#22c58b", "#00c2ff"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Màu gradient ổn định theo mã (bài hát / chủ đề). */
export function gradientFor(key: string): string {
  const [a, b] = PALETTE[hash(key) % PALETTE.length];
  const angle = 100 + (hash(key + "a") % 120);
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
}

export function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
