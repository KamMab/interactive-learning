"use client";
import { useEffect, useState } from "react";
import { openSettings } from "./SiteHeader";
import RecentList from "./RecentList";
import { dayKey, fmtD, fmtDur, parseDay, quarterAgg, quarterFor, store, studyStreak, weekSeconds } from "@/lib/store";

// Study time at a glance plus every chapter's mastery. The full quarter breakdown lives in Settings → Study time.
export default function ProgressView() {
  const [d, setD] = useState<null | { today: number; week: number; quarter: number; total: number; streak: number; name: string; days: { k: string; v: number }[] }>(null);
  useEffect(() => {
    const S = store(), q = quarterFor(new Date());
    const days = Array.from({ length: 14 }, (_, i) => { const x = new Date(); x.setDate(x.getDate() - 13 + i); const k = dayKey(x); return { k, v: S.time.days[k] || 0 }; });
    setD({ today: S.time.days[dayKey()] || 0, week: weekSeconds(), quarter: quarterAgg(q).total, total: S.time.total, streak: studyStreak(), name: q.name, days });
  }, []);
  const max = d ? Math.max(60, ...d.days.map((x) => x.v)) : 60;
  return (
    <div className="flex flex-col gap-10">
      <div>
        <span className="eyebrow">Progress</span>
        <h1 className="big mt-2">Your progress</h1>
        <p className="mt-2 max-w-[60ch] text-muted">Time counts while a question, card or board is on screen. Saved in this browser{d ? "" : "…"}</p>
      </div>
      {d && (
        <>
          <div className="stats">
            <div className="stat"><b>{fmtDur(d.today)}</b><span>Today</span></div>
            <div className="stat"><b>{fmtDur(d.week)}</b><span>This week</span></div>
            <div className="stat"><b>{fmtDur(d.quarter)}</b><span>{d.name}</span></div>
            <div className="stat"><b>{d.streak}</b><span>Day streak</span></div>
          </div>
          <section className="card flex flex-col gap-3 p-[22px]">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-[22px] font-bold">Last 14 days</h2>
              <button className="link" onClick={openSettings}>Quarter breakdown</button>
            </div>
            <div className="tweek" style={{ gridTemplateColumns: "repeat(14,minmax(0,1fr))" }} role="img" aria-label="Study time over the last 14 days">
              {d.days.map((x) => (
                <div key={x.k} className={`tday${x.k === dayKey() ? " today" : ""}`} title={`${fmtD(parseDay(x.k))}: ${fmtDur(x.v)}`}>
                  <span className="tcol"><i style={{ height: `${(x.v / max) * 100}%` }} /></span>
                  <span className="tlbl">{parseDay(x.k).toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                </div>
              ))}
            </div>
            <p className="note">All time: {fmtDur(d.total)}</p>
          </section>
        </>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-bold">Chapters</h2>
        <p className="-mt-2 text-sm text-muted">The percentage is how much of the chapter you&apos;ve mastered in Learn.</p>
        <RecentList />
      </section>
    </div>
  );
}
