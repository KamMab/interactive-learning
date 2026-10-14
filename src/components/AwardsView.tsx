"use client";
import { useEffect, useState } from "react";
import { learnMastery, store, studyStreak } from "@/lib/store";
import { MODES } from "@/lib/types";

type Badge = { id: string; icon: string; name: string; how: string; have: number; need: number };

// Badges earned from what this browser has recorded. Each shows progress toward unlocking.
function compute(): Badge[] {
  const S = store();
  const chs = Object.values(S.ch);
  const played = new Set(chs.flatMap((c) => Object.keys(c.modes)));
  const best = (mode: string, ok: (b: { best: number; total: number }) => boolean) => chs.some((c) => { const m = c.modes[mode as keyof typeof c.modes]; return !!m && m.total > 0 && ok(m); });
  const masteredItems = chs.reduce((n, c) => n + Object.values(c.learn ?? {}).filter((v) => v >= 2).length, 0);
  const fullChapters = S.recent.filter((r) => learnMastery(r.id, r.items) >= 1).length;
  const hours = S.time.total / 3600, streak = studyStreak(), rounds = chs.reduce((n, c) => n + Object.values(c.modes).reduce((s, m) => s + (m?.plays ?? 0), 0), 0);
  return [
    { id: "first", icon: "★", name: "First round", how: "Finish a round of anything.", have: Math.min(rounds, 1), need: 1 },
    { id: "learn10", icon: "✓", name: "Getting it", how: "Master 10 items in Learn.", have: Math.min(masteredItems, 10), need: 10 },
    { id: "learn50", icon: "✓✓", name: "On a roll", how: "Master 50 items in Learn.", have: Math.min(masteredItems, 50), need: 50 },
    { id: "chapter", icon: "📗", name: "Chapter master", how: "Master every item in a chapter.", have: Math.min(fullChapters, 1), need: 1 },
    { id: "perfect", icon: "💯", name: "Perfect quiz", how: "Get every Quick-fire question right.", have: best("quiz", (b) => b.best === b.total) ? 1 : 0, need: 1 },
    { id: "ledger", icon: "📒", name: "Balanced books", how: "Get every journal entry right in a round.", have: best("entries", (b) => b.best === b.total) ? 1 : 0, need: 1 },
    { id: "rush", icon: "⚡", name: "Rusher", how: "Score 10+ in one Rush round.", have: Math.min(Math.max(0, ...chs.map((c) => c.modes.rush?.best ?? 0)), 10), need: 10 },
    { id: "match", icon: "🧩", name: "Clean sweep", how: "Finish Match with no misses.", have: best("match", (b) => b.best === b.total) ? 1 : 0, need: 1 },
    { id: "explorer", icon: "🧭", name: "Explorer", how: "Try every study mode.", have: MODES.filter((m) => played.has(m)).length, need: MODES.length },
    { id: "streak3", icon: "🔥", name: "Three-day streak", how: "Study three days in a row.", have: Math.min(streak, 3), need: 3 },
    { id: "streak7", icon: "🔥", name: "Week streak", how: "Study seven days in a row.", have: Math.min(streak, 7), need: 7 },
    { id: "hour", icon: "⏱", name: "Hour of power", how: "Study for an hour in total.", have: Math.min(hours, 1), need: 1 },
    { id: "ten", icon: "🐻", name: "True Bruin", how: "Study for 10 hours in total.", have: Math.min(hours, 10), need: 10 },
  ];
}

export default function AwardsView() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  useEffect(() => setBadges(compute()), []);
  const earned = badges?.filter((b) => b.have >= b.need).length ?? 0;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="eyebrow">Awards</span>
        <h1 className="big mt-2">Awards</h1>
        <p className="mt-2 text-muted">{badges ? `${earned} of ${badges.length} earned.` : ""} Earn them by studying; progress is saved in this browser.</p>
      </div>
      <div className="badges">
        {badges?.map((b) => {
          const on = b.have >= b.need;
          return (
            <div key={b.id} className={`badge${on ? " on" : ""}`}>
              <span className="medal" aria-hidden>{b.icon}</span>
              <b>{b.name}</b>
              <p>{b.how}</p>
              {on ? <span className="tag ok self-start">Earned</span> : (
                <><span className="minibar"><i style={{ width: `${(b.have / b.need) * 100}%` }} /></span>
                  <span className="note">{Number.isInteger(b.need) && b.need > 1 ? `${Math.floor(b.have)} / ${b.need}` : "Not yet"}</span></>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
