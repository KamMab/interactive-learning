"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordResult } from "@/lib/progress";
import { store } from "@/lib/store";
import { shuffle } from "@/lib/id";
import Results from "./Results";
import Pic from "../Pic";
import type { GP } from "./GameHost";
import { modeName, type Question } from "@/lib/types";

const take = <T,>(arr: T[], n?: number) => (n && n > 0 ? arr.slice(0, n) : arr);

export default function Rush({ chapter, opts, onBack }: GP) {
  const { content } = chapter;
  const limit = opts.seconds || 60;
  const [phase, setPhase] = useState("ready"), [queue, setQueue] = useState<Question[]>([]), [score, setScore] = useState(0), [answered, setAnswered] = useState(0), [streak, setStreak] = useState(0), [left, setLeft] = useState(limit), [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const endAt = useRef(0);
  function begin() { setQueue(shuffle(content.questions)); setScore(0); setAnswered(0); setStreak(0); setLeft(limit); endAt.current = Date.now() + limit * 1000; setPhase("play"); }
  useEffect(() => { if (phase !== "play") return; const t = setInterval(() => { const l = Math.max(0, (endAt.current - Date.now()) / 1000); setLeft(l); if (l <= 0) setPhase("done"); }, 100); return () => clearInterval(t); }, [phase]);
  useEffect(() => { if (phase === "done") recordResult(chapter.id, "rush", score, answered); }, [phase]);
  function pick(idx: number) {
    const right = idx === queue[0].answer;
    setAnswered(a => a + 1); setScore(s => s + (right ? 1 : 0)); setStreak(s => right ? s + 1 : 0);
    setFlash(right ? "ok" : "bad"); setTimeout(() => setFlash(null), 250);
    setQueue(qs => { const r = qs.slice(1); return r.length ? r : shuffle(content.questions); });
  }
  if (phase === "ready") return (
    <div className="sheet mx-auto max-w-md text-center">
      <span className="eyebrow">Round length</span>
      <p className="verdict mt-1">{limit}s</p>
      <p className="mt-3 text-muted">Answer as many as you can. Questions repeat if you run out.</p>
      <button className="btn big mt-5" onClick={begin}>Start</button>
    </div>);
  if (phase === "done") return <Results title={modeName("rush", chapter.content)} score={score} total={answered} extra={{ value: limit + "s", label: "Round" }} onBack={onBack} onReplay={begin} />;
  const q = queue[0];
  return (
    <div className="mx-auto flex game-col flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill mr-auto"><b>{score}</b> correct</span>
        {streak >= 3 && <span className="pill streak"><b>{streak}</b> in a row</span>}
        <span className={`pill${left <= 5 ? " low" : ""}`}><b>{left.toFixed(1)}s</b></span>
      </div>
      <div className="timer"><i style={{ width: `${(left / limit) * 100}%` }} /></div>
      <div className={`sheet${flash === "bad" ? " shake" : ""}`} style={flash ? { borderColor: flash === "ok" ? "var(--good)" : "var(--red)" } : undefined}>
        {q.image && <Pic src={q.image} alt="Picture for this question" className="q-pic mb-3" />}
        <p className="mb-4 text-[clamp(18px,3.2vw,22px)] font-bold leading-snug">{q.prompt}</p>
        <div className="grid gap-3 sm:grid-cols-2">{q.choices.map((c, idx) => <button key={idx} onClick={() => pick(idx)} className="opt"><span className="ob">{String.fromCharCode(65 + idx)}</span><span className="min-w-0 flex-1">{c}</span></button>)}</div>
      </div>
    </div>);
}

