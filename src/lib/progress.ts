"use client";
// Guest progress lives in the browser (see store.ts). When sign-in is on, it's also copied to the
// student's account so it follows them across devices.
import { browserSupabase } from "./supabase-browser";
import { chapterProgress, save, type ChapterProgress } from "./store";
import type { Mode } from "./types";

export function getProgress(chapterId: string): ChapterProgress {
  return chapterProgress(chapterId);
}

export function recordResult(chapterId: string, mode: Mode, score: number, total: number, points = 0) {
  const p = chapterProgress(chapterId);
  const prev = p.modes[mode] ?? { plays: 0, best: 0, last: 0, total };
  p.modes[mode] = {
    plays: prev.plays + 1,
    best: Math.max(prev.best, score),
    last: score,
    total,
    bestPts: Math.max(prev.bestPts ?? 0, points),
  };
  if (mode === "flashcards") p.flashcardsDone = true;
  save();
  void syncToAccount(chapterId, p);
  // Counts toward Trending (ignored for demo content and private sets).
  fetch("/api/play", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapterId }), keepalive: true }).catch(() => {});
}

async function syncToAccount(chapterId: string, p: ChapterProgress) {
  const sb = browserSupabase();
  if (!sb) return; // sign-in is off: guest mode only
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  await sb.from("progress").upsert({
    user_id: data.user.id,
    chapter_id: chapterId,
    data: p,
    updated_at: new Date().toISOString(),
  });
}
