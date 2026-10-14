"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtDur, learnMastery, store, studyStreak, weekSeconds, dayKey, type RecentChapter } from "@/lib/store";

// Home's "Jump back in" row and quick stats, from what this browser remembers.
export default function HomeProgress() {
  const [data, setData] = useState<{ recent: RecentChapter[]; today: number; week: number; streak: number } | null>(null);
  useEffect(() => {
    const S = store();
    setData({ recent: S.recent.slice(0, 4), today: S.time.days[dayKey()] || 0, week: weekSeconds(), streak: studyStreak() });
  }, []);
  if (!data) return <div className="stats"><div className="stat h-[78px]" /><div className="stat h-[78px]" /><div className="stat h-[78px]" /></div>;
  return (
    <section className="flex flex-col gap-4">
      <div className="stats">
        <div className="stat"><b>{fmtDur(data.today)}</b><span>Studied today</span></div>
        <div className="stat"><b>{fmtDur(data.week)}</b><span>This week</span></div>
        <div className="stat"><b>{data.streak} day{data.streak === 1 ? "" : "s"}</b><span>Study streak</span></div>
      </div>
      {data.recent.length > 0 && (
        <>
          <h2 className="mt-2 text-[24px] font-bold">Jump back in</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.recent.map((r) => {
              const m = learnMastery(r.id, r.items);
              return (
                <Link key={r.id} href={r.href} className="row-link">
                  <span className="num">{Math.round(m * 100)}%</span>
                  <span className="txt"><b>{r.title}</b><span>{r.label}</span></span>
                  <span className="minibar" aria-label={`${Math.round(m * 100)}% mastered`}><i style={{ width: `${m * 100}%` }} /></span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
