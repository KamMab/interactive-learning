"use client";
// Everything a guest's browser remembers: settings, best scores and study time (same as Ledger Rush).
import type { Mode } from "./types";

export type Settings = { theme: "light" | "dark"; timer: number };
export type ModeStats = { plays: number; best: number; last: number; total: number; bestPts?: number };
export type ChapterProgress = {
  modes: Partial<Record<Mode, ModeStats>>;
  flashcardsDone?: boolean;
  lastMode?: Mode;
  learn?: Record<string, number>; // Learn mode: item id -> 0 new/missed, 1 familiar, 2 mastered
};
type DayLog = Record<string, { total: number; modes: Partial<Record<Mode, number>> }>;
export type Store = {
  settings: Settings;
  ch: Record<string, ChapterProgress>;
  time: { total: number; days: Record<string, number>; log: Record<string, DayLog> };
  names: Record<string, string>; // chapter id -> "MGMT 120B · Ch. 1 Title" for the study-time view
  recent: RecentChapter[];        // newest first, for Home and Progress
};
export type RecentChapter = { id: string; label: string; title: string; href: string; at: number; items: number };

import { STORE_KEY } from "./store-key";
export { STORE_KEY };
export const TIMERS = [0, 10, 15, 20, 30, 60];

let S: Store | null = null;

export function store(): Store {
  if (S) return S;
  let raw: Partial<Store> = {};
  try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch {}
  S = {
    settings: { theme: "light", timer: 15, ...(raw.settings ?? {}) },
    ch: raw.ch ?? {},
    time: { total: 0, days: {}, log: {}, ...(raw.time ?? {}) },
    names: raw.names ?? {},
    recent: raw.recent ?? [],
  };
  return S;
}

const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store())); } catch {}
  listeners.forEach((fn) => fn());
}

export function applyTheme() {
  document.documentElement.classList.toggle("lr-dark", store().settings.theme === "dark");
}

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  store().settings[k] = v;
  if (k === "theme") applyTheme();
  save();
}

export const chapterProgress = (id: string) => store().ch[id] || (store().ch[id] = { modes: {} });

// ---------- study time ----------
export const dayKey = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export const PLAYING: { chapterId: string | null; mode: Mode | null; paused: boolean } = { chapterId: null, mode: null, paused: false };

let started = false;
/** Starts the once-a-second study timer. Counts only while a game is on screen and the student was active in the last 2 minutes. */
export function startStudyClock() {
  if (started || typeof window === "undefined") return;
  started = true;
  let lastInput = Date.now();
  let n = 0;
  ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"].forEach((ev) =>
    addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }),
  );
  setInterval(() => {
    const { chapterId, mode, paused } = PLAYING;
    if (!chapterId || !mode || paused || document.visibilityState !== "visible" || Date.now() - lastInput > 120000) return;
    const T = store().time, d = dayKey();
    T.total++; T.days[d] = (T.days[d] || 0) + 1;
    const L = T.log[d] || (T.log[d] = {});
    const c = L[chapterId] || (L[chapterId] = { total: 0, modes: {} });
    c.total++; c.modes[mode] = (c.modes[mode] || 0) + 1;
    if (++n % 5 === 0) { try { localStorage.setItem(STORE_KEY, JSON.stringify(store())); } catch {} }
  }, 1000);
  addEventListener("pagehide", save);
}

export const fmtDur = (s: number) => {
  s = Math.round(s || 0);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};

// ---------- UCLA-style academic quarters (approximate dates) ----------
export type Quarter = { key: string; name: string; start: Date; end: Date };
const QSPAN: Record<string, [[number, number], [number, number]]> = {
  fall: [[8, 15], [11, 31]], winter: [[0, 1], [2, 22]], spring: [[2, 23], [5, 15]], summer: [[5, 16], [8, 14]],
};
function mkQ(season: string, y: number): Quarter {
  const r = QSPAN[season];
  return { key: `${y}-${season}`, name: season[0].toUpperCase() + season.slice(1) + " " + y, start: new Date(y, r[0][0], r[0][1]), end: new Date(y, r[1][0], r[1][1]) };
}
export function quarterFor(d: Date): Quarter {
  const y = d.getFullYear(), md = (d.getMonth() + 1) * 100 + d.getDate();
  return md >= 915 ? mkQ("fall", y) : md <= 322 ? mkQ("winter", y) : md <= 615 ? mkQ("spring", y) : mkQ("summer", y);
}
export function shiftQ(q: Quarter, n: number): Quarter {
  for (let i = 0; i < Math.abs(n); i++) {
    const d = new Date(n < 0 ? q.start : q.end);
    d.setDate(d.getDate() + (n < 0 ? -1 : 1));
    q = quarterFor(d);
  }
  return q;
}
export const parseDay = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const fmtD = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
export function quarterAgg(q: Quarter) {
  const out = { total: 0, ch: {} as Record<string, { total: number; modes: Partial<Record<Mode, number>> }>, days: {} as Record<string, number> };
  for (const [k, L] of Object.entries(store().time.log)) {
    const d = parseDay(k);
    if (d < q.start || d > q.end) continue;
    for (const [id, c] of Object.entries(L)) {
      const a = out.ch[id] || (out.ch[id] = { total: 0, modes: {} });
      a.total += c.total; out.total += c.total; out.days[k] = (out.days[k] || 0) + c.total;
      for (const [m, v] of Object.entries(c.modes)) a.modes[m as Mode] = (a.modes[m as Mode] || 0) + (v || 0);
    }
  }
  return out;
}
export function allQuarters(): Quarter[] {
  const cur = quarterFor(new Date());
  const keys = Object.keys(store().time.log).sort();
  let q = keys.length ? quarterFor(parseDay(keys[0])) : cur;
  const list: Quarter[] = [];
  for (let i = 0; i < 40; i++) { list.push(q); if (q.key === cur.key) break; q = shiftQ(q, 1); }
  return list.reverse();
}
export function resetStudyTime() {
  store().time = { total: 0, days: {}, log: {} };
  save();
}

/** Remember that a chapter was opened (Home's "Jump back in", Progress, Awards). */
export function noteVisit(c: Omit<RecentChapter, "at">) {
  const S = store();
  S.names[c.id] = c.label;
  S.recent = [{ ...c, at: Date.now() }, ...S.recent.filter((r) => r.id !== c.id)].slice(0, 30);
  save();
}

/** Learn mastery for a chapter as a 0–1 fraction (needs the chapter's item count from a visit). */
export function learnMastery(id: string, items: number) {
  const lv = store().ch[id]?.learn ?? {};
  const mastered = Object.values(lv).filter((v) => v >= 2).length;
  return items ? Math.min(1, mastered / items) : 0;
}

/** Consecutive days (ending today or yesterday) with any study time. */
export function studyStreak() {
  const days = store().time.days;
  let n = 0;
  const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Monday-based week key, e.g. "2026-10-12", used for weekly totals and the leaderboard. */
export function weekKey(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return dayKey(m);
}
export function weekSeconds() {
  const start = parseDay(weekKey());
  return Object.entries(store().time.days).reduce((s, [k, v]) => (parseDay(k) >= start ? s + v : s), 0);
}
