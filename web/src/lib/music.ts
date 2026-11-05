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

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Màu nhấn vừa phải theo chủ đề (dùng cho icon, thanh tiến độ). */
const TONES = ["#5b3df5", "#e5487b", "#0e9f8c", "#e07a1f", "#2f6fdb", "#a443d6", "#d9473f", "#1f9d55"];
export function toneFor(key: string): string {
  return TONES[hash(key) % TONES.length];
}

export function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
