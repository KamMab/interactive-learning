"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordResult } from "@/lib/progress";
import { store } from "@/lib/store";
import { shuffle } from "@/lib/id";
import Results from "./Results";
import Pic from "../Pic";
import type { GP } from "./GameHost";

const take = <T,>(arr: T[], n?: number) => (n && n > 0 ? arr.slice(0, n) : arr);

export default function Match({ chapter, opts, onBack }: GP) {
  const { content } = chapter;
  const [round, setRound] = useState(0);
  type Tile = { key: string; pairId: string; text: string; side: "term" | "def"; image?: string };
  const tiles = useMemo(() => shuffle<Tile>(shuffle(content.terms).slice(0, Math.max(2, opts.pairs ?? 6)).flatMap(p => [
    { key: p.id + "t", pairId: p.id, text: p.term, side: "term" }, { key: p.id + "d", pairId: p.id, text: p.definition, side: "def", image: p.image }])), [round]);
  const [sel, setSel] = useState<Tile | null>(null), [matched, setMatched] = useState<Set<string>>(new Set()), [wrong, setWrong] = useState<string[]>([]), [misses, setMisses] = useState(0), [elapsed, setElapsed] = useState(0), [done, setDone] = useState(false);
  const start = useRef(Date.now());
  const pairs = tiles.length / 2;
  useEffect(() => { if (done) return; const t = setInterval(() => setElapsed((Date.now() - start.current) / 1000 + misses), 100); return () => clearInterval(t); }, [done, round, misses]);
  function click(t: Tile) {
    if (matched.has(t.pairId) || wrong.length) return;
    if (!sel) return setSel(t);
    if (sel.key === t.key) return setSel(null);
    if (sel.side === t.side) return setSel(t);
    if (sel.pairId === t.pairId) {
      const m = new Set(matched).add(t.pairId); setMatched(m); setSel(null);
      if (m.size === pairs) { const s = (Date.now() - start.current) / 1000 + misses; setElapsed(s); recordResult(chapter.id, "match", pairs - Math.min(misses, pairs), pairs); setDone(true); }
    } else { setMisses(x => x + 1); setWrong([sel.key, t.key]); setTimeout(() => { setWrong([]); setSel(null); }, 600); }
  }
  if (done) return <Results title="Match" score={pairs - Math.min(misses, pairs)} total={pairs} extra={{ value: elapsed.toFixed(1) + "s", label: `Time · ${misses} miss${misses === 1 ? "" : "es"} (+1s each)` }} onBack={onBack}
    onReplay={() => { setRound(r => r + 1); setMatched(new Set()); setMisses(0); setSel(null); setDone(false); start.current = Date.now(); setElapsed(0); }} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono mr-auto text-[13px] text-muted">{matched.size} / {pairs} matched</span>
        {misses > 0 && <span className="pill low">+{misses}s penalty</span>}
        <span className="pill"><b>{elapsed.toFixed(1)}s</b></span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(t => {
          const m = matched.has(t.pairId), s = sel && sel.key === t.key, w = wrong.includes(t.key);
          return <button key={t.key} onClick={() => click(t)} disabled={m} className={`mtile${t.side === "term" ? " term" : ""}${m ? " gone" : w ? " bad shake" : s ? " sel" : ""}`}>{t.image ? <Pic src={t.image} alt="Picture to match" className="m-pic" /> : t.text}</button>;
        })}
      </div>
    </div>);
}

