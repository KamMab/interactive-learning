"use client";
import { useState } from "react";
import MathRun from "./MathRun";
import JoinBox from "./JoinBox";
import { HostForm, RunOver, StreakBoard } from "./SameGame";
import type { RunEnd } from "./SoloRun";
import { saveStreak } from "@/app/play/actions";
import type { GP } from "../games/GameHost";

export function MathRules() {
  return (
    <ul className="same-rules">
      <li><b>1</b>Solve each problem and press Enter. Every few problems they get harder: adding, then times tables, then division and two-step problems.</li>
      <li><b>2</b>One wrong answer, or running out of time, ends the game.</li>
      <li><b>3</b>Your streak is how many you got right in a row. Beat the champion to take the crown.</li>
    </ul>
  );
}

// Math Blitz home: play solo for the leaderboard, host a live game or challenge with a code, or join one.
export default function MathGame({ chapter }: GP) {
  const [view, setView] = useState<"home" | "solo" | "host">("home");
  const [end, setEnd] = useState<RunEnd | null>(null);
  const [run, setRun] = useState(0);
  const [saved, setSaved] = useState<React.ReactNode>(null);
  const [refresh, setRefresh] = useState(0);
  async function over(e: RunEnd) {
    setEnd(e); setSaved(null);
    if (e.streak <= 0) return;
    const r = await saveStreak(chapter.id, e.streak).catch(() => ({ error: "Couldn't save." }));
    setSaved("error" in r ? <p className="note mt-3">{r.error}</p>
      : r.crowned ? <p className="fb mt-3"><strong>👑 New champion!</strong><br />You hold the record until someone beats {r.best}.</p>
      : r.improved ? <p className="fb mt-3"><strong>New personal best: {r.best}</strong></p> : <p className="note mt-3">Your best is still {r.best}.</p>);
    setRefresh((x) => x + 1);
  }
  if (view === "solo") {
    return (
      <div className="mx-auto flex game-col flex-col gap-4">
        {end ? <RunOver end={end} saved={saved} onAgain={() => { setEnd(null); setRun((r) => r + 1); }} onHome={() => { setEnd(null); setView("home"); }} />
          : <MathRun key={run} onOver={over} />}
        {end && <StreakBoard chapterId={chapter.id} refresh={refresh} />}
      </div>
    );
  }
  return (
    <div className="mx-auto flex game-col flex-col gap-4">
      <section className="sheet same-sheet same-home">
        <span className="tag">How to play</span>
        <MathRules />
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn big" onClick={() => { setEnd(null); setView("solo"); setRun((r) => r + 1); }}>Start</button>
          <button className="btn-ghost big" onClick={() => setView(view === "host" ? "home" : "host")}>Play with friends or a class</button>
        </div>
      </section>
      {view === "host" && <HostForm chapterId={chapter.id} math onCancel={() => setView("home")} />}
      <JoinBox />
      <StreakBoard chapterId={chapter.id} refresh={refresh} />
    </div>
  );
}
