"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordResult } from "@/lib/progress";
import { store } from "@/lib/store";
import { shuffle } from "@/lib/id";
import Results from "./Results";
import type { GP } from "./GameHost";

const take = <T,>(arr: T[], n?: number) => (n && n > 0 ? arr.slice(0, n) : arr);

export default function Quiz({ chapter, opts, onBack }: GP) {
  const { content, settings } = chapter;
  const limit = store().settings.timer;
  const [round, setRound] = useState(0);
  const questions = useMemo(() => take(settings.shuffle ? shuffle(content.questions) : content.questions, opts.count), [round]);
  const [i, setI] = useState(0), [picked, setPicked] = useState<number | null>(null), [score, setScore] = useState(0), [pts, setPts] = useState(0), [streak, setStreak] = useState(0), [best, setBest] = useState(0), [left, setLeft] = useState(limit), [done, setDone] = useState(false), [gain, setGain] = useState(0);
  const t0 = useRef(performance.now());
  const q = questions[i];
  useEffect(() => { t0.current = performance.now(); setLeft(limit); if (!limit) return;
    const t = setInterval(() => { const l = Math.max(0, limit - (performance.now() - t0.current) / 1000); setLeft(l); }, 100); return () => clearInterval(t); }, [i, round]);
  function pick(idx: number) {
    if (picked !== null) return; setPicked(idx);
    if (idx === q.answer) { const bonus = limit && left > 0 ? Math.round(50 * left / limit) : 0; const g = 100 + bonus; setGain(g); setPts(p => p + g); setScore(s => s + 1); setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; }); }
    else { setGain(0); setStreak(0); }
  }
  function next() { if (i + 1 >= questions.length) { recordResult(chapter.id, "quiz", score, questions.length, pts); setDone(true); } else { setI(i + 1); setPicked(null); } }
  useEffect(() => { const k = (e: KeyboardEvent) => { if (done) return; if (picked === null && /^[1-6]$/.test(e.key)) { const n = +e.key - 1; if (n < q.choices.length) pick(n); } else if (picked !== null && e.key === "Enter") { e.preventDefault(); next(); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  if (done) return <Results title="Quick-fire" score={score} total={questions.length} extra={{ value: pts.toLocaleString(), label: `Points · best streak ${best}` }} onBack={onBack}
    onReplay={() => { setRound(r => r + 1); setI(0); setScore(0); setPts(0); setStreak(0); setBest(0); setPicked(null); setDone(false); }} />;
  const right = picked === q.answer;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <div className="track"><i style={{ width: `${(i + (picked !== null ? 1 : 0)) / questions.length * 100}%` }} /></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono mr-auto text-[13px] text-muted">Question {i + 1} of {questions.length}</span>
        {streak >= 2 && <span className="pill streak"><b>{streak}</b> in a row</span>}
        <span className="pill"><b>{pts.toLocaleString()}</b> pts</span>
        {limit > 0 && <span className={`pill${left <= 3 && picked === null ? " low" : ""}`}><b>{picked !== null ? "—" : Math.ceil(left) + "s"}</b></span>}
      </div>
      {limit > 0 && <div className="timer"><i style={{ width: `${picked !== null ? 0 : left / limit * 100}%` }} /></div>}
      <div className="sheet enter" key={q.id}>
        <span className="tag">{chapter.title}</span>
        <p className="mb-4 mt-3 text-[clamp(19px,3.4vw,23px)] font-bold leading-snug">{q.prompt}</p>
        <div className="grid gap-3">
          {q.choices.map((c, idx) => {
            const st = picked === null ? "" : idx === q.answer ? "ok" : idx === picked ? "bad" : "dim";
            return <button key={idx} disabled={picked !== null} onClick={() => pick(idx)} className={`opt ${st}`}><span className="ob">{String.fromCharCode(65 + idx)}</span><span className="min-w-0 flex-1">{c}</span></button>;
          })}
        </div>
        {picked !== null && (
          <div className={`fb${right ? "" : " bad"} enter`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{right ? "Correct!" : "Not quite"}</strong>{right && <span className="mono text-sm font-semibold">+{gain} pts</span>}</div>
            {!right && <p className="mt-1"><span className="eyebrow">Correct answer</span><br /><b>{q.choices[q.answer]}</b></p>}
            {settings.showExplanations && <p className="mt-2">{q.explanation}</p>}
            <button className="btn mt-3" onClick={next}>{i + 1 >= questions.length ? "See results" : "Continue"}</button>
          </div>)}
      </div>
    </div>);
}

