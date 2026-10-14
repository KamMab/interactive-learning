"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { chapterProgress, learnMastery, store, type RecentChapter } from "@/lib/store";
import { MODE_INFO, type Mode } from "@/lib/types";

// Chapters this browser has studied, with Learn mastery and best scores.
export default function RecentList({ limit = 30 }: { limit?: number }) {
  const [list, setList] = useState<RecentChapter[] | null>(null);
  useEffect(() => setList(store().recent.slice(0, limit)), [limit]);
  if (!list) return null;
  if (!list.length) return <p className="text-muted">Nothing yet. Open any chapter from the <Link href="/library" className="underline">Library</Link> to start.</p>;
  return (
    <div className="grid gap-3">
      {list.map((r) => {
        const m = learnMastery(r.id, r.items);
        const modes = chapterProgress(r.id).modes;
        const best = (Object.keys(modes) as Mode[]).filter((k) => k !== "learn" && k !== "flashcards").map((k) => `${MODE_INFO[k].name} ${modes[k]!.best}/${modes[k]!.total}`);
        return (
          <Link key={r.id} href={r.href} className="row-link">
            <span className="num">{Math.round(m * 100)}%</span>
            <span className="txt"><b>{r.title}</b><span>{r.label}{best.length ? ` · Best: ${best.join(", ")}` : ""}</span></span>
            <span className="minibar" aria-label={`${Math.round(m * 100)}% mastered in Learn`}><i style={{ width: `${m * 100}%` }} /></span>
          </Link>
        );
      })}
    </div>
  );
}
