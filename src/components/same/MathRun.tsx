"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { mathProblem, readNumber } from "@/lib/math";
import type { RunEnd } from "./SoloRun";

/** Solo Math Blitz: problems get harder; a wrong answer or the clock running out ends the run. A seed = a challenge code. */
export default function MathRun({ seed, onOver, label }: { seed?: number; onOver: (e: RunEnd) => void; label?: string }) {
  const base = useMemo(() => seed ?? Math.floor(Math.random() * 2 ** 31), [seed]);
  const [round, setRound] = useState(1);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<null | "ok">(null);
  const [msg, setMsg] = useState("");
  const p = useMemo(() => mathProblem(base, round), [base, round]);
  const t0 = useRef(0);
  const [left, setLeft] = useState(p.seconds);
  const box = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    t0.current = performance.now(); setLeft(p.seconds); box.current?.focus();
    const t = setInterval(() => {
      const l = Math.max(0, p.seconds - (performance.now() - t0.current) / 1000);
      setLeft(l);
      if (l <= 0 && !done.current) { done.current = true; clearInterval(t); onOver({ streak: round - 1, prompt: p.text, mine: "", site: String(p.answer), verdict: "none", examples: [], math: true }); }
    }, 100);
    return () => clearInterval(t);
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (done.current || flash) return;
    const n = readNumber(typed);
    if (n == null) { setMsg("Type a whole number."); return; }
    if (n === p.answer) {
      setFlash("ok");
      setTimeout(() => { setFlash(null); setTyped(""); setMsg(""); setRound((r) => r + 1); }, 450);
    } else { done.current = true; onOver({ streak: round - 1, prompt: p.text, mine: String(n), site: String(p.answer), verdict: "wrong", examples: [], math: true }); }
  }

  return (
    <div className="mx-auto flex game-col flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono mr-auto text-[13px] text-muted">{label ? `${label} · ` : ""}Problem {round}</span>
        <span className="pill">Level <b>{p.level}</b>/5</span>
        <span className="pill streak"><b>{round - 1}</b> streak</span>
        <span className={`pill${left <= 3 ? " low" : ""}`}><b>{Math.ceil(left)}s</b></span>
      </div>
      <div className="timer"><i style={{ width: `${(left / p.seconds) * 100}%` }} /></div>
      <section className={`sheet same-sheet math-sheet enter${flash ? " ok" : ""}`} key={round}>
        <span className="tag">Math Blitz</span>
        <p className="math-q">{p.text} = ?</p>
        <form className="same-form" onSubmit={submit}>
          <input ref={box} className="input mono math-in" inputMode="numeric" autoComplete="off" value={typed} onChange={(e) => { setTyped(e.target.value); setMsg(""); }} placeholder="Answer" aria-label="Your answer" />
          <button className="btn" disabled={!typed.trim()}>Enter</button>
        </form>
        {msg && <p className="mt-2 text-sm text-bad">{msg}</p>}
        {flash && <p className="fb mt-3"><strong>Correct!</strong></p>}
      </section>
    </div>
  );
}
