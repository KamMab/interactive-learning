"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordResult } from "@/lib/progress";
import { store } from "@/lib/store";
import { shuffle } from "@/lib/id";
import Results from "./Results";
import type { GP } from "./GameHost";
import { sideLabels } from "@/lib/types";

const take = <T,>(arr: T[], n?: number) => (n && n > 0 ? arr.slice(0, n) : arr);

export default function Flashcards({ chapter, opts, onBack }: GP) {
  const { content, settings } = chapter;
  const [round, setRound] = useState(0);
  const deck = useMemo(() => take(settings.shuffle ? shuffle(content.terms) : content.terms, opts.count), [round]);
  const [i, setI] = useState(0), [flipped, setFlipped] = useState(false), [known, setKnown] = useState(0), [learning, setLearning] = useState(0), [done, setDone] = useState(false);
  const card = deck[i];
  function answer(got: boolean) {
    const k = known + (got ? 1 : 0); setKnown(k); if (!got) setLearning(l => l + 1); setFlipped(false);
    if (i + 1 >= deck.length) { recordResult(chapter.id, "flashcards", k, deck.length); setDone(true); } else setI(i + 1);
  }
  useEffect(() => { const k = (e: KeyboardEvent) => { if (done || (e.target as HTMLElement).tagName === "INPUT") return; if (e.code === "Space") { e.preventDefault(); setFlipped(f => !f); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [done]);
  if (done) return <Results title="Flashcards" score={known} total={deck.length} extra={{ value: deck.length - known, label: "Still learning" }} onBack={onBack} onReplay={() => { setRound(r => r + 1); setI(0); setKnown(0); setLearning(0); setDone(false); }} />;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="pill" style={{ color: "#C2571A" }}>Still learning <b>{learning}</b></span>
        <span className="mono text-sm text-muted">{i + 1} / {deck.length}</span>
        <span className="pill" style={{ color: "var(--good)" }}>Know <b>{known}</b></span>
      </div>
      <button onClick={() => setFlipped(!flipped)} className={`fc${flipped ? " back" : ""}`} aria-label="Flip card">
        {flipped ? <span className="flex flex-col items-center gap-3"><span className="eyebrow">{sideLabels(content).back}</span><span className="text-xl leading-relaxed" style={{ maxWidth: "46ch" }}>{card.definition}</span></span> : <span className="flex flex-col items-center gap-3"><span className="eyebrow">{sideLabels(content).front}</span><span className="fc-term">{card.term}</span></span>}
      </button>
      <p className="note text-center">Click the card or press Space to flip.</p>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost fc-learn" disabled={!flipped} onClick={() => answer(false)}>Still learning</button>
        <button className="btn-ghost fc-know" disabled={!flipped} onClick={() => answer(true)}>Know it</button>
      </div>
    </div>);
}

